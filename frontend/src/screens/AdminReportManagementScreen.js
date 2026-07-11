import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
import { confirmAction, notify } from '../utils/dialog';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'received', label: '접수' },
  { key: 'reviewing', label: '검토 중' },
  { key: 'resolved', label: '처리 완료' },
];

const STATUS_META = {
  received: { label: '접수됨', color: '#9B5C00', bg: '#FFF3BF' },
  reviewing: { label: '검토 중', color: colors.primary, bg: '#EAF1FF' },
  resolved: { label: '처리 완료', color: '#16794C', bg: '#ECFDF3' },
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('ko-KR');
};

export default function AdminReportManagementScreen({ navigation }) {
  const { user, token } = useContext(AuthContext);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [notes, setNotes] = useState({});
  const [updatingId, setUpdatingId] = useState(null);

  const loadReports = useCallback(async () => {
    try {
      const response = await apiFetch('/reports', { token });
      const data = await response.json().catch(() => ([]));
      if (!response.ok) throw new Error(data.detail || '신고 목록을 불러오지 못했습니다.');
      setReports(Array.isArray(data) ? data : []);
    } catch (error) {
      notify('오류', error.message || '신고 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const stats = useMemo(() => {
    const next = { all: reports.length, received: 0, reviewing: 0, resolved: 0 };
    reports.forEach((report) => { next[report.status] = (next[report.status] || 0) + 1; });
    return next;
  }, [reports]);

  const visibleReports = useMemo(
    () => activeFilter === 'all' ? reports : reports.filter((report) => report.status === activeFilter),
    [activeFilter, reports],
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const updateStatus = (report, status) => {
    const statusLabel = STATUS_META[status].label;
    confirmAction('신고 상태 변경', `이 신고를 ‘${statusLabel}’ 상태로 변경할까요?`, async () => {
      setUpdatingId(report.id);
      try {
        const response = await apiFetch(`/reports/${report.id}/status`, {
          method: 'PATCH',
          token,
          json: { status, admin_note: notes[report.id] || report.admin_note || '' },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || '신고 상태를 변경하지 못했습니다.');
        setReports((previous) => previous.map((item) => item.id === data.id ? data : item));
        notify('저장 완료', `신고 상태가 ‘${statusLabel}’로 변경되었습니다.`);
      } catch (error) {
        notify('저장 실패', error.message || '신고 상태를 변경하지 못했습니다.');
      } finally {
        setUpdatingId(null);
      }
    }, { confirmText: '변경하기', cancelText: '취소' });
  };

  const renderReport = ({ item }) => {
    const meta = STATUS_META[item.status] || STATUS_META.received;
    const isUpdating = updatingId === item.id;
    return (
      <View style={styles.reportCard}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.targetText}>{item.reported_user_nickname} <Text style={styles.arrow}>←</Text> {item.reporter_nickname}</Text>
            <Text style={styles.metaText}>{formatDate(item.created_at)}{item.match_id ? ` · 매칭 ${item.match_id}` : ''}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.categoryBadge}><Text style={styles.categoryText}>{item.category}</Text></View>
        <Text style={styles.contentText}>{item.content}</Text>

        <Text style={styles.noteLabel}>운영 메모</Text>
        <TextInput
          value={notes[item.id] ?? item.admin_note ?? ''}
          onChangeText={(value) => setNotes((previous) => ({ ...previous, [item.id]: value }))}
          placeholder="확인 내용 또는 조치 내용을 기록하세요."
          placeholderTextColor={colors.textLight}
          multiline
          maxLength={1000}
          style={styles.noteInput}
        />
        {item.handled_by_nickname ? <Text style={styles.handledText}>최근 처리: {item.handled_by_nickname} · {formatDate(item.handled_at)}</Text> : null}

        <View style={styles.actionRow}>
          <ActionButton label="검토 중" color={colors.primary} disabled={isUpdating} onPress={() => updateStatus(item, 'reviewing')} />
          <ActionButton label="처리 완료" color="#16794C" disabled={isUpdating} onPress={() => updateStatus(item, 'resolved')} />
        </View>
      </View>
    );
  };

  if (!user?.is_admin) {
    return <SafeAreaView style={commonStyles.container}><View style={styles.center}><Text style={styles.emptyText}>관리자 계정으로만 사용할 수 있습니다.</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}><Ionicons name="chevron-back" size={28} color={colors.primary} /></TouchableOpacity>
        <Text style={styles.headerTitle}>신고 관리</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.headerButton}><Ionicons name="refresh" size={22} color={colors.primary} /></TouchableOpacity>
      </View>
      <View style={styles.content}>
        <View style={styles.noticeCard}>
          <Ionicons name="shield-checkmark-outline" size={30} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>사용자 신고 관리</Text>
            <Text style={styles.noticeText}>신고 내용과 관련 매칭을 확인한 뒤 처리 상태와 운영 메모를 남겨주세요.</Text>
          </View>
        </View>
        <View style={styles.filterRow}>
          {FILTERS.map((filter) => {
            const active = activeFilter === filter.key;
            return <TouchableOpacity key={filter.key} onPress={() => setActiveFilter(filter.key)} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{filter.label} {stats[filter.key] || 0}</Text></TouchableOpacity>;
          })}
        </View>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>신고 목록을 불러오는 중입니다.</Text></View>
        ) : (
          <FlatList
            data={visibleReports}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderReport}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
            ListEmptyComponent={<View style={styles.emptyBox}><Ionicons name="checkmark-circle-outline" size={42} color="#7BAA91" /><Text style={styles.emptyText}>해당 상태의 신고가 없습니다.</Text></View>}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function ActionButton({ label, color, disabled, onPress }) {
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.actionButton, { borderColor: color }, disabled && styles.disabledButton]}>{disabled ? <ActivityIndicator size="small" color={color} /> : <Text style={[styles.actionText, { color }]}>{label}</Text>}</TouchableOpacity>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.primary, fontSize: 20, fontWeight: 'bold' },
  content: { flex: 1, padding: 18 },
  noticeCard: { flexDirection: 'row', gap: 12, backgroundColor: '#F4F7FB', borderRadius: 18, borderWidth: 1, borderColor: '#E7EDF5', padding: 16, marginBottom: 14 },
  noticeTitle: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  noticeText: { color: colors.textLight, fontSize: 13, lineHeight: 18 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  filterChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.text, fontSize: 13, fontWeight: 'bold' },
  filterTextActive: { color: '#FFFFFF' },
  listContent: { paddingBottom: 36, gap: 12 },
  reportCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, ...commonStyles.shadow },
  cardTop: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  targetText: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
  arrow: { color: colors.textLight },
  metaText: { color: colors.textLight, fontSize: 12, marginTop: 5 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  categoryBadge: { alignSelf: 'flex-start', marginTop: 13, backgroundColor: '#FFF4E6', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  categoryText: { color: '#9B5C00', fontSize: 12, fontWeight: 'bold' },
  contentText: { color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 10 },
  noteLabel: { color: colors.text, fontWeight: 'bold', marginTop: 16, marginBottom: 7, fontSize: 13 },
  noteInput: { minHeight: 70, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 10, color: colors.text, textAlignVertical: 'top', fontSize: 13, backgroundColor: colors.background },
  handledText: { color: colors.textLight, fontSize: 11, marginTop: 7 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionButton: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  actionText: { fontSize: 12, fontWeight: 'bold' },
  disabledButton: { opacity: 0.55 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: colors.textLight },
  emptyBox: { paddingVertical: 70, alignItems: 'center', gap: 10 },
  emptyText: { color: colors.textLight, fontSize: 14 },
});
