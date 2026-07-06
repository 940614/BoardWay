import React, { useContext, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { MatchContext } from '../context/MatchContext';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { confirmAction, notify } from '../utils/dialog';

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'recruiting', label: '모집중' },
  { key: 'closed', label: '마감' },
  { key: 'completed', label: '완료' },
  { key: 'cancelled', label: '취소' },
];

const getMatchStatus = (match) => {
  if (match.cancelled) return { key: 'cancelled', label: '취소됨', color: colors.error, bg: '#FEF2F2' };
  if (match.completed) return { key: 'completed', label: '완료', color: colors.secondary, bg: '#ECFDF3' };
  if (match.closed) return { key: 'closed', label: '마감', color: '#8A6A00', bg: '#FFF3BF' };
  return { key: 'recruiting', label: '모집중', color: colors.primary, bg: '#EEF2FF' };
};

const sortMatches = (items) => {
  return [...items].sort((a, b) => {
    const aDate = `${a.date || ''} ${a.startTime || ''}`;
    const bDate = `${b.date || ''} ${b.startTime || ''}`;
    return bDate.localeCompare(aDate);
  });
};

export default function AdminMatchManagementScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const { matches, loading, fetchMatches, cancelMatch } = useContext(MatchContext);
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const stats = useMemo(() => {
    const base = { all: matches.length, recruiting: 0, closed: 0, completed: 0, cancelled: 0 };
    matches.forEach((match) => {
      const status = getMatchStatus(match);
      base[status.key] = (base[status.key] || 0) + 1;
    });
    return base;
  }, [matches]);

  const visibleMatches = useMemo(() => {
    const filtered = activeFilter === 'all'
      ? matches
      : matches.filter((match) => getMatchStatus(match).key === activeFilter);
    return sortMatches(filtered);
  }, [activeFilter, matches]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchMatches?.();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCancelMatch = (match) => {
    if (match.cancelled || match.completed || cancellingId) return;

    const title = '매칭을 취소할까요?';
    const message = [
      `[${(match.games || []).join(' · ') || '자유 선택'}]`,
      '관리자 권한으로 매칭을 취소합니다.',
      '방장을 포함한 모든 참여자에게 환불과 취소 알림이 발송됩니다.',
    ].join('\n');

    confirmAction(title, message, async () => {
      setCancellingId(match.id);
      const result = await cancelMatch(match.id, { asAdmin: true });
      setCancellingId(null);
      if (result.success) {
        notify('취소 완료', result.message || '매칭이 취소되었습니다.');
      } else {
        notify('취소 실패', result.message || '매칭 취소에 실패했습니다.');
      }
    }, {
      confirmText: '취소하기',
      cancelText: '돌아가기',
      destructive: true,
    });
  };

  const renderMatch = ({ item }) => {
    const status = getMatchStatus(item);
    const participantCount = item.participants?.length || 0;
    const canCancel = !item.cancelled && !item.completed;

    return (
      <View style={styles.matchCard}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.gamesText}>{(item.games || []).join(' · ') || '자유 선택'}</Text>
              <Text style={styles.locationText}>
                {item.location?.venue || '장소 미정'} {item.location?.branch || ''}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <InfoItem icon="calendar-outline" label="날짜" value={item.date || '-'} />
            <InfoItem icon="time-outline" label="시간" value={item.startTime || '-'} />
            <InfoItem icon="people-outline" label="참여" value={`${participantCount}/${item.maxPlayers || '-'}`} />
            <InfoItem icon="person-outline" label="방장" value={item.host || '없음'} />
          </View>
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
          >
            <Text style={styles.secondaryButtonText}>상세 보기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cancelButton, !canCancel && styles.disabledButton]}
            disabled={!canCancel || cancellingId === item.id}
            onPress={() => handleCancelMatch(item)}
          >
            {cancellingId === item.id ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.cancelButtonText}>관리자 취소</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>관리자 계정으로만 사용할 수 있습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>매칭 운영 관리</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.backBtn}>
          <Ionicons name="refresh" size={23} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.noticeCard}>
          <Ionicons name="shield-checkmark-outline" size={30} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>관리자 매칭 관리</Text>
            <Text style={styles.noticeText}>
              전체 매칭 상태를 확인하고, 문제가 있는 매칭은 관리자 권한으로 취소할 수 있습니다. 관리자 취소는 방장을 포함해 전원 환불됩니다.
            </Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((filter) => {
            const selected = activeFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                style={[styles.filterChip, selected && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter.key)}
              >
                <Text style={[styles.filterText, selected && styles.filterTextActive]}>
                  {filter.label} {stats[filter.key] || 0}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>매칭 목록을 불러오는 중입니다.</Text>
          </View>
        ) : (
          <FlatList
            data={visibleMatches}
            keyExtractor={(item) => item.id}
            renderItem={renderMatch}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
            }
            ListHeaderComponent={
              <Text style={styles.countText}>{FILTERS.find((f) => f.key === activeFilter)?.label} {visibleMatches.length}건</Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="file-tray-outline" size={38} color={colors.textLight} />
                <Text style={styles.emptyText}>해당 상태의 매칭이 없습니다.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <View style={styles.infoItem}>
      <Ionicons name={icon} size={16} color={colors.textLight} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: 18,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F4F7FB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7EDF5',
    marginBottom: 14,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 5,
  },
  noticeText: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 19,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#F4F6FA',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.textLight,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 28,
  },
  countText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  matchCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    ...commonStyles.shadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  gamesText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationText: {
    color: colors.textLight,
    fontSize: 13,
    marginTop: 5,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  infoItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  infoLabel: {
    color: colors.textLight,
    fontSize: 12,
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F4F6FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  cancelButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.35,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    color: colors.textLight,
    fontSize: 14,
  },
});
