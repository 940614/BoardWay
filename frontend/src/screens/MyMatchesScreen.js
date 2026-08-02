import React, { useState, useContext, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { MatchContext } from '../context/MatchContext';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { notify, confirmAction } from '../utils/dialog';

// 달력 한국어 설정
LocaleConfig.locales['kr'] = {
  monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘'
};
LocaleConfig.defaultLocale = 'kr';

const WEEKEND_TEXT_COLORS = {
  sunday: '#E74C3C',
  saturday: '#3498DB',
};

// 이전 서버 응답에는 UTC 시각에 시간대 표기가 없었다. 이 경우 브라우저가
// 한국 시간으로 해석해 신청 후 경과 시간이 9시간 크게 보일 수 있으므로 UTC로 보정한다.
const parseJoinedAt = (value) => {
  if (!value) return null;
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
};

export default function MyMatchesScreen({ navigation }) {
  const { matches, leaveMatch, cancelMatch, completeMatch, fetchMatches } = useContext(MatchContext);
  const { user, reviewedMatches, notifications } = useContext(AuthContext);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // 완료 알림을 확인하거나 이 화면으로 돌아오면 서버의 최신 상태를 다시 받아
  // 운영진 완료 처리된 매치의 평가 버튼이 즉시 표시되도록 합니다.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchMatches?.();
    });
    return unsubscribe;
  }, [navigation, fetchMatches]);

  // 다른 참여자가 매칭 목록을 보고 있는 중에도 완료 처리 알림이 도착하면
  // 최신 완료 상태를 받아 평가 버튼을 표시합니다. (알림은 5초마다 갱신됩니다.)
  const latestEvaluationNotificationId = useMemo(() => {
    const latest = (notifications || []).find(
      (notification) => notification.type === 'manner_evaluation_started',
    );
    return latest?.id || null;
  }, [notifications]);

  useEffect(() => {
    if (latestEvaluationNotificationId) {
      fetchMatches?.();
    }
  }, [latestEvaluationNotificationId]);

  const handleLeave = (match) => {
    let refundAmount = 12000;
    let refundDesc = "신청 후 1시간 이내 취소로 12,000P가 100% 환불됩니다.";
    if (user && match.participants) {
      const myPart = match.participants.find(p => p.nickname === user.nickname);
      if (myPart && myPart.joined_at) {
        const joinedAt = parseJoinedAt(myPart.joined_at);
        const matchStart = new Date(`${match.date}T${match.startTime}:00`);
        const now = new Date();
        const timeToStartMs = matchStart.getTime() - now.getTime();
        const timeSinceJoinMs = now.getTime() - joinedAt.getTime();
        
        if (timeToStartMs < 30 * 60 * 1000) {
          refundAmount = 0;
          refundDesc = "매칭 시작까지 30분 미만으로 남아 포인트 환불이 불가능합니다.";
        } else if (timeSinceJoinMs <= 60 * 60 * 1000) {
          refundAmount = 12000;
          refundDesc = "신청 후 1시간 이내 취소로 12,000P가 100% 환불됩니다.";
        } else {
          refundAmount = 2400;
          refundDesc = "신청 후 1시간이 지나 취소 시 20%만 인정되어 2,400P가 환불됩니다.";
        }
      }
    }

    confirmAction(
      '참여 취소',
      `정말 매칭 참여를 취소하시겠습니까?\n(${refundDesc})`,
      async () => {
        const result = await leaveMatch(match.id);
        if (result.success) {
          const finalRefunded = result.refunded !== undefined ? result.refunded : refundAmount;
          if (finalRefunded > 0) {
            notify('환불 완료', `${finalRefunded.toLocaleString()}P 가 환불되었습니다.`);
          } else {
            notify('취소 완료', '참여 취소가 완료되었습니다. (환불 금액 없음)');
          }
        } else {
          notify('오류', result.message);
        }
      },
      { confirmText: '취소하기', destructive: true },
    );
  };

  const handleHostCancel = (match) => {
    confirmAction(
      '매치 취소 (방장)',
      `방장 권한으로 이 매치를 취소하시겠습니까?\n\n⚠️ 방장 책임 규정에 따라 개설 시 차감된 참여비(12,000P)는 환불되지 않습니다.\n(참여자 ${match.participants.length - 1}명에게는 전액 자동 환불됩니다.)`,
      async () => {
        const result = await cancelMatch(match.id);
        if (result.success) {
          notify('취소 완료', result.message || '매치가 취소되었습니다.');
        } else {
          notify('오류', result.message);
        }
      },
      { confirmText: '취소하기', destructive: true },
    );
  };

  const handleCompleteMatch = (match) => {
    confirmAction(
      '매칭 완료 확인',
      '모임이 정상적으로 끝났나요? 완료 처리하면 지금부터 30분 동안 모든 참여자의 상호 매너 평가가 시작됩니다. 종료 후 1시간 안에 처리하지 않으면 평가는 자동으로 시작됩니다.',
      async () => {
        const result = await completeMatch(match.id);
        if (result.success) {
          notify('완료 처리', result.message || '상호 매너 평가가 시작되었습니다.');
        } else {
          notify('오류', result.message);
        }
      },
      { confirmText: '완료하고 평가 시작' },
    );
  };

  // 내 매치만 필터링
  const myMatches = useMemo(() => {
    if (!user) return [];
    return matches.filter(match => 
      match.participants.some(p => p.nickname === user.nickname)
    );
  }, [matches, user]);

  // 달력에 표시할 마킹 데이터 생성
  const markedDates = useMemo(() => {
    const marks = {};
    
    // 내 매치가 있는 날짜 표시
    myMatches.forEach(match => {
      if (match.date) {
        marks[match.date] = {
          marked: true,
          dotColor: colors.secondary,
          customStyles: {
            container: {
              backgroundColor: colors.primary + '20',
              borderRadius: 8
            },
            text: {
              color: colors.primary,
              fontWeight: 'bold'
            }
          }
        };
      }
    });

    // 선택된 날짜 강조
    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: 'white'
    };

    return marks;
  }, [myMatches, selectedDate]);

  // 선택된 날짜의 매치 목록
  const selectedDateMatches = useMemo(() => {
    return myMatches
      .filter(match => match.date === selectedDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [myMatches, selectedDate]);

  const renderMatchItem = ({ item }) => {
    const isReviewed = reviewedMatches.includes(item.id);

    const matchStart = new Date(`${item.date}T${item.startTime}:00`);
    const matchEnd = new Date(matchStart.getTime() + 2 * 60 * 60 * 1000);
    const completedAt = item.completed_at ? new Date(item.completed_at) : null;
    const reviewDeadline = completedAt
      ? new Date(completedAt.getTime() + 30 * 60 * 1000)
      : null;
    const now = new Date();

    const isPastMatch = now >= matchEnd;
    const isWithinWindow = !!completedAt && now <= reviewDeadline;
    const isBeforeStart = now < matchStart;
    const isHost = user && item.host === user.nickname;
    const minPlayers = item.minPlayers || 3;
    const hasMinimumPlayers = (item.participants?.length || 0) >= minPlayers;

    return (
      <View style={styles.matchItemContainer}>
        <TouchableOpacity
          style={styles.matchItem}
          onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
        >
          <View style={styles.matchTimeContainer}>
            <Text style={styles.matchTime}>{item.startTime}</Text>
          </View>
          <View style={styles.matchInfo}>
            <Text style={styles.matchGames} numberOfLines={1}>
              {item.games.join(' ➔ ')}
            </Text>
            <Text style={styles.matchLocation}>
              📍 {item.location.venue} {item.location.branch}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
        </TouchableOpacity>

        {item.cancelled ? (
          <View style={[styles.reviewBtn, styles.cancelledBtn]}>
            <Ionicons name="close-circle-outline" size={16} color={colors.error} />
            <Text style={styles.cancelledBtnText}>취소된 매치 (환불 완료)</Text>
          </View>
        ) : !item.completed && isBeforeStart ? (
          (() => {
            if (isHost) {
              return (
                <TouchableOpacity
                  style={[styles.reviewBtn, styles.leaveBtn]}
                  onPress={() => handleHostCancel(item)}
                >
                  <Ionicons name="close-circle-outline" size={16} color={colors.error} />
                  <Text style={styles.leaveBtnText}>매치 취소 (환불 불가)</Text>
                </TouchableOpacity>
              );
            }
            let refundText = "참여 취소 (12,000P 환불)";
            if (user && item.participants) {
              const myPart = item.participants.find(p => p.nickname === user.nickname);
              if (myPart && myPart.joined_at) {
                const joinedAt = parseJoinedAt(myPart.joined_at);
                const timeToStartMs = matchStart.getTime() - now.getTime();
                const timeSinceJoinMs = now.getTime() - joinedAt.getTime();
                
                if (timeToStartMs < 30 * 60 * 1000) {
                  refundText = "참여 취소 (환불 불가)";
                } else if (timeSinceJoinMs <= 60 * 60 * 1000) {
                  refundText = "참여 취소 (12,000P 환불)";
                } else {
                  refundText = "참여 취소 (2,400P 환불)";
                }
              }
            }
            return (
              <TouchableOpacity
                style={[styles.reviewBtn, styles.leaveBtn]}
                onPress={() => handleLeave(item)}
              >
                <Ionicons name="close-outline" size={16} color={colors.error} />
                <Text style={styles.leaveBtnText}>{refundText}</Text>
              </TouchableOpacity>
            );
          })()
        ) : !item.completed && !isPastMatch ? (
          <View style={[styles.reviewBtn, styles.waitingBtn]}>
            <Text style={styles.waitingBtnText}>매치 진행 중...</Text>
          </View>
        ) : !item.completed ? (
          !hasMinimumPlayers ? (
            <View style={[styles.reviewBtn, styles.cancelledBtn]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={styles.cancelledBtnText}>최소 인원 미달로 취소 대상</Text>
            </View>
          ) :
          isHost ? (
            <TouchableOpacity
              style={[styles.reviewBtn, styles.completeBtn]}
              onPress={() => handleCompleteMatch(item)}
            >
              <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" />
              <Text style={styles.reviewBtnText}>매칭 성공적으로 완료</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.reviewBtn, styles.waitingBtn]}>
              <Text style={styles.waitingBtnText}>방장의 매칭 완료 확인을 기다리는 중... (종료 1시간 후 자동으로 평가 시작)</Text>
            </View>
          )
        ) : isReviewed ? (
          <View style={[styles.reviewBtn, styles.reviewedBtn]}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.textLight} />
            <Text style={styles.reviewedBtnText}>리뷰 완료</Text>
          </View>
        ) : isWithinWindow ? (
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => navigation.navigate('MatchReview', { match: item })}
          >
            <Ionicons name="star" size={16} color="#FFFFFF" />
            <Text style={styles.reviewBtnText}>매너 평가하기 (완료 후 30분)</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.reviewBtn, styles.waitingBtn]}>
            <Text style={styles.waitingBtnText}>매너 평가 시간이 종료되었습니다.</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 매치 일정</Text>
      </View>

      <View style={styles.calendarContainer}>
        <Calendar
          onDayPress={day => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          dayComponent={({ date, state, marking }) => {
            const isSelected = date.dateString === selectedDate || marking?.selected;
            const isMarked = marking?.marked;
            const dayOfWeek = new Date(`${date.dateString}T00:00:00`).getDay();
            const weekendColor = dayOfWeek === 0
              ? WEEKEND_TEXT_COLORS.sunday
              : dayOfWeek === 6
                ? WEEKEND_TEXT_COLORS.saturday
                : colors.text;
            const textColor = state === 'disabled'
              ? colors.textLight
              : isSelected
                ? '#FFFFFF'
                : weekendColor;

            return (
              <TouchableOpacity
                disabled={state === 'disabled'}
                onPress={() => setSelectedDate(date.dateString)}
                style={[styles.calendarDay, isSelected && styles.calendarDaySelected]}
              >
                <Text style={[styles.calendarDayText, { color: textColor }]}>
                  {date.day}
                </Text>
                {isMarked && !isSelected && <View style={styles.calendarDot} />}
              </TouchableOpacity>
            );
          }}
          theme={{
            todayTextColor: colors.secondary,
            arrowColor: colors.primary,
            monthTextColor: colors.primary,
            indicatorColor: colors.primary,
            textDayFontWeight: '500',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: 'bold',
          }}
          enableSwipeMonths={true}
        />
      </View>

      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            {selectedDate.split('-')[1]}월 {selectedDate.split('-')[2]}일 일정
          </Text>
          <Text style={styles.matchCount}>{selectedDateMatches.length}건</Text>
        </View>

        {selectedDateMatches.length > 0 ? (
          <FlatList
            data={selectedDateMatches}
            renderItem={renderMatchItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color={colors.border} />
            <Text style={styles.emptyText}>해당 날짜에 참여한 매치가 없습니다.</Text>
          </View>
        )}
      </View>

      {/* 하단 네비게이션 바 (임시 - 나중에 공통 컴포넌트화 권장) */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Discovery')}>
          <Ionicons name="home-outline" size={24} color={colors.textLight} />
          <Text style={styles.tabText}>홈</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('GameSearch')}>
          <Ionicons name="search-outline" size={24} color={colors.textLight} />
          <Text style={styles.tabText}>검색</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="list" size={24} color={colors.primary} />
          <Text style={[styles.tabText, { color: colors.primary }]}>내 매치</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('ChatList')}>
          <Ionicons name="chatbubbles-outline" size={24} color={colors.textLight} />
          <Text style={styles.tabText}>채팅</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('MyPage')}>
          <Ionicons name="person-outline" size={24} color={colors.textLight} />
          <Text style={styles.tabText}>마이페이지</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  calendarContainer: {
    backgroundColor: colors.surface,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  calendarDay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySelected: {
    backgroundColor: colors.primary,
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '600',
  },
  calendarDot: {
    position: 'absolute',
    bottom: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.secondary,
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  matchCount: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: 'bold',
  },
  listContent: {
    paddingBottom: 20,
  },
  matchItemContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    ...commonStyles.shadow,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 10,
    gap: 6,
  },
  reviewBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  completeBtn: {
    backgroundColor: colors.success,
  },
  reviewedBtn: {
    backgroundColor: '#F5F5F5',
  },
  reviewedBtnText: {
    color: colors.textLight,
    fontWeight: 'bold',
    fontSize: 14,
  },
  waitingBtn: {
    backgroundColor: '#F8F9FA',
  },
  waitingBtnText: {
    color: colors.textLight,
    fontSize: 14,
    fontStyle: 'italic',
  },
  cancelledBtn: {
    backgroundColor: '#FFEBEB',
  },
  cancelledBtnText: {
    color: colors.error,
    fontWeight: 'bold',
    fontSize: 14,
  },
  leaveBtn: {
    backgroundColor: '#FFF5F5',
    borderTopWidth: 1,
    borderTopColor: '#FFD7D7',
  },
  leaveBtnText: {
    color: colors.error,
    fontWeight: 'bold',
    fontSize: 14,
  },
  matchTimeContainer: {
    paddingRight: 15,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    marginRight: 15,
  },
  matchTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  matchInfo: {
    flex: 1,
  },
  matchGames: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  matchLocation: {
    fontSize: 13,
    color: colors.textLight,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textLight,
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 24,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 10,
    marginTop: 4,
    color: colors.textLight,
    fontWeight: '500',
  }
});
