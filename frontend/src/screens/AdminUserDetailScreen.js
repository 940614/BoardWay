import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
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

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const matchStatusText = (match) => {
  if (match.cancelled) return '취소됨';
  if (match.completed) return '완료';
  if (match.closed) return '마감';
  return '모집중';
};

export default function AdminUserDetailScreen({ navigation, route }) {
  const { token, user } = useContext(AuthContext);
  const targetUserId = route?.params?.userId;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!token || !user?.is_admin || !targetUserId) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch(`/admin/users/${targetUserId}/detail`, { token });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || '회원 상세 정보를 불러오지 못했습니다.');
      setDetail(data);
    } catch (error) {
      notify('오류', error.message || '회원 상세 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetUserId, token, user?.is_admin]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDetail();
  };

  const target = detail?.user || route?.params?.user || {};
  const pointHistory = detail?.point_history || [];
  const matches = detail?.matches || [];
  const suggestions = detail?.suggestions || [];

  const goToPointGrant = () => {
    navigation.navigate('AdminPointGrant', {
      userIdentifier: target.email || target.nickname,
      nickname: target.nickname,
    });
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>회원 상세 관리</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>회원 정보를 불러오는 중입니다.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{target.nickname?.[0] || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.nickname}>{target.nickname || '알 수 없음'}</Text>
                {target.is_admin && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>관리자</Text>
                  </View>
                )}
              </View>
              <Text style={styles.email}>{target.email}</Text>
              <Text style={styles.metaText}>회원 #{target.id} · 매너 {target.mannerScore ?? 5}</Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>보유 포인트</Text>
              <Text style={styles.statValue}>
                {target.is_admin ? '무한 P' : `${(target.points || 0).toLocaleString()}P`}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>참여 매칭</Text>
              <Text style={styles.statValue}>{matches.length}건</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>문의</Text>
              <Text style={styles.statValue}>{suggestions.length}건</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={goToPointGrant}>
            <Ionicons name="cash-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>이 회원에게 포인트 지급/차감</Text>
          </TouchableOpacity>

          <Section title="최근 포인트 내역" count={pointHistory.length}>
            {pointHistory.length === 0 ? (
              <EmptyText text="포인트 내역이 없습니다." />
            ) : (
              pointHistory.map((item) => (
                <View key={item.id} style={styles.rowItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.description || '포인트 내역'}</Text>
                    <Text style={styles.rowSub}>{formatDate(item.created_at)}</Text>
                  </View>
                  <Text style={[styles.pointAmount, item.amount >= 0 ? styles.plus : styles.minus]}>
                    {item.amount >= 0 ? '+' : ''}
                    {item.amount.toLocaleString()}P
                  </Text>
                </View>
              ))
            )}
          </Section>

          <Section title="최근 참여 매칭" count={matches.length}>
            {matches.length === 0 ? (
              <EmptyText text="참여한 매칭이 없습니다." />
            ) : (
              matches.map((match) => (
                <TouchableOpacity
                  key={match.id}
                  style={styles.rowItem}
                  onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{(match.games || []).join(' · ') || '자유 선택'}</Text>
                    <Text style={styles.rowSub}>
                      {match.date} {match.startTime} · {match.location?.venue} {match.location?.branch}
                    </Text>
                  </View>
                  <Text style={styles.statusBadge}>{matchStatusText(match)}</Text>
                </TouchableOpacity>
              ))
            )}
          </Section>

          <Section title="최근 고객센터 문의" count={suggestions.length}>
            {suggestions.length === 0 ? (
              <EmptyText text="문의 내역이 없습니다." />
            ) : (
              suggestions.map((item) => (
                <View key={item.id} style={styles.suggestionItem}>
                  <View style={styles.suggestionTop}>
                    <Text style={styles.categoryBadge}>{item.category}</Text>
                    <Text style={styles.rowSub}>{formatDate(item.created_at)}</Text>
                  </View>
                  <Text style={styles.suggestionContent}>{item.content}</Text>
                  {item.admin_reply ? (
                    <Text style={styles.replyText}>답변: {item.admin_reply}</Text>
                  ) : (
                    <Text style={styles.pendingReply}>아직 답변 전</Text>
                  )}
                </View>
              ))
            )}
          </Section>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, count, children }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{count}건</Text>
      </View>
      {children}
    </View>
  );
}

function EmptyText({ text }) {
  return <Text style={styles.emptyText}>{text}</Text>;
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.textLight,
    fontSize: 14,
  },
  content: {
    padding: 18,
    gap: 14,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    ...commonStyles.shadow,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  nickname: {
    fontSize: 19,
    fontWeight: 'bold',
    color: colors.text,
  },
  adminBadge: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  adminBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  email: {
    marginTop: 4,
    color: colors.textLight,
    fontSize: 13,
  },
  metaText: {
    marginTop: 5,
    color: colors.textLight,
    fontSize: 12,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    color: colors.textLight,
    fontSize: 12,
    marginBottom: 6,
  },
  statValue: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: 'bold',
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionCount: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: 'bold',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  rowSub: {
    marginTop: 4,
    color: colors.textLight,
    fontSize: 12,
  },
  pointAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  plus: {
    color: colors.secondary,
  },
  minus: {
    color: colors.error,
  },
  statusBadge: {
    color: colors.primary,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: 'bold',
  },
  suggestionItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  suggestionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    color: '#8A6A00',
    backgroundColor: '#FFF3BF',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: 'bold',
  },
  suggestionContent: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  replyText: {
    marginTop: 8,
    color: colors.primary,
    backgroundColor: '#F4F7FB',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    lineHeight: 19,
  },
  pendingReply: {
    marginTop: 8,
    color: colors.textLight,
    fontSize: 12,
  },
  emptyText: {
    color: colors.textLight,
    fontSize: 13,
    paddingVertical: 14,
    textAlign: 'center',
  },
});
