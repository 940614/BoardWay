import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { useResponsiveLayout } from '../theme/responsive';

export default function GameDetailScreen({ route, navigation }) {
  const { game } = route.params;
  const [playing, setPlaying] = useState(false);
  const { isCompact } = useResponsiveLayout();

  const handlePlayVideo = () => {
    if (game.ruleUrl) {
      Linking.openURL(game.ruleUrl).catch(err => console.error("URL 열기 실패:", err));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{game.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={[styles.videoBanner, isCompact && styles.videoBannerCompact]}>
          <Ionicons name="logo-youtube" size={40} color={game.ruleUrl ? "#FF0000" : "#B2BEC3"} />
          <Text style={styles.videoBannerText}>게임 룰이 궁금하신가요?</Text>
          {game.ruleUrl ? (
            <TouchableOpacity style={styles.playButton} onPress={handlePlayVideo}>
              <Text style={styles.playButtonText}>유튜브에서 영상 보기</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.noVideoText}>영상 준비 중입니다</Text>
          )}
        </View>

        <View style={[styles.infoSection, isCompact && styles.infoSectionCompact]}>
          <View style={[styles.titleRow, isCompact && styles.titleRowCompact]}>
            <Text style={styles.gameName} numberOfLines={2}>{game.name}</Text>
            <View style={styles.difficultyBadge}>
              <Text style={styles.difficultyText}>{game.difficulty}</Text>
            </View>
          </View>
          
          <Text style={styles.gameDesc}>{game.description}</Text>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Ionicons name="people" size={24} color={colors.primary} />
              <Text style={styles.statLabel}>추천 인원</Text>
              <Text style={styles.statValue}>{game.players}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBox}>
              <Ionicons name="time" size={24} color={colors.primary} />
              <Text style={styles.statLabel}>난이도</Text>
              <Text style={styles.statValue}>{game.difficulty}</Text>
            </View>
          </View>

          <View style={styles.ruleSection}>
            <Text style={styles.sectionTitle}>🏆 게임의 목표</Text>
            <Text style={styles.ruleText}>
              이 게임은 {game.name}으로, 보드게임 매니아들 사이에서 매우 인기 있는 게임입니다. 
              상세한 규칙은 위 영상을 참고하시거나, 매칭 현장에서 가이드분께 문의해 주세요!
            </Text>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity 
        style={[styles.bottomBtn, isCompact && styles.bottomBtnCompact]}
        onPress={() => navigation.navigate('Discovery')}
      >
        <Text style={styles.bottomBtnText}>이 게임 매칭 찾기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  videoBanner: {
    backgroundColor: '#1E1E1E',
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBannerCompact: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  videoBannerText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 10,
    marginBottom: 16,
  },
  playButton: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  noVideoText: {
    color: '#B2BEC3',
    fontSize: 14,
    marginTop: 8,
  },
  infoSection: {
    padding: 24,
  },
  infoSectionCompact: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  titleRowCompact: {
    alignItems: 'flex-start',
  },
  gameName: {
    flex: 1,
    flexShrink: 1,
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  difficultyBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  difficultyText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  gameDesc: {
    fontSize: 16,
    color: colors.textLight,
    lineHeight: 24,
    marginBottom: 32,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    ...commonStyles.shadow,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 4,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  ruleText: {
    fontSize: 15,
    color: colors.textLight,
    lineHeight: 22,
  },
  bottomBtn: {
    backgroundColor: colors.primary,
    margin: 20,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBtnCompact: {
    marginHorizontal: 16,
    marginVertical: 14,
  },
  bottomBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
