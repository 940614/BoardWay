import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { AuthContext } from '../context/AuthContext';
import { notify } from '../utils/dialog';
import { apiFetch } from '../utils/api';

export default function MatchReviewScreen({ route, navigation }) {
  const { match } = route.params;
  const { user, token, submitMatchReviews } = useContext(AuthContext);

  const participants = match.participants.filter(p => p.nickname !== user.nickname);
  const hostNickname = match.host;

  const [ratings, setRatings] = useState({});
  const [reviewSaved, setReviewSaved] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportCategory, setReportCategory] = useState('노쇼');
  const [reportContent, setReportContent] = useState('');

  const reportableParticipants = participants.filter((participant) => participant.user_id);

  const handleRating = (nickname, score) => {
    setRatings(prev => ({ ...prev, [nickname]: score }));
  };

  const handleSubmit = async () => {
    if (reviewSaved) {
      const retryResult = await submitSelectedReport(reportContent.trim());
      if (!retryResult) return;
      notify('신고 접수 완료', '신고가 운영진에게 전달되었습니다.');
      goToMyMatches();
      return;
    }

    // 방장이 완료 처리한 시점부터 30분 동안만 평가 가능
    const completedAt = match.completed_at ? new Date(match.completed_at) : null;
    const reviewDeadline = completedAt
      ? new Date(completedAt.getTime() + 30 * 60 * 1000)
      : null;
    const now = new Date();

    if (!completedAt) {
      notify('평가 대기', '방장 또는 운영진이 매칭을 완료 처리한 뒤 평가할 수 있습니다.');
      navigation.goBack();
      return;
    }

    if (now > reviewDeadline) {
      notify('리뷰 기간 만료', '매칭 완료 후 30분이 경과하여 리뷰를 남길 수 없습니다. (매너 주사위 및 리워드에 반영되지 않습니다)');
      navigation.goBack();
      return;
    }

    if (Object.keys(ratings).length < participants.length) {
      notify('알림', '모든 참여자에 대한 리뷰를 남겨주세요.');
      return;
    }
    const reportText = reportContent.trim();
    if (reportTarget && reportText.length < 5) {
      notify('신고 내용 확인', '신고를 선택했다면 상황을 5자 이상 구체적으로 작성해주세요.');
      return;
    }
    if (!reportTarget && reportText) {
      notify('신고 대상 선택', '신고 내용을 작성했다면 신고할 참여자를 선택해주세요.');
      return;
    }

    // {nickname: score} 객체 → [{reviewee_nickname, rating}] 배열 변환
    const reviewItems = Object.entries(ratings).map(([nickname, rating]) => ({
      reviewee_nickname: nickname,
      rating,
    }));

    const result = await submitMatchReviews(match.id, reviewItems, '');
    if (!result.success) {
      notify('리뷰 제출 실패', result.message);
      return;
    }

    if (reportTarget) {
      setReviewSaved(true);
      const reportResult = await submitSelectedReport(reportText);
      if (!reportResult) return;
      notify('평가 및 신고 접수 완료', '매너 평가와 신고가 운영진에게 전달되었습니다.');
    } else {
      notify('리뷰 완료', '매너 평가가 등록되었습니다.');
    }
    goToMyMatches();
  };

  const goToMyMatches = () => {
    navigation.reset({ index: 0, routes: [{ name: 'MyMatches' }] });
  };

  const submitSelectedReport = async (content) => {
    try {
      const response = await apiFetch('/reports', {
        method: 'POST',
        token,
        json: {
          reported_user_id: reportTarget.user_id,
          match_id: match.id,
          category: reportCategory,
          content,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify('신고 접수 실패', data.detail || '신고를 접수하지 못했습니다.');
        return false;
      }
      return true;
    } catch (error) {
      notify('오류', '서버와 연결할 수 없습니다.');
      return false;
    }
  };

  const renderRatingStars = (nickname) => {
    const currentRating = ratings[nickname] || 0;
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5, 6].map((num) => (
          <TouchableOpacity key={num} onPress={() => handleRating(nickname, num)}>
            <Ionicons 
              name={currentRating >= num ? "dice" : "dice-outline"} 
              size={32} 
              color={currentRating >= num ? colors.primary : colors.border} 
              style={{ marginRight: 4 }}
            />
          </TouchableOpacity>
        ))}
        <Text style={styles.ratingValue}>{currentRating}점</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>매치 리뷰 남기기</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.matchSummary}>
          <Text style={styles.matchDate}>{match.date} 매치</Text>
          <Text style={styles.matchTitle}>[{match.location.branch}] {match.games.join(', ')}</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            즐거운 시간 보내셨나요? 함께 플레이한 분들에게 매너 점수를 남겨주세요. 
            정확한 리뷰는 보드웨이 커뮤니티 건강에 큰 도움이 됩니다!
          </Text>
        </View>

        {participants.map((p) => (
          <View key={p.nickname} style={styles.reviewCard}>
            <View style={styles.participantHeader}>
              <Text style={styles.participantName}>{p.nickname}님</Text>
              {hostNickname === p.nickname && <Text style={styles.hostBadge}>👑 방장</Text>}
            </View>
            {renderRatingStars(p.nickname)}
          </View>
        ))}

        <View style={styles.inlineReportSection}>
          <View style={styles.inlineReportHeader}>
            <Ionicons name="shield-outline" size={21} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.inlineReportTitle}>신고합니다 <Text style={styles.optionalText}>(선택)</Text></Text>
              <Text style={styles.inlineReportDesc}>운영진 확인이 필요한 참여자가 있다면 평가와 함께 신고를 접수할 수 있습니다. 신고할 일이 없다면 비워두고 제출하세요.</Text>
            </View>
          </View>

          <Text style={styles.reportLabel}>신고할 참여자</Text>
          <View style={styles.targetWrap}>
            {reportableParticipants.map((participant) => {
              const selected = reportTarget?.user_id === participant.user_id;
              return (
                <TouchableOpacity
                  key={participant.user_id}
                  onPress={() => {
                    setReportTarget(selected ? null : participant);
                    if (selected) setReportContent('');
                  }}
                  style={[styles.targetChip, selected && styles.targetChipSelected]}
                >
                  <Text style={[styles.targetChipText, selected && styles.targetChipTextSelected]}>{participant.nickname}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {reportTarget && (
            <>
              <Text style={styles.reportLabel}>신고 사유</Text>
              <View style={styles.targetWrap}>
                {['노쇼', '부적절한 언행', '괴롭힘', '사기·금전 요구', '기타'].map((category) => {
                  const selected = reportCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      onPress={() => setReportCategory(category)}
                      style={[styles.targetChip, selected && styles.reportCategorySelected]}
                    >
                      <Text style={[styles.targetChipText, selected && styles.targetChipTextSelected]}>{category}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.reportLabel}>상황 설명</Text>
              <TextInput
                value={reportContent}
                onChangeText={setReportContent}
                multiline
                maxLength={1000}
                textAlignVertical="top"
                style={styles.reportInput}
                placeholder="언제, 어떤 상황이 있었는지 구체적으로 작성해주세요."
                placeholderTextColor={colors.textLight}
              />
              <Text style={styles.counter}>{reportContent.length}/1000</Text>
            </>
          )}
        </View>

        <TouchableOpacity style={commonStyles.button} onPress={handleSubmit}>
          <Text style={commonStyles.buttonText}>{reviewSaved ? '신고 다시 접수하기' : reportTarget ? '평가와 신고 제출하기' : '리뷰 제출하기 · 신고 건너뛰기'}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  matchSummary: {
    marginBottom: 24,
  },
  matchDate: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 4,
  },
  matchTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  infoBox: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inlineReportSection: { backgroundColor: '#FFF7F7', borderColor: '#FECACA', borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 24 },
  inlineReportHeader: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  inlineReportTitle: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  optionalText: { color: colors.textLight, fontSize: 13 },
  inlineReportDesc: { color: colors.textLight, fontSize: 13, lineHeight: 19 },
  reportLabel: { color: colors.text, fontSize: 14, fontWeight: 'bold', marginTop: 16, marginBottom: 9 },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  participantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  hostBadge: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: 'bold',
    marginLeft: 8,
    backgroundColor: colors.secondary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  successBox: { flexDirection: 'row', gap: 12, backgroundColor: '#ECFDF3', borderColor: '#BBF7D0', borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  successTitle: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  successText: { color: colors.textLight, fontSize: 13, lineHeight: 19 },
  reportNotice: { flexDirection: 'row', gap: 10, backgroundColor: '#FFF7F7', borderColor: '#FECACA', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 24 },
  reportNoticeText: { flex: 1, color: colors.textLight, fontSize: 13, lineHeight: 19 },
  targetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  targetChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: colors.surface },
  targetChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  reportCategorySelected: { backgroundColor: colors.error, borderColor: colors.error },
  targetChipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  targetChipTextSelected: { color: '#FFFFFF' },
  reportInput: { minHeight: 150, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 15, lineHeight: 22, backgroundColor: colors.surface },
  counter: { textAlign: 'right', color: colors.textLight, marginTop: 6, fontSize: 12 },
  reportSubmitButton: { minHeight: 54, borderRadius: 14, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  reportSubmitText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  disabledButton: { opacity: 0.55 },
  skipButton: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: colors.surface },
  skipText: { color: colors.primary, fontSize: 15, fontWeight: 'bold' },
});
