import React, { useState, useContext, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, Modal, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { MatchContext } from '../context/MatchContext';
import { AuthContext } from '../context/AuthContext';
import { useResponsiveLayout } from '../theme/responsive';
import { apiFetch } from '../utils/api';

const WEEKEND_TEXT_COLORS = {
  sunday: '#E74C3C',
  saturday: '#3498DB',
};

const GENRES = ['전체', '입문', '전략', '파티', '추리', '마피아', '심리전', '힐링'];
const LOCATIONS = ['전체', '강남', '홍대', '신촌', '건대', '잠실', '노원', '수원', '인천', '분당'];
const TIMES = ['전체', '오전 (12시 이전)', '오후 (12~18시)', '저녁 (18시 이후)'];

export default function DiscoveryScreen({ navigation }) {
  const { isMobile } = useResponsiveLayout();
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [activeDate, setActiveDate] = useState(formatDate(new Date()));
  const [activeGenre, setActiveGenre] = useState('전체');
  const [activeLocation, setActiveLocation] = useState('전체');
  const [activeTime, setActiveTime] = useState('전체');
  const [activeModal, setActiveModal] = useState(null);

  const { matches } = useContext(MatchContext);
  const { user, token, logout, notifications } = useContext(AuthContext);
  const unreadCount = (notifications || []).filter(n => !n.read).length;
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    const loadRecommendations = async () => {
      if (!token) {
        setRecommendations([]);
        return;
      }

      try {
        const response = await apiFetch('/me/recommendations', { token });
        if (!response.ok) return;
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      } catch (error) {
        // 추천을 불러오지 못해도 기존 탐색 기능은 정상적으로 제공한다.
        setRecommendations([]);
      }
    };

    loadRecommendations();
  }, [token, user, matches]);

  const dateList = useMemo(() => {
    const list = [];
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    for (let i = 0; i < 10; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      list.push({
        full: formatDate(d),
        month: d.getMonth() + 1,
        date: d.getDate(),
        day: weekDays[d.getDay()],
        dayIndex: d.getDay(),
        isToday: i === 0,
      });
    }
    return list;
  }, []);

  const matchTimeFilter = (startTime, filter) => {
    if (filter === '전체') return true;
    const hour = parseInt(startTime.split(':')[0], 10);
    if (filter === '오전 (12시 이전)') return hour < 12;
    if (filter === '오후 (12~18시)') return hour >= 12 && hour < 18;
    if (filter === '저녁 (18시 이후)') return hour >= 18;
    return true;
  };

  const filteredMatches = useMemo(() => {
    return matches
      .filter(match => {
        if (match.cancelled) return false;
        const passDate = match.date === activeDate;
        const passGenre = activeGenre === '전체' || match.tags.includes(activeGenre);
        const passLocation = activeLocation === '전체' ||
                             match.location.address.includes(activeLocation) ||
                             match.location.branch.includes(activeLocation);
        const passTime = matchTimeFilter(match.startTime, activeTime);
        return passDate && passGenre && passLocation && passTime;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [matches, activeDate, activeGenre, activeLocation, activeTime]);

  const listItems = useMemo(() => {
    const matchItems = filteredMatches.map(match => ({
      type: 'match',
      id: match.id,
      match,
    }));
    const recommendationItems = recommendations.map(match => ({
      type: 'recommendation',
      id: `recommendation-${match.id}`,
      match,
    }));

    return [
      ...(recommendationItems.length > 0
        ? [{ type: 'recommendationHeader', id: '__recommendationHeader' }, ...recommendationItems]
        : []),
      { type: 'filters', id: '__filters' },
      ...(matchItems.length > 0 ? matchItems : [{ type: 'empty', id: '__empty' }]),
    ];
  }, [filteredMatches, recommendations]);

  const handleFilterSelect = (item) => {
    if (activeModal === 'genre') setActiveGenre(item);
    if (activeModal === 'location') setActiveLocation(item);
    if (activeModal === 'time') setActiveTime(item);
    setActiveModal(null);
  };

  const getModalData = () => {
    if (activeModal === 'genre') return { title: '장르 선택', data: GENRES, active: activeGenre };
    if (activeModal === 'location') return { title: '장소 선택', data: LOCATIONS, active: activeLocation };
    if (activeModal === 'time') return { title: '시간대 선택', data: TIMES, active: activeTime };
    return { title: '', data: [], active: '' };
  };

  const modalData = getModalData();

  const renderDateItem = ({ item }) => {
    const isActive = activeDate === item.full;
    const weekendStyle = item.dayIndex === 0
      ? styles.dateSunday
      : item.dayIndex === 6
        ? styles.dateSaturday
        : null;

    return (
      <TouchableOpacity
        style={[styles.dateItem, isActive && styles.dateItemActive]}
        onPress={() => setActiveDate(item.full)}
      >
        <Text style={[styles.dateDay, weekendStyle, isActive && styles.dateTextActive]}>
          {item.day}
        </Text>
        <Text style={[styles.dateNumber, weekendStyle, isActive && styles.dateTextActive]}>
          {item.date}
        </Text>
        {item.isToday && <View style={[styles.todayDot, isActive && { backgroundColor: colors.primary }]} />}
      </TouchableOpacity>
    );
  };

  const renderMatchCard = ({ item }) => {
    const isFull = item.participants.length >= item.maxPlayers;
    const isMyMatch = user && item.participants.some(p => p.nickname === user.nickname);
    const friendParticipants = item.friend_participants || [];
    
    // 시작 여부 체크
    const matchStart = new Date(`${item.date}T${item.startTime}:00`);
    const now = new Date();
    const isStarted = now > matchStart;
    // 운영진 완료 처리된 매치는 평가만 가능하며, 새 참여 신청은 완전히 마감합니다.
    const isClosed = isFull || isStarted || item.completed;
    
    return (
      <TouchableOpacity 
        style={[
          commonStyles.card, 
          isClosed && styles.cardFull,
          item.is_flexible && { borderLeftColor: '#9B59B6', backgroundColor: isClosed ? '#EAEAEA' : '#FDFBFF' }
        ]}
        onPress={() => !isClosed && navigation.navigate('MatchDetail', { matchId: item.id })}
        activeOpacity={isClosed ? 1 : 0.8}
      >
        {item.recommendation_score > 0 && (
          <View style={styles.recommendationBadge}>
            <Ionicons name="sparkles" size={14} color="#5B3CC4" />
            <Text style={styles.recommendationBadgeText}>AI 추천 {item.recommendation_score}점</Text>
          </View>
        )}
        {isClosed && (
          <View style={styles.overlayFull}>
            <Text style={styles.overlayFullText}>신청 마감</Text>
          </View>
        )}


        
        <View style={[styles.cardHeader, isMobile && styles.cardHeaderMobile]}>
          {item.is_flexible ? (
            <View style={{ flex: 1 }}>
              <View style={[styles.flexibleBadge, isClosed && { backgroundColor: colors.textLight }]}>
                <Text style={styles.flexibleBadgeText}>자율성 매치</Text>
              </View>
              <Text style={[styles.gameName, isClosed && styles.textFull, { color: isClosed ? '#888888' : '#9B59B6', marginTop: 4 }]} numberOfLines={2}>
                🎲 모여서 게임 선택
              </Text>
            </View>
          ) : (
            <Text style={[styles.gameName, isClosed && styles.textFull]} numberOfLines={2}>
              {item.games.join(' ➔ ')}
            </Text>
          )}
          {isClosed && (
            <View style={styles.closedBadge}>
              <Text style={styles.closedBadgeText}>신청 마감</Text>
            </View>
          )}
          {item.host && (
            <View style={styles.hostBadgeCard}>
              <Text style={styles.hostBadgeCardText}>👑 {item.host}</Text>
            </View>
          )}
          {isMyMatch && (
            <View style={styles.myMatchBadge}>
              <Text style={styles.myMatchBadgeText}>✓ 내 매치</Text>
            </View>
          )}
          {!isMyMatch && friendParticipants.length > 0 && (
            <View style={styles.friendMatchBadge}>
              <Text style={styles.friendMatchBadgeText}>친구가 신청한 매칭</Text>
            </View>
          )}
          <Text style={[styles.difficulty, isClosed && styles.textFull]}>난이도: {item.difficulty}</Text>
        </View>
        
        <View style={styles.locationContainer}>
          <Ionicons name="location-outline" size={16} color={colors.textLight} style={{ marginRight: 4 }} />
          <Text style={[styles.locationText, isClosed && styles.textFull]} numberOfLines={1}>
            {item.location.venue} {item.location.branch}
          </Text>
        </View>

        <View style={styles.tagsContainer}>
          {item.tags.map((tag, index) => (
            <View key={index} style={[styles.tag, isClosed && styles.tagFull]}>
              <Text style={[styles.tagText, isClosed && styles.textFull]}>{tag}</Text>
            </View>
          ))}
        </View>

        {item.recommendation_reasons?.length > 0 && (
          <Text style={styles.recommendationReason} numberOfLines={1}>
            추천 이유: {item.recommendation_reasons.join(' · ')}
          </Text>
        )}

        <View style={[styles.cardFooter, isMobile && styles.cardFooterMobile]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="time-outline" size={16} color={colors.textLight} />
            <Text style={[styles.timeText, isClosed && styles.textFull]}>시작: {item.startTime} · 정규 2시간</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={16} color={isClosed ? colors.textLight : colors.primary} />
            <Text style={[styles.playersText, isClosed && styles.textFull, { color: isClosed ? colors.textLight : colors.primary }]}>모집: {item.participants.length}/{item.maxPlayers}명 (최소 {item.minPlayers || 3}명)</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const FilterBar = () => (
    <View style={styles.filterSection}>
      <TouchableOpacity style={styles.filterDropdownBtn} onPress={() => setActiveModal('genre')}>
        <Text style={styles.filterBtnLabel}>장르 ▾</Text>
        <Text style={styles.filterBtnValue} numberOfLines={1}>{activeGenre}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.filterDropdownBtn} onPress={() => setActiveModal('location')}>
        <Text style={styles.filterBtnLabel}>장소 ▾</Text>
        <Text style={styles.filterBtnValue} numberOfLines={1}>{activeLocation}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.filterDropdownBtn} onPress={() => setActiveModal('time')}>
        <Text style={styles.filterBtnLabel}>시간 ▾</Text>
        <Text style={styles.filterBtnValue} numberOfLines={1}>{activeTime}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDiscoveryItem = ({ item }) => {
    if (item.type === 'recommendationHeader') {
      return (
        <View style={styles.recommendationHeader}>
          <View style={styles.recommendationTitleRow}>
            <Ionicons name="sparkles" size={20} color="#6B46C1" />
            <Text style={styles.recommendationTitle}>나를 위한 AI 매칭 추천</Text>
          </View>
          <Text style={styles.recommendationSubtitle}>프로필 선호 조건과 잘 맞는 모집 중 매치예요.</Text>
        </View>
      );
    }
    if (item.type === 'recommendation') return renderMatchCard({ item: item.match });
    if (item.type === 'filters') return <FilterBar />;
    if (item.type === 'empty') {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>해당 날짜와 조건에 맞는 매치가 없습니다.</Text>
          <Text style={styles.emptySubText}>다른 날짜를 선택해보세요!</Text>
        </View>
      );
    }
    return renderMatchCard({ item: item.match });
  };

  const ListHeader = () => (
    <>
      <View style={styles.headerContainer}>
        <View style={styles.headerTextWrap}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.mainTitle}>보드게임을 즐기는</Text>
              <Text style={styles.mainTitleBold}>가장 빠른 길</Text>
            </View>
            <View style={styles.headerRight}>
              {user && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Notifications')}
                  style={styles.bellBtn}
                >
                  <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
                  {unreadCount > 0 && (
                    <View style={styles.bellBadge}>
                      <Text style={styles.bellBadgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              {user ? (
                <TouchableOpacity onPress={logout} style={styles.authBtn}>
                  <Text style={styles.authBtnText}>{user.nickname}님 (로그아웃)</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.authBtn}>
                  <Text style={styles.authBtnText}>로그인 해주세요 ➔</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* 날짜 선택 섹션 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled={true}
          contentContainerStyle={styles.dateListContent}
          style={styles.dateSelectorContainer}
        >
          {dateList.map(item => renderDateItem({ item }))}
        </ScrollView>
      </View>

    </>
  );

  return (
    <SafeAreaView style={commonStyles.container}>
      <FlatList
        data={listItems}
        renderItem={renderDiscoveryItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeader}
        stickyHeaderIndices={recommendations.length > 0 ? [recommendations.length + 2] : [1]}
        style={styles.matchList}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* 동적 Bottom Sheet 모달 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={activeModal !== null}
        onRequestClose={() => setActiveModal(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPressOut={() => setActiveModal(null)}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>{modalData.title}</Text>
            </View>
            {modalData.data.map(item => (
              <TouchableOpacity 
                key={item} 
                style={[
                  styles.bottomSheetItem, 
                  modalData.active === item && styles.bottomSheetItemActive
                ]}
                onPress={() => handleFilterSelect(item)}
              >
                <Text style={[
                  styles.bottomSheetItemText,
                  modalData.active === item && styles.bottomSheetItemTextActive
                ]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 하단 탭 네비게이션 바 */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="home" size={24} color={colors.primary} />
          <Text style={[styles.tabText, { color: colors.primary }]}>홈</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('GameSearch')}>
          <Ionicons name="search-outline" size={24} color={colors.textLight} />
          <Text style={styles.tabText}>검색</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('MyMatches')}>
          <Ionicons name="list-outline" size={24} color={colors.textLight} />
          <Text style={styles.tabText}>내 매치</Text>
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

      {user && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateMatch')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  recommendationHeader: {
    backgroundColor: '#F5F1FF',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8DFFF',
  },
  recommendationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  recommendationTitle: {
    color: '#3B2A72',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recommendationSubtitle: {
    marginTop: 5,
    color: '#6F648D',
    fontSize: 13,
  },
  recommendationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#EEE7FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  recommendationBadgeText: {
    color: '#5B3CC4',
    fontSize: 12,
    fontWeight: 'bold',
  },
  recommendationReason: {
    color: '#685985',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -5,
    marginBottom: 13,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 88,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  headerContainer: {
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingTop: 16,
  },
  headerTextWrap: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  mainTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    opacity: 0.85,
    userSelect: 'none',
  },
  mainTitleBold: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.secondary,
    marginTop: 4,
    userSelect: 'none',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  authBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  authBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  dateSelectorContainer: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  dateListContent: {
    paddingHorizontal: 16,
  },
  dateItem: {
    width: 50,
    height: 65,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dateItemActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  dateDay: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  dateNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  dateSunday: {
    color: WEEKEND_TEXT_COLORS.sunday,
  },
  dateSaturday: {
    color: WEEKEND_TEXT_COLORS.saturday,
  },
  dateTextActive: {
    color: colors.primary,
  },
  todayDot: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  filterSection: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.background,
    gap: 8,
    zIndex: 5,
    elevation: 5,
  },
  filterDropdownBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 4,
  },
  filterBtnValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textLight,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 132,
    flexGrow: 1,
  },
  matchList: {
    flex: 1,
  },
  cardFull: {
    opacity: 0.6,
    backgroundColor: '#EAEAEA',
  },
  overlayFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 12,
  },
  overlayFullText: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.error,
    transform: [{ rotate: '-15deg' }],
    textShadowColor: 'white',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  cardHeaderMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
  },
  gameName: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  flexibleBadge: {
    backgroundColor: '#9B59B6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  flexibleBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  closedBadge: {
    backgroundColor: '#FDECEA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'center',
  },
  closedBadgeText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: 'bold',
  },
  myMatchBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'center',
  },
  myMatchBadgeText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: 'bold',
  },
  friendMatchBadge: {
    backgroundColor: '#EAF3FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'center',
  },
  friendMatchBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  difficulty: {
    fontSize: 14,
    color: colors.textLight,
    paddingTop: 2,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495E',
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  tag: {
    backgroundColor: colors.secondary + '30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  tagFull: {
    backgroundColor: '#CCCCCC',
  },
  tagText: {
    color: '#D4A000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardFooterMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  timeText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  playersText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: 'bold',
  },
  textFull: {
    color: '#888888',
  },
  hostBadgeCard: {
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#D4AF37',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  hostBadgeCardText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Bottom Sheet Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  bottomSheetHeader: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  bottomSheetItem: {
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bottomSheetItemActive: {
    backgroundColor: colors.primary + '10',
  },
  bottomSheetItemText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '500',
  },
  bottomSheetItemTextActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  // 하단 탭바 스타일
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 24, // 아이폰 홈바 고려
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
