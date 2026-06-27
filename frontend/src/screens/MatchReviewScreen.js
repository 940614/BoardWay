import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { AuthContext } from '../context/AuthContext';
import { notify } from '../utils/dialog';

export default function MatchReviewScreen({ route, navigation }) {
  const { match } = route.params;
  const { user, submitMatchReviews } = useContext(AuthContext);

  const participants = match.participants.filter(p => p.nickname !== user.nickname);
  const hostNickname = match.host;
  const isUserHost = hostNickname === user.nickname;

  const [ratings, setRatings] = useState({});
  const [comment, setComment] = useState('');

  const handleRating = (nickname, score) => {
    setRatings(prev => ({ ...prev, [nickname]: score }));
  };

  const handleSubmit = async () => {
    // 방장이 완료 처리한 시점부터 30분 동안만 평가 가능
    const completedAt = match.completed_at ? new Date(match.completed_at) : null;
    const reviewDeadline = completedAt
      ? new Date(completedAt.getTime() + 30 * 60 * 1000)
      : null;
    const now = new Date();

    if (!completedAt) {
      notify('평가 대기', '방장이 매칭 완료를 확인한 뒤 평가할 수 있습니다.');
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

    // {nickname: score} 객체 → [{reviewee_nickname, rating}] 배열 변환
    const reviewItems = Object.entries(ratings).map(([nickname, rating]) => ({
      reviewee_nickname: nickname,
      rating,
    }));

    const result = await submitMatchReviews(match.id, reviewItems, comment);
    if (!result.success) {
      notify('리뷰 제출 실패', result.message);
      return;
    }

    // 방장 리워드 로직 (데모용 가상 로직)
    if (isUserHost) {
      notify('리뷰 완료', '리뷰를 남겨주셔서 감사합니다!\n모든 참여자의 리뷰가 완료되거나 제한시간이 지나면 방장 리워드가 정산됩니다.');
    } else {
      notify('리뷰 완료', '리뷰를 남겨주셔서 감사합니다! 소중한 의견이 매너 주사위에 반영됩니다.');
    }
    navigation.goBack();
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

        <View style={styles.commentSection}>
          <Text style={styles.sectionTitle}>기타 의견 (선택)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="함께 게임하며 즐거웠던 점이나 아쉬웠던 점을 남겨주세요."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity style={commonStyles.button} onPress={handleSubmit}>
          <Text style={commonStyles.buttonText}>리뷰 제출하기</Text>
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
  commentSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  commentInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    height: 120,
    textAlignVertical: 'top',
  }
});
