import React, { useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { MatchContext } from '../context/MatchContext';
import { AuthContext } from '../context/AuthContext';
import { confirmAction, notify } from '../utils/dialog';
import { apiFetch } from '../utils/api';

const hiddenChatKey = (userId) => `hiddenMatchChats:${userId || 'guest'}`;

const parseChatTime = (value) => {
  if (!value) return 0;
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const timestamp = new Date(hasTimezone ? value : `${value}Z`).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export default function ChatListScreen({ navigation }) {
  const { matches } = useContext(MatchContext);
  const { user, token } = useContext(AuthContext);
  const [hiddenChatIds, setHiddenChatIds] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);
  const [chatRoomsLoaded, setChatRoomsLoaded] = useState(false);

  const loadHiddenChats = useCallback(async () => {
    if (!user) {
      setHiddenChatIds([]);
      return;
    }
    try {
      const saved = await AsyncStorage.getItem(hiddenChatKey(user.id || user.email || user.nickname));
      setHiddenChatIds(saved ? JSON.parse(saved) : []);
    } catch (error) {
      setHiddenChatIds([]);
    }
  }, [user]);

  const loadChatRooms = useCallback(async () => {
    if (!token) {
      setChatRooms([]);
      setChatRoomsLoaded(false);
      return;
    }
    try {
      const response = await apiFetch('/my-match-chat-rooms', { token });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || '채팅방 목록을 불러오지 못했습니다.');
      setChatRooms(data.matches || []);
      setChatRoomsLoaded(true);
    } catch {
      // 배포 전·통신 오류 상황에서는 기존 매치 목록으로 안전하게 표시한다.
      setChatRoomsLoaded(false);
    }
  }, [token]);

  const loadScreen = useCallback(async () => {
    await Promise.all([loadHiddenChats(), loadChatRooms()]);
  }, [loadHiddenChats, loadChatRooms]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadScreen);
    loadScreen();
    return unsubscribe;
  }, [navigation, loadScreen]);

  const hideChatRoom = (match) => {
    confirmAction(
      '채팅방 나가기',
      '이 채팅방에서 나갈까요? 채팅 기록은 삭제되지 않으며, 매칭 상세 페이지에서 다시 들어올 수 있습니다.',
      async () => {
        const next = Array.from(new Set([...hiddenChatIds, match.id]));
        setHiddenChatIds(next);
        await AsyncStorage.setItem(hiddenChatKey(user.id || user.email || user.nickname), JSON.stringify(next));
        notify('채팅방 나가기 완료', '채팅방에서 나갔습니다. 매칭 상세 페이지에서 다시 들어올 수 있어요.');
      },
      { confirmText: '나가기', destructive: true },
    );
  };

  // 최신 메시지가 있는 방을 우선하고, 메시지가 없다면 방이 만들어진(첫 참가자가 등록된) 시각순으로 표시한다.
  const fallbackMatches = matches.filter(match =>
    user && match.participants.some(p => p.nickname === user.nickname)
  );
  const participatingMatches = chatRoomsLoaded ? chatRooms : fallbackMatches;
  const myMatches = participatingMatches
    .filter(match => !hiddenChatIds.includes(match.id))
    .sort((a, b) => (
      parseChatTime(b.last_message_at || b.chat_created_at)
      - parseChatTime(a.last_message_at || a.chat_created_at)
    ));
  const hasHiddenChats = participatingMatches.length > 0 && myMatches.length === 0;

  const renderChatItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => navigation.navigate('ChatRoom', { match: item })}
    >
      <View style={styles.avatarContainer}>
        <Ionicons name="people-circle" size={50} color={colors.primary} />
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.matchTitle} numberOfLines={1}>
            [{item.location.branch}] {item.games.join(', ')}
          </Text>
          {item.host && (
            <View style={styles.chatHostBadge}>
              <Text style={styles.chatHostText}>👑 {item.host}</Text>
            </View>
          )}
          <Text style={styles.timeText}>{item.startTime}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message
            ? `${item.last_message.sender_nickname}: ${item.last_message.content}`
            : '매치 참여자들과 인사를 나눠보세요! 👋'}
        </Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{item.participants.length}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteChatBtn}
        onPress={() => hideChatRoom(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="exit-outline" size={18} color={colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>채팅</Text>
      </View>

      {myMatches.length > 0 ? (
        <FlatList
          data={myMatches}
          renderItem={renderChatItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={80} color={colors.border} />
          <Text style={styles.emptyText}>
            {hasHiddenChats ? '나간 채팅방은 매칭 상세 페이지에서 다시 들어갈 수 있습니다.' : '참여 중인 매치가 없습니다.'}
          </Text>
          <TouchableOpacity 
            style={styles.goMatchBtn}
            onPress={() => navigation.navigate('Discovery')}
          >
            <Text style={styles.goMatchBtnText}>매치 찾아보기</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 하단 탭 네비게이션 바 */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Discovery')}>
          <Ionicons name="home-outline" size={24} color={colors.textLight} />
          <Text style={styles.tabText}>홈</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('GameSearch')}>
          <Ionicons name="search-outline" size={24} color={colors.textLight} />
          <Text style={styles.tabText}>검색</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('MyMatches')}>
          <Ionicons name="list-outline" size={24} color={colors.textLight} />
          <Text style={styles.tabText}>내 매치</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="chatbubbles" size={24} color={colors.primary} />
          <Text style={[styles.tabText, { color: colors.primary }]}>채팅</Text>
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
  listContent: {
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '50',
  },
  avatarContainer: {
    marginRight: 15,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  matchTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: colors.textLight,
  },
  lastMessage: {
    fontSize: 14,
    color: colors.textLight,
  },
  badge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  deleteChatBtn: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEA',
  },
  chatHostBadge: {
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 10,
  },
  chatHostText: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    color: colors.textLight,
    marginTop: 20,
    fontWeight: '600',
  },
  goMatchBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 25,
  },
  goMatchBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
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
