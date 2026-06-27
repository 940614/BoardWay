import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { notify } from '../utils/dialog';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';

export default function FriendMatchesScreen({ route, navigation }) {
  const { friend } = route.params;
  const { token } = useContext(AuthContext);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiFetch(`/friends/${friend.user_id}/matches`, { token });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || '친구의 매칭을 불러오지 못했습니다.');
        setMatches(data.matches || []);
      } catch (error) {
        notify('오류', error.message || '친구의 매칭을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [friend.user_id, token]);

  const renderMatch = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.gameText} numberOfLines={1}>
          {item.is_flexible ? '🎲 모여서 게임 선택' : item.games.join(' · ')}
        </Text>
        {item.host === friend.nickname && (
          <View style={styles.hostBadge}>
            <Text style={styles.hostBadgeText}>방장</Text>
          </View>
        )}
      </View>
      <Text style={styles.infoText}>{item.date} {item.startTime}</Text>
      <Text style={styles.infoText}>{item.location.venue} {item.location.branch}</Text>
      <Text style={styles.peopleText}>참여 {item.participants.length}/{item.maxPlayers}명</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{friend.nickname}님의 매칭</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={matches}
          renderItem={renderMatch}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>친구가 신청한 매칭이 없습니다.</Text>
            </View>
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: colors.primary },
  headerSpacer: { width: 44 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  gameText: { flex: 1, fontSize: 16, fontWeight: 'bold', color: colors.text },
  hostBadge: { backgroundColor: '#FFF4CC', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  hostBadgeText: { color: '#7A5B00', fontSize: 11, fontWeight: 'bold' },
  infoText: { color: colors.textLight, fontSize: 13, marginTop: 3 },
  peopleText: { color: colors.primary, fontSize: 13, fontWeight: 'bold', marginTop: 8 },
  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { color: colors.textLight, marginTop: 10 },
});
