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
import { notify } from '../utils/dialog';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';

export default function AdminUserManagementScreen({ navigation }) {
  const { token, user } = useContext(AuthContext);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsers = useCallback(async (nextQuery = '', options = {}) => {
    const { showAlert = false, retry = true } = options;
    if (!token || !user) return;
    if (!user?.is_admin) {
      setLoading(false);
      notify('권한 없음', '관리자 계정으로만 사용할 수 있습니다.');
      return;
    }

    try {
      const path = `/admin/users${nextQuery.trim() ? `?q=${encodeURIComponent(nextQuery.trim())}` : ''}`;
      const response = await apiFetch(path, { token });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || '회원 목록을 불러오지 못했습니다.');
      }

      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      const message = error.message || '회원 목록을 불러오지 못했습니다.';

      if (retry && (message.includes('Failed to fetch') || message.includes('Network request failed'))) {
        setTimeout(() => {
          loadUsers(nextQuery, { showAlert: false, retry: false });
        }, 500);
        return;
      }

      if (showAlert) {
        notify('오류', message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (!token || !user) return;
    loadUsers('', { showAlert: false });
  }, [loadUsers, token, user]);

  const handleSearch = () => {
    setLoading(true);
    loadUsers(query, { showAlert: true });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsers(query, { showAlert: false });
  };

  const goToPointGrant = (targetUser) => {
    navigation.navigate('AdminPointGrant', {
      userIdentifier: targetUser.email || targetUser.nickname,
      nickname: targetUser.nickname,
    });
  };

  const renderUser = ({ item }) => (
    <TouchableOpacity
      style={styles.userCard}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('AdminUserDetail', { userId: item.id, user: item })}
    >
      <View style={styles.userTopRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.nickname?.[0] || '?'}</Text>
        </View>
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.nickname}>{item.nickname}</Text>
            {item.is_admin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>관리자</Text>
              </View>
            )}
          </View>
          <Text style={styles.email}>{item.email}</Text>
          <Text style={styles.metaText}>회원 #{item.id} · 매너 {item.mannerScore ?? 5}</Text>
        </View>
      </View>

      <View style={styles.pointRow}>
        <View>
          <Text style={styles.pointLabel}>보유 포인트</Text>
          <Text style={styles.pointValue}>
            {item.is_admin ? '무한 P' : `${(item.points || 0).toLocaleString()}P`}
          </Text>
        </View>
        <TouchableOpacity style={styles.pointButton} onPress={() => goToPointGrant(item)}>
          <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
          <Text style={styles.pointButtonText}>포인트 지급</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>회원 관리</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.noticeCard}>
          <Ionicons name="people-circle-outline" size={30} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>관리자 회원 검색</Text>
            <Text style={styles.noticeText}>
              이메일 또는 닉네임으로 회원을 찾고, 보유 포인트와 관리자 여부를 확인할 수 있습니다.
            </Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="이메일 또는 닉네임 검색"
            placeholderTextColor={colors.textLight}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Ionicons name="search" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>회원 목록을 불러오는 중입니다.</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderUser}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
            }
            ListHeaderComponent={
              <Text style={styles.countText}>총 {users.length}명</Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="person-remove-outline" size={36} color={colors.textLight} />
                <Text style={styles.emptyText}>검색된 회원이 없습니다.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
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
    justifyContent: 'center',
    alignItems: 'center',
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
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  searchButton: {
    width: 50,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  listContent: {
    paddingBottom: 24,
  },
  countText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  userCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    ...commonStyles.shadow,
  },
  userTopRow: {
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  nickname: {
    fontSize: 16,
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
    marginTop: 3,
    color: colors.textLight,
    fontSize: 13,
  },
  metaText: {
    marginTop: 5,
    color: colors.textLight,
    fontSize: 12,
  },
  pointRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pointLabel: {
    color: colors.textLight,
    fontSize: 12,
    marginBottom: 3,
  },
  pointValue: {
    color: colors.secondary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  pointButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pointButtonText: {
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
