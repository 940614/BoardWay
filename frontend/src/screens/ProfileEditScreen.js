import React, { useContext, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
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

const GENRES = ['입문', '전략', '파티', '마피아', '추리', '카드', '협상', '두뇌', '힐링', '헤비'];
const LOCATIONS = ['강남', '홍대', '건대', '신촌', '잠실', '노원', '부평', '수원', '안양', '기타'];
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const TIME_SLOTS = ['평일 낮', '평일 저녁', '주말 낮', '주말 저녁'];
const PLAYER_COUNTS = ['2~3인', '4인', '5~6인', '7인 이상'];
const DIFFICULTIES = ['쉬움', '보통', '어려움', '매우 어려움'];

export default function ProfileEditScreen({ navigation }) {
  const { user, token, fetchUserInfo } = useContext(AuthContext);
  const [bio, setBio] = useState(user?.bio || '');
  const [preferredGenres, setPreferredGenres] = useState(user?.preferred_genres || []);
  const [preferredLocations, setPreferredLocations] = useState(user?.preferred_locations || []);
  const [preferredDays, setPreferredDays] = useState(user?.preferred_days || []);
  const [preferredTimeSlots, setPreferredTimeSlots] = useState(user?.preferred_time_slots || []);
  const [preferredPlayerCounts, setPreferredPlayerCounts] = useState(user?.preferred_player_counts || []);
  const [preferredDifficulties, setPreferredDifficulties] = useState(user?.preferred_difficulties || []);
  const [submitting, setSubmitting] = useState(false);

  const toggleValue = (value, values, setter) => {
    if (values.includes(value)) {
      setter(values.filter((item) => item !== value));
    } else {
      setter([...values, value]);
    }
  };

  const handleSave = async () => {
    const trimmedBio = bio.trim();

    if (trimmedBio.length > 300) {
      notify('자기소개 확인', '자기소개는 300자 이하로 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch('/me/profile', {
        method: 'PUT',
        token,
        json: {
          bio: trimmedBio,
          preferred_genres: preferredGenres,
          preferred_locations: preferredLocations,
          preferred_days: preferredDays,
          preferred_time_slots: preferredTimeSlots,
          preferred_player_counts: preferredPlayerCounts,
          preferred_difficulties: preferredDifficulties,
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        notify('저장 실패', data.detail || '프로필 저장에 실패했습니다.');
        return;
      }

      await fetchUserInfo?.(token);
      notify('저장 완료', '프로필이 수정되었습니다.');
      navigation.goBack();
    } catch (error) {
      console.error('Profile update error:', error);
      notify('오류', '서버와 연결할 수 없습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>프로필 수정</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.noticeCard}>
          <Ionicons name="person-circle-outline" size={32} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>내 보드웨이 프로필</Text>
            <Text style={styles.noticeText}>
              선호 조건을 설정하면 나에게 더 잘 맞는 매칭을 추천하는 데 활용할 수 있습니다.
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>자기소개</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="예: 전략게임 좋아해요. 초보도 환영합니다!"
            placeholderTextColor={colors.textLight}
            multiline
            maxLength={300}
          />
          <Text style={styles.helperText}>{bio.length}/300</Text>
        </View>

        <PreferenceSection
          title="선호 장르"
          subtitle="좋아하는 게임 스타일을 골라주세요."
          options={GENRES}
          selected={preferredGenres}
          onToggle={(value) => toggleValue(value, preferredGenres, setPreferredGenres)}
        />

        <PreferenceSection
          title="선호 지역"
          subtitle="자주 가는 지역을 골라주세요."
          options={LOCATIONS}
          selected={preferredLocations}
          onToggle={(value) => toggleValue(value, preferredLocations, setPreferredLocations)}
        />

        <PreferenceSection
          title="참여 가능 요일"
          subtitle="주로 보드게임 모임에 참여할 수 있는 요일을 골라주세요."
          options={DAYS}
          selected={preferredDays}
          onToggle={(value) => toggleValue(value, preferredDays, setPreferredDays)}
        />

        <PreferenceSection
          title="선호 시간대"
          subtitle="참여하기 편한 시간대를 골라주세요."
          options={TIME_SLOTS}
          selected={preferredTimeSlots}
          onToggle={(value) => toggleValue(value, preferredTimeSlots, setPreferredTimeSlots)}
        />

        <PreferenceSection
          title="선호 인원"
          subtitle="함께 게임하기 좋은 인원 규모를 골라주세요."
          options={PLAYER_COUNTS}
          selected={preferredPlayerCounts}
          onToggle={(value) => toggleValue(value, preferredPlayerCounts, setPreferredPlayerCounts)}
        />

        <PreferenceSection
          title="선호 난이도"
          subtitle="즐기고 싶은 게임의 난이도를 골라주세요."
          options={DIFFICULTIES}
          selected={preferredDifficulties}
          onToggle={(value) => toggleValue(value, preferredDifficulties, setPreferredDifficulties)}
        />

        <TouchableOpacity
          style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>프로필 저장하기</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PreferenceSection({ title, subtitle, options, selected, onToggle }) {
  return (
    <View style={styles.formCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onToggle(option)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
    padding: 20,
    gap: 16,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F4F7FB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7EDF5',
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  noticeText: {
    color: colors.textLight,
    fontSize: 13,
    lineHeight: 19,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    ...commonStyles.shadow,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  bioInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  helperText: {
    marginTop: 7,
    color: colors.textLight,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    color: colors.textLight,
    fontSize: 13,
    marginTop: 5,
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: '#F4F6FA',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  saveButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
