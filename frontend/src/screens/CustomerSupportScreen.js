import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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

const CATEGORIES = ['게임 추가', '기능 개선', '불편 신고', '기타'];
const ADMIN_CATEGORIES = ['전체', ...CATEGORIES];

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

export default function CustomerSupportScreen({ navigation }) {
  const { user, token } = useContext(AuthContext);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [adminCategory, setAdminCategory] = useState(ADMIN_CATEGORIES[0]);
  const [content, setContent] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyingId, setReplyingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const visibleSuggestions = useMemo(() => {
    if (user?.is_admin && adminCategory !== '전체') {
      return suggestions.filter((item) => item.category === adminCategory);
    }
    return suggestions;
  }, [adminCategory, suggestions, user?.is_admin]);

  const loadSuggestions = useCallback(async () => {
    if (!token) return;
    try {
      const response = await apiFetch('/suggestions', { token });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || '의견을 불러오지 못했습니다.');
      setSuggestions(data.suggestions || []);
    } catch (error) {
      notify('오류', error.message || '의견을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (trimmed.length < 5) {
      notify('내용 확인', '의견을 5자 이상 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch('/suggestions', {
        method: 'POST',
        token,
        json: { category, content: trimmed },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || '의견을 접수하지 못했습니다.');
      setContent('');
      await loadSuggestions();
      notify('접수 완료', '소중한 의견이 운영진에게 전달되었습니다.');
    } catch (error) {
      notify('오류', error.message || '의견을 접수하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (suggestionId) => {
    const reply = (replyDrafts[suggestionId] || '').trim();
    if (!reply) {
      notify('답변 확인', '답변 내용을 입력해주세요.');
      return;
    }

    setReplyingId(suggestionId);
    try {
      const response = await apiFetch(`/suggestions/${suggestionId}/reply`, {
        method: 'POST',
        token,
        json: { admin_reply: reply },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || '답변을 저장하지 못했습니다.');
      setReplyDrafts((prev) => ({ ...prev, [suggestionId]: '' }));
      await loadSuggestions();
      notify('답변 완료', '사용자에게 운영진 답변이 등록되었습니다.');
    } catch (error) {
      notify('오류', error.message || '답변을 저장하지 못했습니다.');
    } finally {
      setReplyingId(null);
    }
  };

  const renderSuggestion = ({ item }) => {
    const replyDraft = replyDrafts[item.id] ?? item.admin_reply ?? '';
    const hasReply = !!item.admin_reply;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{item.category}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>

        {user?.is_admin && (
          <Text style={styles.authorText}>
            {item.user_nickname || '알 수 없는 사용자'} · 회원 #{item.user_id}
          </Text>
        )}

        <Text style={styles.sectionLabel}>사용자 의견</Text>
        <Text style={styles.contentText}>{item.content}</Text>

        {hasReply ? (
          <View style={styles.replyBox}>
            <View style={styles.replyHeader}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
              <Text style={styles.replyTitle}>운영진 답변</Text>
              <Text style={styles.replyDate}>{formatDate(item.answered_at)}</Text>
            </View>
            <Text style={styles.replyText}>{item.admin_reply}</Text>
          </View>
        ) : (
          <View style={styles.waitingReplyBox}>
            <Ionicons name="time-outline" size={15} color={colors.textLight} />
            <Text style={styles.waitingReplyText}>아직 운영진 답변이 등록되지 않았습니다.</Text>
          </View>
        )}

        {user?.is_admin && (
          <View style={styles.replyForm}>
            <Text style={styles.label}>{hasReply ? '답변 수정' : '답변 작성'}</Text>
            <TextInput
              style={[styles.input, styles.replyInput]}
              value={replyDraft}
              onChangeText={(text) => setReplyDrafts((prev) => ({ ...prev, [item.id]: text }))}
              placeholder="사용자에게 전달할 답변을 입력해주세요."
              placeholderTextColor={colors.textLight}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.replyButton, replyingId === item.id && styles.buttonDisabled]}
              onPress={() => handleReply(item.id)}
              disabled={replyingId === item.id}
            >
              {replyingId === item.id ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.replyButtonText}>{hasReply ? '답변 수정하기' : '답변 보내기'}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const ListHeader = (
    <>
      <View style={styles.intro}>
        <Ionicons
          name={user?.is_admin ? 'file-tray-full-outline' : 'chatbox-ellipses-outline'}
          size={30}
          color={colors.primary}
        />
        <View style={styles.introTextWrap}>
          <Text style={styles.introTitle}>
            {user?.is_admin ? '접수된 사용자 의견' : '무엇을 도와드릴까요?'}
          </Text>
          <Text style={styles.introText}>
            {user?.is_admin
              ? '사용자가 보낸 요청을 확인하고 답변을 등록할 수 있습니다.'
              : '추가되었으면 하는 게임이나 불편했던 점을 남겨주세요. 운영진 답변도 이곳에서 확인할 수 있습니다.'}
          </Text>
        </View>
      </View>

      {!user?.is_admin && (
        <View style={styles.formCard}>
          <Text style={styles.label}>문의 유형</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((item) => {
              const selected = category === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                  onPress={() => setCategory(item)}
                >
                  <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>의견 내용</Text>
          <TextInput
            style={styles.input}
            value={content}
            onChangeText={setContent}
            placeholder="예: 아크노바 게임도 추가해주세요!"
            placeholderTextColor={colors.textLight}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{content.length}/1000</Text>

          <TouchableOpacity
            style={[commonStyles.button, styles.submitButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={commonStyles.buttonText}>의견 보내기</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {user?.is_admin && (
        <View style={styles.adminFilterCard}>
          <Text style={styles.label}>카테고리별 보기</Text>
          <View style={styles.categoryRow}>
            {ADMIN_CATEGORIES.map((item) => {
              const selected = adminCategory === item;
              const count = item === ADMIN_CATEGORIES[0]
                ? suggestions.length
                : suggestions.filter((suggestion) => suggestion.category === item).length;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                  onPress={() => setAdminCategory(item)}
                >
                  <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                    {item} {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <Text style={styles.listTitle}>
        {user?.is_admin
          ? `${adminCategory} ${visibleSuggestions.length}건`
          : '내가 보낸 의견'}
      </Text>
    </>
  );

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{user?.is_admin ? '고객 의견 관리' : '고객센터'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={visibleSuggestions}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderSuggestion}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="mail-open-outline" size={40} color={colors.border} />
                <Text style={styles.emptyText}>아직 접수된 의견이 없습니다.</Text>
              </View>
            }
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadSuggestions();
                }}
                tintColor={colors.primary}
              />
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: '#EEF4F8',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  introTextWrap: { flex: 1 },
  introTitle: { fontSize: 17, fontWeight: 'bold', color: colors.primary, marginBottom: 5 },
  introText: { fontSize: 13, lineHeight: 19, color: colors.text },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    ...commonStyles.shadow,
  },
  label: { fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
  sectionLabel: { fontSize: 12, fontWeight: 'bold', color: colors.textLight, marginTop: 12 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  categoryChipTextSelected: { color: '#FFFFFF' },
  input: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  replyInput: { minHeight: 90, backgroundColor: '#FFFFFF' },
  counter: { textAlign: 'right', marginTop: 6, fontSize: 12, color: colors.textLight },
  submitButton: { marginTop: 14 },
  buttonDisabled: { opacity: 0.6 },
  adminFilterCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryBadge: { backgroundColor: '#FFF4CC', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  categoryBadgeText: { color: '#7A5B00', fontSize: 12, fontWeight: 'bold' },
  dateText: { color: colors.textLight, fontSize: 11 },
  authorText: { color: colors.primary, fontSize: 12, fontWeight: 'bold', marginTop: 9 },
  contentText: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 5 },
  replyBox: {
    backgroundColor: '#EEF7F1',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#CBE7D3',
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  replyTitle: { color: colors.primary, fontSize: 13, fontWeight: 'bold', flex: 1 },
  replyDate: { color: colors.textLight, fontSize: 11 },
  replyText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  waitingReplyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  waitingReplyText: { color: colors.textLight, fontSize: 13 },
  replyForm: { marginTop: 14 },
  replyButton: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  replyButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyText: { color: colors.textLight, fontSize: 14, marginTop: 8 },
});
