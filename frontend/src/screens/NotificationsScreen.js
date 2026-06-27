import React, { useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { AuthContext } from '../context/AuthContext';

const formatRelative = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
};

export default function NotificationsScreen({ navigation }) {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useContext(AuthContext);

  const handleTap = async (notif) => {
    if (!notif.read) await markNotificationRead(notif.id);
    if (['friend_request_received', 'friend_request_accepted', 'friend_message_received'].includes(notif.type)) {
      navigation.navigate('Friends');
    } else if (['manner_evaluation_started', 'match_completion_prompt'].includes(notif.type)) {
      navigation.navigate('MyMatches');
    } else if (notif.match_business_id) {
      navigation.navigate('MatchDetail', { matchId: notif.match_business_id });
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, !item.read && styles.cardUnread]}
      onPress={() => handleTap(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title}</Text>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
      <Text style={styles.body}>{item.body}</Text>
      <Text style={styles.time}>{formatRelative(item.created_at)}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알림</Text>
        <TouchableOpacity onPress={markAllNotificationsRead} style={styles.readAllBtn}>
          <Text style={styles.readAllText}>모두 읽음</Text>
        </TouchableOpacity>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>알림이 없습니다.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => String(n.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: 'bold', color: colors.text, marginLeft: 4 },
  readAllBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  readAllText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  listContent: { padding: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: {
    backgroundColor: '#FFF9E6',
    borderColor: '#FFE082',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: { fontSize: 16, fontWeight: 'bold', color: colors.text, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, marginLeft: 8 },
  body: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 8 },
  time: { fontSize: 12, color: colors.textLight },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.6 },
  emptyText: { marginTop: 10, fontSize: 14, color: colors.textLight },
});
