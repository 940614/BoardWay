import React, { useContext, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, SafeAreaView, TouchableOpacity, Text, Platform } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { notify } from '../utils/dialog';
import { colors } from '../theme/colors';

const STORE_ID = 'store-0e467d81-2b19-4dd4-b37f-8f3275ec7458';
const CHANNEL_KEY = 'channel-key-a6e6ccf6-fbf6-4689-b036-78f7de1c866f';

// 웹 전용: PortOne SDK를 직접 브라우저에서 호출
function PaymentWebScreen({ amount, user, verifyAndRechargePoints, navigation, paymentId }) {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.portone.io/v2/browser-sdk.js';
    script.onload = async () => {
      setStatus('paying');
      try {
        // PortOne 결제창은 모바일 브라우저에서 iframe 형태로 열면 화면이 잘리거나
        // 결제수단 선택이 정상 동작하지 않는 경우가 있습니다. 모바일에서는 결제사
        // 전체 화면으로 이동한 뒤 보드웨이로 돌아오는 방식으로 처리합니다.
        const isMobileWeb = window.matchMedia?.('(max-width: 768px)').matches;
        const redirectUrl = `${window.location.origin}${window.location.pathname}?paymentReturn=1`;

        if (isMobileWeb) {
          window.sessionStorage.setItem('boardway:pending-payment', JSON.stringify({
            paymentId,
            amount,
          }));
        }

        const response = await window.PortOne.requestPayment({
          storeId: STORE_ID,
          channelKey: CHANNEL_KEY,
          paymentId,
          orderName: `보드웨이 포인트 ${amount}P`,
          totalAmount: amount,
          currency: 'CURRENCY_KRW',
          payMethod: 'CARD',
          customer: { customerId: String(user?.id) },
          ...(isMobileWeb ? {
            redirectUrl,
            forceRedirect: true,
          } : {}),
        });

        if (response?.code === 'PAYMENT_CANCELLED') {
          navigation.goBack();
          return;
        }
        if (response?.code && response.code !== 'PAYMENT_DONE') {
          navigation.goBack();
          notify('결제 실패', response.message || '결제에 실패했습니다.');
          return;
        }

        setStatus('verifying');
        const ok = await verifyAndRechargePoints(response?.paymentId || paymentId, amount);
        navigation.goBack();
        if (ok) {
          notify('충전 완료', `${amount.toLocaleString()} 포인트가 충전되었습니다.`);
        } else {
          notify('충전 실패', '결제 검증에 실패했습니다. 고객센터에 문의해주세요.');
        }
      } catch (e) {
        navigation.goBack();
        notify('결제 오류', e.message || '결제 중 오류가 발생했습니다.');
      }
    };
    script.onerror = () => {
      navigation.goBack();
      notify('오류', '결제 모듈을 불러올 수 없습니다.');
    };
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  const messages = {
    loading: '결제 모듈 로딩 중...',
    paying: '결제창이 열립니다...',
    verifying: '결제 확인 중...',
  };

  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>{messages[status]}</Text>
    </View>
  );
}

// 모바일 전용: WebView로 결제창 띄우기
function PaymentNativeScreen({ amount, user, verifyAndRechargePoints, navigation, paymentId }) {
  const { WebView } = require('react-native-webview');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
</head>
<body>
<script>
  async function startPayment() {
    try {
      const response = await PortOne.requestPayment({
        storeId: "${STORE_ID}",
        channelKey: "${CHANNEL_KEY}",
        paymentId: "${paymentId}",
        orderName: "보드웨이 포인트 ${amount}P",
        totalAmount: ${amount},
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: { customerId: "${user?.id}" }
      });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(response));
      }
    } catch (e) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ code: "ERROR", message: e.message }));
      }
    }
  }
  window.onload = startPayment;
</script>
</body>
</html>`;

  const handleMessage = async (event) => {
    let result;
    try {
      result = JSON.parse(event.nativeEvent.data);
    } catch {
      navigation.goBack();
      return;
    }

    if (result.code === 'PAYMENT_CANCELLED') {
      navigation.goBack();
      return;
    }
    if (result.code && result.code !== 'PAYMENT_DONE') {
      navigation.goBack();
      notify('결제 실패', result.message || '결제에 실패했습니다.');
      return;
    }

    const ok = await verifyAndRechargePoints(result.paymentId || paymentId, amount);
    navigation.goBack();
    if (ok) {
      notify('충전 완료', `${amount.toLocaleString()} 포인트가 충전되었습니다.`);
    } else {
      notify('충전 실패', '결제 검증에 실패했습니다. 고객센터에 문의해주세요.');
    }
  };

  return (
    <WebView
      source={{ html, baseUrl: 'https://portone.io' }}
      onMessage={handleMessage}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>결제창을 불러오는 중...</Text>
        </View>
      )}
      javaScriptEnabled
      domStorageEnabled
    />
  );
}

export default function PaymentWebViewScreen({ route, navigation }) {
  const { amount } = route.params;
  const { user, verifyAndRechargePoints } = useContext(AuthContext);

  // user가 없으면 결제 불가 — 로그인 전 진입 방어
  const paymentId = React.useMemo(
    () => `BOARDWAY-${user?.id || 0}-${Date.now()}`,
    [user?.id]
  );

  useEffect(() => {
    if (!user) {
      notify('알림', '로그인이 필요합니다.');
      navigation.goBack();
    }
  }, [user]);

  if (!user) return null;

  const props = { amount, user, verifyAndRechargePoints, navigation, paymentId };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕ 취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>포인트 충전</Text>
        <View style={{ width: 60 }} />
      </View>
      {Platform.OS === 'web'
        ? <PaymentWebScreen {...props} />
        : <PaymentNativeScreen {...props} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A2A3A' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 14, color: '#888' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#888' },
});
