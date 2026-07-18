import React, { useState, useContext, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Switch, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { notify } from '../utils/dialog';
import { apiFetch } from '../utils/api';
import { MatchContext } from '../context/MatchContext';
import { AuthContext } from '../context/AuthContext';

const WEEKEND_TEXT_COLORS = {
  sunday: '#E74C3C',
  saturday: '#3498DB',
};

const GENRE_TABS = ['전체', '다인용 게임', '전략', '파티', '마피아', '추리', '카드', '타일', '고전', '단어'];

const DIFFICULTIES = ['쉬움', '보통', '어려움', '매우 어려움'];
const TAG_OPTIONS = ['입문', '전략', '파티', '마피아', '심리전', '추리', '두뇌', '힐링', '협력', '고전'];
const TIME_SLOTS = ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
const VENUE_OPTIONS = {
  '레드버튼': [
    { branch: '강남점', address: '서울 강남구 강남대로 442' },
    { branch: '강남2호점', address: '서울 강남구 강남대로96길 9' },
    { branch: '신촌점', address: '서울 서대문구 연세로 8' },
    { branch: '노원점', address: '서울 노원구 상계로 74' },
    { branch: '일산점', address: '경기 고양시 일산동구 중앙로1261번길 57' },
    { branch: '안양점', address: '경기 안양시 만안구 만안로 222' },
    { branch: '범계점', address: '경기 안양시 동안구 평촌대로223번길 52' },
  ],
  '홈즈앤루팡': [
    { branch: '홍대점', address: '서울 마포구 홍익로3길 20' },
    { branch: '잠실점', address: '서울 송파구 백제고분로7길 22' },
    { branch: '인천구월점', address: '인천 남동구 인하로507번길 18' },
    { branch: '수원역점', address: '경기 수원시 팔달구 향교로 3' },
    { branch: '분당점', address: '경기 성남시 분당구 서현로 210' },
    { branch: '서현점', address: '경기 성남시 분당구 황새울로360번길 12' },
  ],
  '포퀸스': [
    { branch: '건대점', address: '서울 광진구 아차산로 224' },
    { branch: '수유점', address: '서울 강북구 도봉로87길 14' },
    { branch: '부평점', address: '인천 부평구 시장로 24' },
    { branch: '의정부점', address: '경기 의정부시 시민로121번길 34-1' },
  ],
  '히어로보드게임카페': [
    { branch: '홍대점', address: '서울 마포구 와우산로21길 31-10' },
    { branch: '건대점', address: '서울 광진구 아차산로25길 8' },
  ],
  '보드게임카페 미플': [
    { branch: '신촌점', address: '서울 서대문구 신촌로 109' }
  ]
};

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function maxBookableDateISO() {
  const d = new Date();
  d.setDate(d.getDate() + 9);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function CreateMatchScreen({ navigation }) {
  const { fetchMatches } = useContext(MatchContext);
  const { token, user, points, usePoints } = useContext(AuthContext);

  const [dbGames, setDbGames] = useState([]);
  const [selectedGames, setSelectedGames] = useState([]);
  const [gameGenreFilter, setGameGenreFilter] = useState('전체');
  const [difficulty, setDifficulty] = useState('보통');

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    try {
      const response = await apiFetch('/games');
      if (response.ok) {
        const data = await response.json();
        setDbGames(data.games || []);
      }
    } catch (e) {
      console.error('Failed to load games', e);
    }
  };

  const handleGameToggle = (gameName) => {
    setSelectedGames((prev) => {
      if (prev.includes(gameName)) {
        return prev.filter((name) => name !== gameName);
      } else {
        if (prev.length >= 3) {
          notify('알림', '게임은 최대 3개까지 선택할 수 있습니다.');
          return prev;
        }
        return [...prev, gameName];
      }
    });
  };
  const [selectedTags, setSelectedTags] = useState([]);
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState('18:00');
  const [venue, setVenue] = useState('');
  const [branch, setBranch] = useState('');
  const [address, setAddress] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [isFlexible, setIsFlexible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const [showCalendar, setShowCalendar] = useState(false);
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);

  // 선택한 게임들 기반의 최소 및 최대 인원 실시간 계산
  const recommendedPlayers = useMemo(() => {
    if (isFlexible) {
      return { min: 3, max: 3, label: '3명 (자율 선택 매칭)' };
    }
    if (selectedGames.length === 0) {
      return { min: null, max: null, label: '게임을 선택해 주세요' };
    }

    let maxMin = 0;
    let maxMinGame = '';
    let minMax = 999;
    let minMaxGame = '';

    selectedGames.forEach(gameName => {
      const gameObj = dbGames.find(g => g.name === gameName);
      if (gameObj && gameObj.players) {
        const nums = (gameObj.players.match(/\d+/g) || []).map(Number);
        let gMin = 2;
        let gMax = 4;
        if (nums.length >= 2) {
          [gMin, gMax] = nums;
        } else if (nums.length === 1) {
          gMin = nums[0];
          gMax = nums[0];
        }

        if (gMin > maxMin) {
          maxMin = gMin;
          maxMinGame = gameName;
        }
        if (gMax < minMax) {
          minMax = gMax;
          minMaxGame = gameName;
        }
      }
    });

    if (maxMin > minMax) {
      return { 
        min: maxMin, 
        max: minMax, 
        label: `인원 불일치: ${maxMinGame}(최소 ${maxMin}명) ↔ ${minMaxGame}(최대 ${minMax}명)`, 
        invalid: true 
      };
    }
    return { min: maxMin, max: minMax, label: `${maxMin} ~ ${minMax}명` };
  }, [selectedGames, dbGames, isFlexible]);

  const handleTagToggle = (tag) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const handleVenueSelect = (selectedVenue) => {
    setVenue(selectedVenue);
    setBranch('');
    setAddress('');
    setShowVenueModal(false);
  };

  const handleBranchSelect = (selectedBranchItem) => {
    setBranch(selectedBranchItem.branch);
    setAddress(selectedBranchItem.address);
    setShowBranchModal(false);
  };

  const handleSubmit = async () => {
    const games = isFlexible ? ['자율 선택'] : selectedGames;

    if (!isFlexible && games.length === 0) {
      notify('알림', '게임을 1개 이상 선택해주세요.');
      return;
    }
    if (!venue.trim() || !branch.trim() || !address.trim()) {
      notify('알림', '장소(매장·지점·주소)를 모두 입력해주세요.');
      return;
    }
    const players = parseInt(maxPlayers, 10);
    if (!players || players < 2) {
      notify('알림', '모집 인원은 2 이상이어야 합니다.');
      return;
    }

    if (recommendedPlayers.invalid) {
      notify('알림', '선택한 게임들의 인원 범위가 맞지 않아 매칭을 생성할 수 없습니다. 게임을 변경해주세요.');
      return;
    }

    const minRequired = recommendedPlayers.min || 2;
    if (players < minRequired) {
      notify('알림', `모집 인원은 최소 필요 인원(${minRequired}명) 이상이어야 합니다.`);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      notify('알림', '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(startTime)) {
      notify('알림', '시간 형식이 올바르지 않습니다. (HH:MM)');
      return;
    }

    if (date < todayISO() || date > maxBookableDateISO()) {
      notify('알림', '매칭은 오늘부터 10일 이내 날짜로만 생성할 수 있습니다.');
      return;
    }

    if (date === todayISO()) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const [slotHour, slotMinute] = startTime.split(':').map(Number);

      const currentTotalMinutes = currentHour * 60 + currentMinute;
      const slotTotalMinutes = slotHour * 60 + slotMinute;

      if (slotTotalMinutes - currentTotalMinutes < 30) {
        notify('알림', '당일 매치는 현재 시간보다 최소 30분 이후의 시간대만 선택 가능합니다.');
        return;
      }
    }

    if (!user?.is_admin && points < 12000) {
      notify('포인트 부족', '보유 포인트가 부족합니다. 매치 생성 및 참여를 위해 최소 12,000P가 필요합니다. 충전 후 이용해주세요.');
      return;
    }

    // 팝업 표시
    setRoleModalVisible(true);
  };

  const executeSubmit = async () => {
    setRoleModalVisible(false);
    setSubmitting(true);

    const games = isFlexible ? ['자율 선택'] : selectedGames;
    const gamesLabel = isFlexible ? '자율 선택' : games.join(', ');

    // 포인트 선결제 진행
    const pointResult = await usePoints(12000, `[${gamesLabel}] 매치 개설 결제`);
    if (!pointResult.success) {
      notify('결제 오류', pointResult.message || '포인트 차감에 실패했습니다. 다시 시도해주세요.');
      setSubmitting(false);
      return;
    }

    try {
      const body = {
        games,
        difficulty,
        tags: selectedTags,
        date,
        startTime,
        ruleVideoUrls: [],
        location: { venue: venue.trim(), branch: branch.trim(), address: address.trim() },
        maxPlayers: parseInt(maxPlayers, 10),
        is_flexible: isFlexible,
      };
      const res = await apiFetch('/matches', { method: 'POST', token, json: body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // 결제 후 실패 시 환불 처리 (복구용도)
        await usePoints(-12000, `[${gamesLabel}] 매치 개설 실패 환불`);
        notify('생성 실패', data.detail || '매치 생성에 실패했습니다.');
        return;
      }
      const created = await res.json();
      await fetchMatches();
      notify('생성 완료', '매치가 만들어졌습니다!');
      navigation.replace('MatchDetail', { matchId: created.id });
    } catch (e) {
      console.error('Create match error:', e);
      // 결제 후 실패 시 환불 처리
      await usePoints(-12000, `[${gamesLabel}] 매치 개설 에러 환불`);
      notify('오류', '서버와 연결할 수 없습니다. 포인트가 환불 처리되었습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>새 매치 만들기</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>자율성 매치로 개설</Text>
            <Text style={styles.switchSubLabel}>사전에 게임을 정하지 않고 오프라인에서 모여 직접 정합니다.</Text>
          </View>
          <Switch
            value={isFlexible}
            onValueChange={setIsFlexible}
            trackColor={{ false: '#D1D5DB', true: '#9B59B6' }}
            thumbColor={isFlexible ? '#FFF' : '#f4f3f4'}
          />
        </View>

        {!isFlexible && (
          <>
            <Text style={styles.label}>
              게임 선택 (최대 3개)
              <Text style={styles.labelCount}> {selectedGames.length}/3</Text>
            </Text>

            {/* 선택된 게임 미리보기 */}
            {selectedGames.length > 0 && (
              <View style={styles.selectedPreview}>
                {selectedGames.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={styles.selectedChip}
                    onPress={() => handleGameToggle(name)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.selectedChipText}>{name}</Text>
                    <Ionicons name="close" size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* 장르 탭 */}
            {dbGames.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.genreTabsRow}
              >
                {GENRE_TABS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genreTab, gameGenreFilter === g && styles.genreTabActive]}
                    onPress={() => setGameGenreFilter(g)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.genreTabText, gameGenreFilter === g && styles.genreTabTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {dbGames.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.gamesSelectGrid}>
                {dbGames
                  .filter((game) =>
                    gameGenreFilter === '전체' || (game.genre && game.genre.includes(gameGenreFilter))
                  )
                  .map((game) => {
                    const isSelected = selectedGames.includes(game.name);
                    return (
                      <TouchableOpacity
                        key={game.id}
                        style={[styles.gameSelectCard, isSelected && styles.gameSelectCardActive]}
                        onPress={() => handleGameToggle(game.name)}
                        activeOpacity={0.7}
                      >
                        {isSelected && (
                          <View style={styles.selectedCheckBadge}>
                            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                          </View>
                        )}
                        {game.image && (
                          <Image source={{ uri: game.image }} style={styles.gameSelectImage} />
                        )}
                        <Text
                          style={[styles.gameSelectName, isSelected && styles.gameSelectNameActive]}
                          numberOfLines={2}
                        >
                          {game.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            )}
          </>
        )}

        <Text style={styles.label}>난이도</Text>
        <View style={styles.difficultyRow}>
          {DIFFICULTIES.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.difficultyBtn, difficulty === d && styles.difficultyBtnActive]}
              onPress={() => setDifficulty(d)}
            >
              <Text style={[styles.difficultyText, difficulty === d && styles.difficultyTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>태그 선택 (선택 사항)</Text>
        <View style={styles.tagsGrid}>
          {TAG_OPTIONS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tagSelectBtn, isSelected && styles.tagSelectBtnActive]}
                onPress={() => handleTagToggle(tag)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tagSelectText, isSelected && styles.tagSelectTextActive]}>#{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.row, { marginTop: 16 }]}>
          <TouchableOpacity 
            style={[styles.selectInputButton, { flex: 1, marginRight: 6 }]}
            onPress={() => setShowCalendar(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.selectInputButtonLabel}>모임 날짜 📅</Text>
            <Text style={styles.selectInputButtonValue}>{date}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 6, justifyContent: 'center' }}>
            <Text style={styles.selectInputButtonLabel}>선택된 시간 ⏰</Text>
            <Text style={[styles.selectInputButtonValue, { color: colors.primary, fontWeight: 'bold' }]}>{startTime}</Text>
          </View>
        </View>

        <Text style={styles.label}>모임 시간 선택 ⏰</Text>
        <View style={styles.timeSlotsGrid}>
          {TIME_SLOTS.map((slot) => {
            const isSelected = startTime === slot;
            return (
              <TouchableOpacity
                key={slot}
                style={[styles.timeSlotBtn, isSelected && styles.timeSlotBtnActive]}
                onPress={() => setStartTime(slot)}
                activeOpacity={0.7}
              >
                <Text style={[styles.timeSlotText, isSelected && styles.timeSlotTextActive]}>{slot}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>장소 선택 📍</Text>
        <View style={styles.row}>
          <TouchableOpacity 
            style={[styles.selectInputButton, { flex: 1, marginRight: 6 }]}
            onPress={() => setShowVenueModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.selectInputButtonLabel}>보드게임 카페</Text>
            <Text style={styles.selectInputButtonValue}>{venue || '선택 안 됨'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.selectInputButton, 
              { flex: 1, marginLeft: 6 },
              !venue && { opacity: 0.5 }
            ]}
            onPress={() => venue && setShowBranchModal(true)}
            disabled={!venue}
            activeOpacity={0.7}
          >
            <Text style={styles.selectInputButtonLabel}>지점 선택</Text>
            <Text style={styles.selectInputButtonValue}>{branch || '선택 안 됨'}</Text>
          </TouchableOpacity>
        </View>
        {address ? (
          <View style={styles.addressBox}>
            <Ionicons name="map-outline" size={16} color={colors.textLight} style={{ marginRight: 6 }} />
            <Text style={styles.addressBoxText}>주소: {address}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.label}>모집 인원</Text>
          {recommendedPlayers.label && (
            <Text style={[
              styles.recommendLabel, 
              recommendedPlayers.invalid ? { color: colors.error } : { color: colors.primary }
            ]}>
              추천: {recommendedPlayers.label}
            </Text>
          )}
        </View>
        <TextInput
          style={styles.input}
          value={maxPlayers}
          onChangeText={setMaxPlayers}
          keyboardType="number-pad"
        />

        <TouchableOpacity
          style={[commonStyles.button, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={commonStyles.buttonText}>매치 만들기</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={roleModalVisible}
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="ribbon-outline" size={24} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.modalTitle}>👑 방장의 역할 및 수칙 동의</Text>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubText}>
                BoardWay의 즐겁고 원활한 보드게임 문화를 위해 방장(Host)으로 개설하는 회원은 아래 사항을 준수하고 리드할 책임이 있습니다.
              </Text>
              
              <View style={styles.ruleItem}>
                <Text style={styles.ruleTitle}>💎 참여비 12,000P 결제</Text>
                <Text style={styles.ruleDesc}>방장 역시 매칭의 실제 참가자로 등록되며 개설 즉시 보유 포인트에서 12,000P가 차감됩니다.</Text>
              </View>

              <View style={styles.ruleItem}>
                <Text style={styles.ruleTitle}>📍 10분 전 현장 대기</Text>
                <Text style={styles.ruleDesc}>원활한 인원 확인과 예약을 위해 모임 약속 시간 10분 전까지 해당 카페 지점에 도착해 주셔야 합니다.</Text>
              </View>

              <View style={styles.ruleItem}>
                <Text style={styles.ruleTitle}>⏱️ 정규 진행 시간 2시간</Text>
                <Text style={styles.ruleDesc}>모든 매칭의 정규 진행 시간은 시작 시각부터 2시간입니다. 더 즐기고 싶다면 참여자끼리 협의하여 자유롭게 연장할 수 있습니다. 정규 시간이 끝나면 방장에게 완료 안내가 오며, 방장은 '매칭 성공적으로 완료' 버튼으로 참여자 평가를 시작할 수 있습니다. 종료 후 1시간 안에 완료하지 않으면 평가는 자동으로 시작되고 방장 리워드는 지급되지 않습니다.</Text>
              </View>

              <View style={styles.ruleItem}>
                <Text style={styles.ruleTitle}>🎲 설명 및 게임 리드</Text>
                <Text style={styles.ruleDesc}>참여자들에게 게임의 룰을 상냥하고 명확히 설명해 주고, 초보자 분들도 낙오되지 않도록 게임 테이블의 분위기를 지탱해 주세요.</Text>
              </View>

              <View style={styles.ruleItem}>
                <Text style={styles.ruleTitle}>🎁 우수 방장 리워드 (3,000P 반환)</Text>
                <Text style={styles.ruleDesc}>매칭이 종료된 후, 참여자들로부터 받은 매너 주사위 평가 평균이 4.0점 이상일 경우 감사 리워드로 3,000P를 페이백 해드립니다.</Text>
              </View>

              <View style={styles.ruleItem}>
                <Text style={styles.ruleTitle}>⚠️ 매치 취소 시 포인트 환불 불가</Text>
                <Text style={styles.ruleDesc}>개설 완료된 매칭을 방장의 자발적 취소로 취소하는 경우, 모임에 대한 책임감을 부여하고 다른 참여자를 보호하기 위해 개설 시 차감된 참여비(12,000P)는 환불되지 않습니다. (최소 인원 미달로 인한 자동 취소 시에는 전액 환불됩니다.)</Text>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setRoleModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={executeSubmit}
              >
                <View style={styles.confirmBtnContent}>
                  <Text style={styles.confirmBtnText}>동의하고 매칭 개설</Text>
                  <View style={styles.pointCostBadge}>
                    <Text style={styles.pointCostBadgeText}>-12,000P</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 달력 모달 */}
      <Modal visible={showCalendar} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContent}>
            <Text style={styles.modalTitle}>날짜 선택</Text>
            <Calendar
              current={date}
              minDate={todayISO()}
              maxDate={maxBookableDateISO()}
              onDayPress={(day) => {
                setDate(day.dateString);
                setShowCalendar(false);
              }}
              dayComponent={({ date: dayDate, state }) => {
                const isSelected = dayDate.dateString === date;
                const dayOfWeek = new Date(`${dayDate.dateString}T00:00:00`).getDay();
                const weekendColor = dayOfWeek === 0
                  ? WEEKEND_TEXT_COLORS.sunday
                  : dayOfWeek === 6
                    ? WEEKEND_TEXT_COLORS.saturday
                    : colors.text;
                const textColor = state === 'disabled'
                  ? colors.textLight
                  : isSelected
                    ? '#FFFFFF'
                    : weekendColor;

                return (
                  <TouchableOpacity
                    disabled={state === 'disabled'}
                    onPress={() => {
                      setDate(dayDate.dateString);
                      setShowCalendar(false);
                    }}
                    style={[styles.calendarDay, isSelected && styles.calendarDaySelected]}
                  >
                    <Text style={[styles.calendarDayText, { color: textColor }]}>
                      {dayDate.day}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              markedDates={{
                [date]: { selected: true, selectedColor: colors.primary }
              }}
              theme={{
                selectedDayBackgroundColor: colors.primary,
                todayTextColor: colors.primary,
                arrowColor: colors.primary,
              }}
            />
            <TouchableOpacity 
              style={[styles.modalBtn, styles.cancelBtn, { marginTop: 16 }]}
              onPress={() => setShowCalendar(false)}
            >
              <Text style={styles.cancelBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 카페 선택 모달 */}
      <Modal visible={showVenueModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContent}>
            <Text style={styles.modalTitle}>보드게임 카페 선택</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {Object.keys(VENUE_OPTIONS).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={styles.optionItem}
                  onPress={() => handleVenueSelect(v)}
                >
                  <Text style={styles.optionItemText}>{v}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.modalBtn, styles.cancelBtn, { marginTop: 16 }]}
              onPress={() => setShowVenueModal(false)}
            >
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 지점 선택 모달 */}
      <Modal visible={showBranchModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContent}>
            <Text style={styles.modalTitle}>{venue} 지점 선택</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {(VENUE_OPTIONS[venue] || []).map((b) => (
                <TouchableOpacity
                  key={b.branch}
                  style={styles.optionItem}
                  onPress={() => handleBranchSelect(b)}
                >
                  <Text style={styles.optionItemText}>{b.branch}</Text>
                  <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 2 }}>{b.address}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.modalBtn, styles.cancelBtn, { marginTop: 16 }]}
              onPress={() => setShowBranchModal(false)}
            >
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  content: { padding: 20 },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
  },
  difficultyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  difficultyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  difficultyBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  difficultyText: {
    fontSize: 13,
    color: colors.text,
  },
  difficultyTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 16,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  switchSubLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalSubText: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 8,
  },
  ruleItem: {
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: 10,
  },
  ruleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 3,
  },
  ruleDesc: {
    fontSize: 12,
    color: colors.textLight,
    lineHeight: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLight,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
  },
  confirmBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  pointCostBadge: {
    backgroundColor: '#FFF3F0',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pointCostBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.error,
  },
  labelCount: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textLight,
  },
  selectedPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selectedChipText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  genreTabsRow: {
    gap: 8,
    paddingBottom: 10,
    paddingTop: 2,
  },
  genreTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F1F2F6',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  genreTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genreTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636E72',
  },
  genreTabTextActive: {
    color: '#FFFFFF',
  },
  gamesSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  gameSelectCard: {
    width: '23%',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    position: 'relative',
  },
  gameSelectCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#F4F7FB',
  },
  selectedCheckBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
  },
  gameSelectImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F2F6',
  },
  gameSelectName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginTop: 6,
  },
  gameSelectNameActive: {
    color: colors.primary,
  },
  selectInputButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  selectInputButtonLabel: {
    fontSize: 11,
    color: colors.textLight,
    fontWeight: 'bold',
  },
  selectInputButtonValue: {
    fontSize: 15,
    color: colors.text,
    marginTop: 4,
    fontWeight: '600',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  addressBoxText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  timeSlotBtn: {
    width: '30%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  timeSlotBtnActive: {
    borderColor: colors.primary,
    backgroundColor: '#F4F7FB',
  },
  timeSlotText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  timeSlotTextActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tagSelectBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagSelectBtnActive: {
    borderColor: colors.primary,
    backgroundColor: '#F4F7FB',
  },
  tagSelectText: {
    fontSize: 12,
    color: colors.textLight,
  },
  tagSelectTextActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  calendarModalContent: {
    width: '90%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  calendarDay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySelected: {
    backgroundColor: colors.primary,
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionItemText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  recommendLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
  },
});
