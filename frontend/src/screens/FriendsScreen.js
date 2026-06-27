import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { notify, confirmAction } from '../utils/dialog';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';

export default function FriendsScreen({ navigation }) {
  const { token, notifications, markNotificationRead } = useContext(AuthContext);
  const [nickname, setNickname] = useState('');
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  const loadFriends = useCallback(async () => {
    if (!token) return;
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        apiFetch('/friends', { token }),
        apiFetch('/friends/requests', { token }),
      ]);
      const friendsData = await friendsRes.json().catch(() => ({}));
      const requestsData = await requestsRes.json().catch(() => ({}));
      if (!friendsRes.ok) throw new Error(friendsData.detail || '친구 목록을 불러오지 못했습니다.');
      if (!requestsRes.ok) throw new Error(requestsData.detail || '친구 신청 목록을 불러오지 못했습니다.');
      setFriends(friendsData.friends || []);
      setIncoming(requestsData.incoming || []);
      setOutgoing(requestsData.outgoing || []);
    } catch (error) {
      notify('오류', error.message || '친구 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const sendRequest = async () => {
    const target = nickname.trim();
    if (!target) {
      notify('닉네임 확인', '친구 신청을 보낼 닉네임을 입력해주세요.');
      return;
    }
    setSending(true);
    try {
      const response = await apiFetch('/friends/requests', {
        method: 'POST',
        token,
        json: { nickname: target },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || '친구 신청을 보내지 못했습니다.');
      setNickname('');
      await loadFriends();
      notify('친구 신청 완료', `${target}님에게 친구 신청을 보냈습니다.`);
    } catch (error) {
      notify('오류', error.message || '친구 신청을 보내지 못했습니다.');
    } finally {
      setSending(false);
    }
  };

  const respondRequest = async (requestId, accept) => {
    try {
      const response = await apiFetch(`/friends/requests/${requestId}/${accept ? 'accept' : 'reject'}`, {
        method: 'POST',
        token,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || '친구 신청을 처리하지 못했습니다.');
      await loadFriends();
      notify(accept ? '친구 등록 완료' : '친구 신청 거절', accept ? '친구 목록에 추가되었습니다.' : '친구 신청을 거절했습니다.');
    } catch (error) {
      notify('오류', error.message || '친구 신청을 처리하지 못했습니다.');
    }
  };

  const removeFriend = (friend) => {
    confirmAction(
      '친구 삭제',
      `${friend.nickname}님을 친구 목록에서 삭제할까요?`,
      async () => {
        const response = await apiFetch(`/friends/${friend.user_id}`, { method: 'DELETE', token });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          notify('오류', data.detail || '친구를 삭제하지 못했습니다.');
          return;
        }
        await loadFriends();
        notify('삭제 완료', '친구 목록에서 삭제했습니다.');
      },
      { confirmText: '삭제', destructive: true },
    );
  };

  const renderIncoming = (item) => (
    <View key={item.id} style={styles.requestCard}>
      <View style={styles.requestTextWrap}>
        <Text style={styles.requestTitle}>{item.requester_nickname}</Text>
        <Text style={styles.requestSub}>친구 신청을 보냈습니다.</Text>
      </View>
      <TouchableOpacity style={styles.acceptBtn} onPress={() => respondRequest(item.id, true)}>
        <Text style={styles.acceptBtnText}>수락</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.rejectBtn} onPress={() => respondRequest(item.id, false)}>
        <Text style={styles.rejectBtnText}>거절</Text>
      </TouchableOpacity>
    </View>
  );

  const getUnreadMessageNotifications = useCallback((friend) => (
    (notifications || []).filter((notif) => (
      !notif.read
      && notif.type === 'friend_message_received'
      && (notif.body || '').startsWith(`${friend.nickname}님`)
    ))
  ), [notifications]);

  const openFriendChat = async (friend) => {
    const unreadMessages = getUnreadMessageNotifications(friend);
    if (unreadMessages.length > 0) {
      await Promise.all(unreadMessages.map((notif) => markNotificationRead(notif.id)));
    }
    navigation.navigate('FriendChat', { friend });
  };

  const renderFriend = ({ item }) => {
    const unreadMessageCount = getUnreadMessageNotifications(item).length;
    return (
      <View style={[styles.friendCard, unreadMessageCount > 0 && styles.friendCardUnread]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.nickname?.[0] || '?'}</Text>
        </View>
        <View style={styles.friendInfo}>
          <View style={styles.friendNameRow}>
            <Text style={styles.friendName}>{item.nickname}</Text>
            {unreadMessageCount > 0 && (
              <View style={styles.newMessagePill}>
                <Text style={styles.newMessagePillText}>새 답장</Text>
              </View>
            )}
          </View>
          <Text style={styles.friendSub}>매너 주사위 {Number(item.mannerScore || 0).toFixed(1)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.iconBtn, styles.messageIconBtn]}
          onPress={() => openFriendChat(item)}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
          {unreadMessageCount > 0 && (
            <View style={styles.messageDot}>
              <Text style={styles.messageDotText}>{unreadMessageCount > 9 ? '9+' : unreadMessageCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('FriendMatches', { friend: item })}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => removeFriend(item)}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
    );
  };

  const ListHeader = (
    <>
      <View style={styles.searchCard}>
        <Text style={styles.sectionTitle}>닉네임으로 친구 신청</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={nickname}
            onChangeText={setNickname}
            placeholder="친구 닉네임 입력"
            placeholderTextColor={colors.textLight}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.sendBtn, sending && styles.disabled]}
            onPress={sendRequest}
            disabled={sending}
          >
            {sending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.sendBtnText}>신청</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {incoming.length > 0 && (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>받은 친구 신청 {incoming.length}</Text>
          {incoming.map(renderIncoming)}
        </View>
      )}

      {outgoing.length > 0 && (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>보낸 친구 신청</Text>
          {outgoing.map((item) => (
            <View key={item.id} style={styles.pendingCard}>
              <Ionicons name="time-outline" size={16} color={colors.textLight} />
              <Text style={styles.pendingText}>{item.addressee_nickname}님 수락 대기 중</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>나의 친구 {friends.length}</Text>
    </>
  );

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>친구</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={friends}
          renderItem={renderFriend}
          keyExtractor={(item) => String(item.user_id)}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>아직 등록된 친구가 없습니다.</Text>
            </View>
          }
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadFriends();
              }}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  backButton: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 19, fontWeight: 'bold', color: colors.primary },
  headerSpacer: { width: 44 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
  },
  sectionBlock: { marginBottom: 18 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.background,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
  disabled: { opacity: 0.6 },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  requestTextWrap: { flex: 1 },
  requestTitle: { fontSize: 15, fontWeight: 'bold', color: colors.text },
  requestSub: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  acceptBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginRight: 6 },
  acceptBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  rejectBtn: { backgroundColor: '#FDECEA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  rejectBtnText: { color: colors.error, fontWeight: 'bold', fontSize: 12 },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  pendingText: { color: colors.textLight, fontSize: 13 },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  friendCardUnread: {
    borderColor: colors.error,
    backgroundColor: '#FFF8F8',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  friendInfo: { flex: 1 },
  friendNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  friendName: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  friendSub: { fontSize: 12, color: colors.textLight, marginTop: 3 },
  iconBtn: { padding: 8, marginLeft: 2 },
  messageIconBtn: { position: 'relative' },
  messageDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  messageDotText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },
  newMessagePill: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  newMessagePillText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyText: { color: colors.textLight, fontSize: 14, marginTop: 8 },
});
