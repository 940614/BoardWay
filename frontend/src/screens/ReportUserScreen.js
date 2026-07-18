import React, { useContext, useState } from 'react';
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
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { notify } from '../utils/dialog';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';

const CATEGORIES = ['노쇼', '부적절한 언행', '괴롭힘', '사기·금전 요구', '기타'];

export default function ReportUserScreen({ route, navigation }) {
  const { reportedUserId, reportedNickname, matchId } = route.params || {};
  const { token } = useContext(AuthContext);
  const [category, setCategory] = useState('노쇼');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitReport = async () => {
    if (!matchId) {
      notify('신고할 수 없음', '신고는 같은 매칭에 참여한 사용자에게만 할 수 있습니다. 매칭 상세 페이지에서 신고해주세요.');
      return;
    }
    const trimmedContent = content.trim();
    if (trimmedContent.length < 5) {
      notify('신고 내용 확인', '상황을 5자 이상 구체적으로 작성해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch('/reports', {
        method: 'POST',
        token,
        json: {
          reported_user_id: reportedUserId,
          match_id: matchId,
          category,
          content: trimmedContent,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify('신고 접수 실패', data.detail || '신고를 접수하지 못했습니다.');
        return;
      }
      notify('신고 접수 완료', '운영진이 내용을 검토한 뒤 처리 상태를 알려드립니다.');
      navigation.goBack();
    } catch (error) {
      notify('오류', '서버와 연결할 수 없습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>사용자 신고</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.noticeCard}>
          <Ionicons name="shield-outline" size={30} color={colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>{reportedNickname || '사용자'} 님 신고</Text>
            <Text style={styles.noticeText}>
              성공적으로 완료된 같은 매칭의 참여자만 신고할 수 있습니다. 사실과 다른 신고는 서비스 이용에 제한이 있을 수 있으며, 운영진이 내용과 관련 매칭 정보를 확인합니다.
            </Text>
          </View>
        </View>

        {matchId ? (
          <View style={styles.matchInfo}>
            <Ionicons name="calendar-outline" size={17} color={colors.primary} />
            <Text style={styles.matchInfoText}>관련 매칭: {matchId}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <Text style={styles.label}>신고 사유</Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((item) => {
              const selected = item === category;
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 22 }]}>상황 설명</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            style={styles.contentInput}
            placeholder="언제, 어떤 상황이 있었는지 구체적으로 작성해주세요.\n예: 7월 11일 18시 매칭에서 사전 연락 없이 참석하지 않았습니다."
            placeholderTextColor={colors.textLight}
          />
          <Text style={styles.counter}>{content.length}/1000</Text>
        </View>

        <TouchableOpacity
          onPress={submitReport}
          disabled={submitting}
          style={[styles.submitButton, submitting && styles.disabledButton]}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>신고 접수하기</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 8, paddingVertical: 10 },
  backButton: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.primary, fontSize: 18, fontWeight: 'bold' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  noticeCard: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 18, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  noticeTitle: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  noticeText: { color: colors.textLight, fontSize: 13, lineHeight: 19 },
  matchInfo: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 13, borderRadius: 12, backgroundColor: '#F4F7FB' },
  matchInfoText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  formCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 18, ...commonStyles.shadow },
  label: { color: colors.text, fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#F6F8FB' },
  chipSelected: { backgroundColor: colors.error, borderColor: colors.error },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#FFFFFF' },
  contentInput: { minHeight: 180, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 15, lineHeight: 22, backgroundColor: colors.background },
  counter: { textAlign: 'right', color: colors.textLight, marginTop: 6, fontSize: 12 },
  submitButton: { minHeight: 54, borderRadius: 15, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { opacity: 0.6 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
