import React, { useContext, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MatchProvider } from './src/context/MatchContext';
import { AuthContext, AuthProvider } from './src/context/AuthContext';
import './src/theme/web.css';

// 모바일 PortOne 결제는 결제사 화면으로 이동했다가 redirectUrl로 돌아옵니다.
// 같은 탭의 sessionStorage에 보관한 결제 정보를 이용해, 복귀한 뒤 충전 검증을
// 한 번만 실행합니다.
function WebPaymentReturnHandler() {
  const { user, loading, verifyAndRechargePoints } = useContext(AuthContext);
  const handledRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || loading || !user || handledRef.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('paymentReturn') !== '1') return;
    handledRef.current = true;

    const clearReturnQuery = () => {
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
    };

    const finishPayment = async () => {
      let pendingPayment;
      try {
        pendingPayment = JSON.parse(window.sessionStorage.getItem('boardway:pending-payment') || 'null');
      } catch {
        pendingPayment = null;
      }

      const paymentId = params.get('paymentId') || pendingPayment?.paymentId;
      const errorCode = params.get('code');

      if (errorCode) {
        window.sessionStorage.removeItem('boardway:pending-payment');
        clearReturnQuery();
        window.alert(`결제에 실패했거나 취소되었습니다. (${params.get('message') || errorCode})`);
        return;
      }

      if (!paymentId || !pendingPayment?.amount) {
        clearReturnQuery();
        window.alert('결제 정보를 확인할 수 없습니다. 고객센터로 문의해주세요.');
        return;
      }

      const ok = await verifyAndRechargePoints(paymentId, pendingPayment.amount);
      window.sessionStorage.removeItem('boardway:pending-payment');
      clearReturnQuery();
      window.alert(ok
        ? `${Number(pendingPayment.amount).toLocaleString()}P 충전이 완료되었습니다.`
        : '결제는 완료되었지만 충전 확인에 실패했습니다. 고객센터로 문의해주세요.');
    };

    finishPayment();
  }, [user, loading, verifyAndRechargePoints]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MatchProvider>
          <NavigationContainer>
            <WebPaymentReturnHandler />
            <AppNavigator />
            <StatusBar style="light" backgroundColor="#1A2A3A" />
          </NavigationContainer>
        </MatchProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
