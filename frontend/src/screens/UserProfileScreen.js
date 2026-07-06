import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

function Chip({ label }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export default function UserProfileScreen({ route, navigation }) {
  const { userId, nickname } = route.params || {};
  const { token } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setLoading(false);
        notify('오류', '프로필 정보를 찾을 수 없습니다.');
        return;
      }

      try {
        const response = await apiFetch(`/users/${userId}/profile`, { token });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.detail || '프로필을 불러오지 못했습니다.');
        }
        setProfile(data);
      } catch (error) {
        notify('오류', error.message || '프로필을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId, token]);

  const displayName = profile?.nickname || nickname || '프로필';
  const relationLabel = profile?.relation === 'friend'
    ? '친구'
    : profile?.relation === 'matchmate'
      ? '같은 매칭 참여자'
      : profile?.relation === 'me'
        ? '내 프로필'
        : '프로필';

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>프로필</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>프로필을 불러오는 중입니다.</Text>
        </View>
      ) : profile ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{displayName?.[0] || '?'}</Text>
            </View>
            <Text style={styles.nickname}>{displayName}</Text>
            <View style={styles.relationBadge}>
              <Text style={styles.relationBadgeText}>{relationLabel}</Text>
            </View>
            <Text style={styles.mannerText}>
              매너 주사위 {Number(profile.mannerScore || 0).toFixed(1)}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>자기소개</Text>
            <Text style={profile.bio ? styles.bioText : styles.emptyText}>
              {profile.bio || '아직 작성한 자기소개가 없습니다.'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>선호 장르</Text>
            {profile.preferred_genres?.length > 0 ? (
              <View style={styles.chipWrap}>
                {profile.preferred_genres.map((genre) => <Chip key={genre} label={genre} />)}
              </View>
            ) : (
              <Text style={styles.emptyText}>선호 장르가 아직 없습니다.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>선호 지역</Text>
            {profile.preferred_locations?.length > 0 ? (
              <View style={styles.chipWrap}>
                {profile.preferred_locations.map((location) => <Chip key={location} label={location} />)}
              </View>
            ) : (
              <Text style={styles.emptyText}>선호 지역이 아직 없습니다.</Text>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Ionicons name="person-circle-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>프로필을 표시할 수 없습니다.</Text>
        </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: colors.textLight, fontSize: 14 },
  content: { padding: 20, paddingBottom: 40 },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
    ...commonStyles.shadow,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: colors.surface, fontSize: 30, fontWeight: 'bold' },
  nickname: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  relationBadge: {
    marginTop: 8,
    backgroundColor: '#EEF3F8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  relationBadgeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  mannerText: { marginTop: 10, color: colors.textLight, fontSize: 14 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
  bioText: { fontSize: 15, lineHeight: 24, color: colors.text },
  emptyText: { fontSize: 14, color: colors.textLight, lineHeight: 22 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#F2F5F8',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
