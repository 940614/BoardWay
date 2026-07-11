import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { MatchContext } from '../context/MatchContext';
import { AuthContext } from '../context/AuthContext';
import { notify, confirmAction } from '../utils/dialog';
import YoutubePlayer from "react-native-youtube-iframe";
import { WebView } from 'react-native-webview';

const hiddenChatKey = (userId) => `hiddenMatchChats:${userId || 'guest'}`;

// 지도/유튜브 임베드 — 웹에선 iframe, 모바일은 기존 라이브러리.
// Platform.OS 분기로 보호되어 모바일에선 iframe 코드가 호출되지 않음.
const MapEmbed = ({ query, height = 200 }) => {
  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  if (Platform.OS === 'web') {
    return (
      <iframe
        src={embedUrl}
        style={{ width: '100%', height, border: 0 }}
        title="지도"
      />
    );
  }
  return (
    <WebView
      source={{ uri: embedUrl }}
      style={{ flex: 1 }}
      scrollEnabled={false}
    />
  );
};

const YoutubeEmbed = ({ videoId, height = 200 }) => {
  if (!videoId) return null;
  if (Platform.OS === 'web') {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        style={{ width: '100%', height, border: 0 }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="rule video"
      />
    );
  }
  return <YoutubePlayer height={height} play={false} videoId={videoId} />;
};

export default function MatchDetailScreen({ route, navigation }) {
  const { matchId } = route.params;
  const { matches, joinMatch, cancelMatch } = useContext(MatchContext);
  const { user, points, usePoints } = useContext(AuthContext);
  
  const [match, setMatch] = useState(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const foundMatch = matches.find(m => m.id === matchId);
    setMatch(foundMatch);
  }, [matchId, matches]);

  if (!match) return <View style={commonStyles.container}><Text>매치를 찾을 수 없습니다.</Text></View>;

  const isAlreadyJoined = user && match.participants.some(p => p.nickname === user.nickname);

  const openParticipantProfile = (participant) => {
    if (!participant.user_id) {
      notify('알림', '이 사용자의 프로필 정보를 찾을 수 없습니다.');
      return;
    }
    navigation.navigate('UserProfile', {
      userId: participant.user_id,
      nickname: participant.nickname,
    });
  };

  const handleJoin = async () => {
    if (!user?.is_admin && points < 12000) {
      notify('포인트 부족', '보유 포인트가 부족합니다. 충전 후 이용해주세요.');
      return;
    }

    setIsJoining(true);

    const cost = 12000;
    const gamesLabel = match.is_flexible ? '자율 선택' : match.games.join(', ');
    const pointResult = await usePoints(cost, `[${gamesLabel}] 매치 참여 결제`);

    if (!pointResult.success) {
      notify('오류', pointResult.message);
      setIsJoining(false);
      return;
    }

    const joinResult = await joinMatch(match.id);
    setIsJoining(false);

    if (joinResult.success) {
      setModalVisible(false);
      notify('신청 완료', '매칭 신청 및 결제가 완료되었습니다! 내 매치에서 확인하세요.');
      navigation.navigate('MyMatches');
    } else {
      notify('오류', joinResult.message || '매치 참여에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const renderDice = (score) => {
    const rounded = Math.round(score);
    return (
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[1, 2, 3, 4, 5, 6].map((num) => (
          <Ionicons 
            key={num} 
            name={rounded >= num ? "dice" : "dice-outline"} 
            size={18} 
            color={rounded >= num ? colors.secondary : colors.border} 
          />
        ))}
      </View>
    );
  };

  const extractVideoId = (url) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
  };

  const mapQuery = match.location.address;

  const matchStart = new Date(`${match.date}T${match.startTime}:00`);
  const now = new Date();
  const isStarted = now > matchStart;
  const isFull = match.participants.length >= match.maxPlayers;
  const isCancelled = !!match.cancelled;
  const isAdmin = !!user?.is_admin;
  const isHost = user && match.host === user.nickname;

  const openChatRoom = async () => {
    if (user) {
      try {
        const key = hiddenChatKey(user.id || user.email || user.nickname);
        const saved = await AsyncStorage.getItem(key);
        const hiddenIds = saved ? JSON.parse(saved) : [];
        const next = hiddenIds.filter((id) => id !== match.id);
        await AsyncStorage.setItem(key, JSON.stringify(next));
      } catch (error) {}
    }
    navigation.navigate('ChatRoom', { match });
  };

  const handleCancelMatch = () => {
    const title = isHost ? '매치 취소 (방장)' : '매치 취소';
    const message = isHost
      ? `방장 권한으로 이 매치를 취소하시겠습니까?\n\n⚠️ 방장 책임 규정에 따라 개설 시 차감된 참여비(12,000P)는 환불되지 않습니다.\n(참여자 ${match.participants.length - 1}명에게는 전액 자동 환불됩니다.)`
      : `이 매치를 취소하시겠습니까?\n참여자 ${match.participants.length}명에게 12,000P 씩 자동 환불됩니다.`;

    confirmAction(
      title,
      message,
      async () => {
        const result = await cancelMatch(match.id);
        if (result.success) {
          notify('취소 완료', result.message || '매치가 취소되었습니다.');
          navigation.goBack();
        } else {
          notify('오류', result.message);
        }
      },
      { confirmText: '취소하기', destructive: true },
    );
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>매치 상세정보</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.gameSection}>
          <Text style={styles.matchDate}>{match.date} {match.startTime}</Text>
          <View style={styles.durationPill}>
            <Ionicons name="time-outline" size={15} color={colors.primary} />
            <Text style={styles.durationPillText}>정규 진행 시간 2시간</Text>
          </View>
          <Text style={styles.matchTitle}>
            {match.is_flexible ? '🎲 모여서 게임 선택 (자율 매칭)' : match.games.join(' ➔ ')}
          </Text>
          <View style={[styles.tagsContainer, { marginTop: 12 }]}>
            {match.tags.map((tag, index) => (
              <View key={index} style={commonStyles.badge}>
                <Text style={commonStyles.badgeText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>모이는 장소 📍</Text>
          <View style={styles.locationBox}>
            <Text style={styles.locationVenue}>{match.location.venue} {match.location.branch}</Text>
            <Text style={styles.locationAddress}>{match.location.address}</Text>
            <View style={styles.locationNoticeBox}>
              <Ionicons name="information-circle" size={16} color="#E67E22" style={{ marginRight: 6, marginTop: 1 }} />
              <Text style={styles.locationNoticeText}>
                선택한 보드게임이 매장에 없을 경우, 참가자들끼리 협의 하에 다른 게임을 임의로 선택하여 플레이하실 수 있습니다.
              </Text>
            </View>
          </View>
          <View style={styles.mapContainer}>
            <MapEmbed query={mapQuery} height={200} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>현재 참여자 정보 ({match.participants.length}/{match.maxPlayers})</Text>
          {match.participants.map((participant, index) => (
            <View key={index} style={styles.participantBox}>
              <View style={styles.participantNameRow}>
                <TouchableOpacity onPress={() => openParticipantProfile(participant)}>
                  <Text style={styles.participantName}>{participant.nickname}</Text>
                </TouchableOpacity>
                {match.host === participant.nickname && <Text style={styles.hostBadge}>👑 방장</Text>}
                {user && user.nickname === participant.nickname && <Text style={styles.meBadge}>(본인)</Text>}
                {participant.user_id && user && user.nickname !== participant.nickname && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ReportUser', {
                      reportedUserId: participant.user_id,
                      reportedNickname: participant.nickname,
                      matchId: match.id,
                    })}
                    style={styles.participantReportButton}
                  >
                    <Ionicons name="flag-outline" size={14} color={colors.error} />
                    <Text style={styles.participantReportText}>신고</Text>
                  </TouchableOpacity>
                )}
              </View>
              {participant.mannerScore >= 5 && (
                <Text style={styles.bestGuide}>⭐ 굿 매너 유저</Text>
              )}
              {renderDice(participant.mannerScore)}
            </View>
          ))}
        </View>

        {match.is_flexible ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>룰 숙지 인증 📺</Text>
            <View style={styles.flexibleNoticeBox}>
              <Ionicons name="information-circle-outline" size={24} color="#9B59B6" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.flexibleNoticeTitle}>자율 선택 매칭 안내</Text>
                <Text style={styles.flexibleNoticeText}>
                  이 매칭은 사전에 보드게임이 지정되어 있지 않습니다. 오프라인 모임 장소에서 만나 대화와 투표를 통해 플레이할 게임을 자유롭게 결정하며, 게임 룰은 현장에서 함께 확인합니다.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>룰 숙지 인증 📺</Text>
            <Text style={styles.ruleSubText}>가장 바른 즐거움을 위해 아래 {match.games.length}가지 게임의 룰을 모두 숙지해주세요.</Text>
            
            <View style={styles.videoTabs}>
              {match.games.map((game, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.tabButton, activeVideoIndex === index && styles.tabButtonActive]}
                  onPress={() => setActiveVideoIndex(index)}
                >
                  <Text style={[styles.tabText, activeVideoIndex === index && styles.tabTextActive]}>
                    {game}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.videoContainer}>
              <YoutubeEmbed
                videoId={extractVideoId(match.ruleVideoUrls[activeVideoIndex])}
                height={200}
              />
            </View>
            {extractVideoId(match.ruleVideoUrls[activeVideoIndex])
              ? <Text style={styles.currentVideoLabel}>현재 영상: {match.games[activeVideoIndex]}</Text>
              : <Text style={styles.currentVideoLabel}>이 매치에는 룰 영상이 등록되어 있지 않습니다.</Text>}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {isAlreadyJoined && !isCancelled && (
          <TouchableOpacity
            style={[commonStyles.button, styles.chatRoomBtn]}
            onPress={openChatRoom}
          >
            <Ionicons name="chatbubbles-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={commonStyles.buttonText}>채팅방 들어가기</Text>
          </TouchableOpacity>
        )}

        {(isAdmin || isHost) && !isCancelled && !match.completed && (
          <TouchableOpacity
            style={[commonStyles.button, styles.cancelMatchBtn]}
            onPress={handleCancelMatch}
          >
            <Text style={commonStyles.buttonText}>
              {isAdmin ? '매치 취소 (운영진)' : '매치 취소 (방장)'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            commonStyles.button,
            (isAlreadyJoined || isFull || isStarted || isCancelled) && { backgroundColor: '#A0A0A0' }
          ]}
          disabled={isAlreadyJoined || isFull || isStarted || isCancelled}
          onPress={() => {
            if (!user) {
              confirmAction(
                '로그인 필요',
                '매칭 신청은 로그인 후 이용 가능합니다.',
                () => navigation.navigate('Login'),
                { confirmText: '로그인하기' }
              );
            } else {
              setModalVisible(true);
            }
          }}
        >
          <Text style={commonStyles.buttonText}>
            {isCancelled
              ? "취소된 매치입니다"
              : isAlreadyJoined
                ? "이미 참여 완료된 매치입니다"
                : isStarted
                  ? "이미 시작된 매치입니다"
                  : isFull
                    ? "매치가 마감되었습니다"
                    : "매치 참여 결제하기"}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>매치 참여 결제 확인</Text>
            <View style={styles.paymentInfoBox}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>내 보유 포인트</Text>
                <Text style={styles.paymentValue}>{user?.is_admin ? '무한 P' : `${points.toLocaleString()} P`}</Text>
              </View>

              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>차감 예정 포인트</Text>
                <Text style={[styles.paymentValue, { color: user?.is_admin ? colors.text : colors.error }]}>
                  {user?.is_admin ? '0 P' : '- 12,000 P'}
                </Text>
              </View>
              <View style={[styles.paymentRow, styles.paymentTotalRow]}>
                <Text style={styles.paymentTotalLabel}>결제 후 잔액</Text>
                <Text style={styles.paymentTotalValue}>
                  {user?.is_admin ? '무한 P' : `${(points - 12000).toLocaleString()} P`}
                </Text>
              </View>
              <View style={styles.durationNoticeBox}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={styles.durationNoticeText}>
                  모든 매칭의 정규 진행 시간은 시작 시각부터 2시간입니다. 더 즐기고 싶다면 참여자끼리 협의하여 자유롭게 연장할 수 있습니다.
                </Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn, isJoining && { opacity: 0.7 }]}
                onPress={handleJoin}
                disabled={isJoining}
              >
                {isJoining ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>결제 및 참여</Text>
                )}
              </TouchableOpacity>
            </View>
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
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  gameSection: {
    marginBottom: 24,
  },
  matchDate: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  durationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary + '12',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  durationPillText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  matchTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  locationBox: {
    backgroundColor: '#F1F2F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  locationVenue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: colors.textLight,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#EEEEEE',
  },
  participantBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...commonStyles.shadow,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  participantReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: '#FFF4F4',
  },
  participantReportText: {
    color: colors.error,
    fontSize: 11,
    fontWeight: 'bold',
  },
  meBadge: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  hostBadge: {
    fontSize: 12,
    color: '#D4AF37',
    fontWeight: 'bold',
    marginLeft: 6,
    backgroundColor: '#00000005',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#D4AF37',
  },
  bestGuide: {
    fontSize: 12,
    color: '#D4A000',
    fontWeight: 'bold',
  },
  ruleSubText: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 16,
  },
  videoTabs: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.background,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    color: colors.textLight,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  videoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginBottom: 8,
  },
  currentVideoLabel: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    ...commonStyles.shadow,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  paymentInfoBox: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  durationNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: colors.primary + '10',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  durationNoticeText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  paymentLabel: {
    fontSize: 14,
    color: colors.textLight,
  },
  paymentValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  paymentTotalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paymentTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  paymentTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cancelMatchBtn: {
    backgroundColor: colors.error,
    marginBottom: 12,
  },
  chatRoomBtn: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  flexibleNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FDFBFF',
    borderWidth: 1,
    borderColor: '#E8DFFA',
    borderRadius: 12,
    padding: 16,
  },
  flexibleNoticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#9B59B6',
    marginBottom: 4,
  },
  flexibleNoticeText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  locationNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  locationNoticeText: {
    fontSize: 12,
    color: '#D35400',
    lineHeight: 18,
    flex: 1,
  },
});
