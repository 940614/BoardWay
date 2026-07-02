import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { notify } from '../utils/dialog';

export default function AdminPointGrantScreen({ navigation, route }) {
  const { token, user } = useContext(AuthContext);
  const [userIdentifier, setUserIdentifier] = useState(route?.params?.userIdentifier || '');
  const [amount, setAmount] = useState('50000');
  const [description, setDescription] = useState('운영 테스트 포인트 지급');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const quickAmounts = [12000, 30000, 50000, 100000];
  const targetNickname = route?.params?.nickname;

  useEffect(() => {
    if (route?.params?.userIdentifier) {
      setUserIdentifier(route.params.userIdentifier);
    }
  }, [route?.params?.userIdentifier]);

  const handleSubmit = async () => {
    const trimmedIdentifier = userIdentifier.trim();
    const numericAmount = Number(String(amount).replace(/,/g, '').trim());

    if (!user?.is_admin) {
      notify('권한 없음', '관리자 계정으로만 사용할 수 있습니다.');
      return;
    }
    if (!trimmedIdentifier) {
      notify('입력 필요', '포인트를 지급할 사용자의 이메일 또는 닉네임을 입력해주세요.');
      return;
    }
    if (!Number.isInteger(numericAmount) || numericAmount === 0) {
      notify('입력 오류', '0이 아닌 포인트 금액을 숫자로 입력해주세요.');
      return;
    }

    setSubmitting(true);
    setLastResult(null);
    try {
      const response = await apiFetch('/admin/users/points/adjust', {
        method: 'POST',
        token,
        json: {
          user_identifier: trimmedIdentifier,
          delta: numericAmount,
          description: description.trim() || (numericAmount > 0 ? '관리자 포인트 지급' : '관리자 포인트 차감'),
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        notify('처리 실패', data.detail || '포인트 지급/차감에 실패했습니다.');
        return;
      }

      setLastResult(data);
      notify(
        '처리 완료',
        `${data.nickname}님의 현재 포인트는 ${(data.points || 0).toLocaleString()}P 입니다.`
      );
    } catch (error) {
      console.error('Admin point adjust error:', error);
      notify('오류', '서버와 연결할 수 없습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>포인트 지급 관리</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.noticeCard}>
          <Ionicons name="shield-checkmark-outline" size={28} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>관리자 전용 기능</Text>
            <Text style={styles.noticeText}>
              이메일 또는 닉네임으로 사용자를 찾아 포인트를 지급하거나 차감할 수 있습니다.
              처리 결과는 해당 사용자의 포인트 사용 내역과 알림에 기록됩니다.
            </Text>
          </View>
        </View>

        {targetNickname && (
          <View style={styles.targetCard}>
            <Text style={styles.targetLabel}>선택된 회원</Text>
            <Text style={styles.targetName}>{targetNickname}</Text>
          </View>
        )}

        <View style={styles.formCard}>
          <Text style={styles.label}>사용자 이메일 또는 닉네임</Text>
          <TextInput
            style={styles.input}
            value={userIdentifier}
            onChangeText={setUserIdentifier}
            placeholder="예: user@example.com 또는 닉네임"
            placeholderTextColor={colors.textLight}
            autoCapitalize="none"
          />

          <Text style={styles.label}>지급/차감 포인트</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="예: 50000"
            placeholderTextColor={colors.textLight}
            keyboardType="number-pad"
          />

          <View style={styles.quickAmountRow}>
            {quickAmounts.map((value) => (
              <TouchableOpacity
                key={value}
                style={styles.quickAmountBtn}
                onPress={() => setAmount(String(value))}
              >
                <Text style={styles.quickAmountText}>+{value.toLocaleString()}P</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.deductBtn}
            onPress={() => {
              const numericAmount = Math.abs(Number(String(amount).replace(/,/g, '').trim()) || 12000);
              setAmount(String(-numericAmount));
            }}
          >
            <Ionicons name="remove-circle-outline" size={18} color={colors.error} />
            <Text style={styles.deductBtnText}>현재 금액을 차감으로 바꾸기</Text>
          </TouchableOpacity>

          <Text style={styles.label}>내역 설명</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="예: 베타 테스트 포인트 지급"
            placeholderTextColor={colors.textLight}
            multiline
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                {Number(amount) < 0 ? '포인트 차감하기' : '포인트 지급하기'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {lastResult && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>최근 처리 결과</Text>
            <Text style={styles.resultText}>닉네임: {lastResult.nickname}</Text>
            <Text style={styles.resultText}>이메일: {lastResult.email}</Text>
            <Text style={styles.resultText}>관리자 여부: {lastResult.is_admin ? '관리자' : '일반 회원'}</Text>
            <Text style={styles.resultPoint}>
              현재 포인트: {(lastResult.points || 0).toLocaleString()}P
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F4F7FB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7EDF5',
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 19,
  },
  targetCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DDE5FF',
  },
  targetLabel: {
    color: colors.textLight,
    fontSize: 12,
    marginBottom: 4,
  },
  targetName: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    ...commonStyles.shadow,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  descriptionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickAmountBtn: {
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickAmountText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  deductBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
  },
  deductBtnText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: 'bold',
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 4,
  },
  resultPoint: {
    fontSize: 16,
    color: colors.secondary,
    fontWeight: 'bold',
    marginTop: 4,
  },
});
