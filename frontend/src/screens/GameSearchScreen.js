import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Image, ActivityIndicator,
  SafeAreaView, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { apiFetch } from '../utils/api';
import { useResponsiveLayout } from '../theme/responsive';

// 장르 탭 — 키워드가 game.genre에 포함되면 해당 탭에 속함
const GENRE_TABS = ['전체', '다인용 게임', '전략', '파티', '마피아', '추리', '카드', '타일', '고전', '단어'];

export default function GameSearchScreen({ navigation }) {
  const { isCompact } = useResponsiveLayout();
  const [searchQuery, setSearchQuery] = useState('');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState('전체');
  const [beginnerPlayers, setBeginnerPlayers] = useState(4);
  const [beginnerMinutes, setBeginnerMinutes] = useState(60);
  const [beginnerRecommendations, setBeginnerRecommendations] = useState([]);
  const [recommendationLoading, setRecommendationLoading] = useState(false);

  useEffect(() => {
    fetchGames();
    fetchBeginnerRecommendations(4, 60);
  }, []);

  const fetchGames = async () => {
    try {
      const response = await apiFetch('/games');
      const data = await response.json();
      setGames(data.games);
    } catch (error) {
      console.error('게임 데이터를 불러오는 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBeginnerRecommendations = async (players, minutes) => {
    setRecommendationLoading(true);
    try {
      const response = await apiFetch(
        `/games/beginner-recommendations?players=${players}&available_minutes=${minutes}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || '추천을 불러오지 못했습니다.');
      setBeginnerRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('초보자 추천을 불러오는 중 오류:', error);
      setBeginnerRecommendations([]);
    } finally {
      setRecommendationLoading(false);
    }
  };

  const selectBeginnerOption = (type, value) => {
    const nextPlayers = type === 'players' ? value : beginnerPlayers;
    const nextMinutes = type === 'minutes' ? value : beginnerMinutes;
    if (type === 'players') setBeginnerPlayers(value);
    else setBeginnerMinutes(value);
    fetchBeginnerRecommendations(nextPlayers, nextMinutes);
  };

  const filteredGames = games.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre =
      selectedGenre === '전체' || (game.genre && game.genre.includes(selectedGenre));
    return matchesSearch && matchesGenre;
  });

  const GenreTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.genreTabsContainer}
    >
      {GENRE_TABS.map(genre => (
        <TouchableOpacity
          key={genre}
          style={[styles.genreTab, selectedGenre === genre && styles.genreTabActive]}
          onPress={() => setSelectedGenre(genre)}
          activeOpacity={0.7}
        >
          <Text style={[styles.genreTabText, selectedGenre === genre && styles.genreTabTextActive]}>
            {genre}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const ListHeader = () => {
    return (
      <View style={styles.listHeaderContainer}>
        <View style={styles.beginnerCard}>
          <View style={styles.beginnerTitleRow}>
            <View style={styles.beginnerIconWrap}>
              <Ionicons name="sparkles" size={20} color="#6941C6" />
            </View>
            <View style={styles.beginnerTitleContent}>
              <Text style={styles.beginnerTitle}>초보자 맞춤 게임 추천</Text>
              <Text style={styles.beginnerSubtitle}>인원과 가능한 시간을 고르면 입문용 게임을 골라드려요.</Text>
            </View>
          </View>

          <View style={styles.beginnerOptions}>
            <View style={styles.optionGroup}>
              <Text style={styles.optionLabel}>함께하는 인원</Text>
              <View style={styles.optionButtons}>
                {[2, 4, 6].map((count) => (
                  <TouchableOpacity
                    key={count}
                    style={[styles.optionButton, beginnerPlayers === count && styles.optionButtonActive]}
                    onPress={() => selectBeginnerOption('players', count)}
                  >
                    <Text style={[styles.optionButtonText, beginnerPlayers === count && styles.optionButtonTextActive]}>{count}명</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.optionGroup}>
              <Text style={styles.optionLabel}>가능 시간</Text>
              <View style={styles.optionButtons}>
                {[[30, '30분'], [60, '1시간'], [90, '1시간+']].map(([minutes, label]) => (
                  <TouchableOpacity
                    key={minutes}
                    style={[styles.optionButton, beginnerMinutes === minutes && styles.optionButtonActive]}
                    onPress={() => selectBeginnerOption('minutes', minutes)}
                  >
                    <Text style={[styles.optionButtonText, beginnerMinutes === minutes && styles.optionButtonTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {recommendationLoading ? (
            <ActivityIndicator color="#6941C6" style={styles.recommendationSpinner} />
          ) : beginnerRecommendations.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationList}>
              {beginnerRecommendations.map((game) => (
                <TouchableOpacity
                  key={game.id}
                  style={styles.recommendationItem}
                  onPress={() => navigation.navigate('GameDetail', { game })}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: game.image }} style={styles.recommendationImage} />
                  <View style={styles.recommendationInfo}>
                    <Text style={styles.recommendationScore}>입문 추천 {game.recommendationScore}점</Text>
                    <Text style={styles.recommendationName} numberOfLines={1}>{game.name}</Text>
                    <Text style={styles.recommendationMeta}>{game.players} · {game.duration}</Text>
                    <Text style={styles.recommendationReason} numberOfLines={2}>{game.recommendationReasons.join(' · ')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.recommendationEmpty}>추천을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.</Text>
          )}

        <Text style={styles.sectionTitle}>
          {selectedGenre === '전체' ? '전체 게임 도감' : `${selectedGenre} 게임`}
          <Text style={styles.sectionCount}> {filteredGames.length}개</Text>
        </Text>
      </View>
    );
  };

  const renderGameItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.gameCard, isCompact && styles.gameCardCompact]}
      onPress={() => navigation.navigate('GameDetail', { game: item })}
    >
      <View style={styles.gameImageContainer}>
        <Image source={{ uri: item.image }} style={styles.gameImage} />
        <View style={styles.gameDifficultyBadge}>
          <Text style={styles.difficultyBadgeText}>{item.difficulty}</Text>
        </View>
      </View>
      <View style={[styles.gameInfo, isCompact && styles.gameInfoCompact]}>
        <Text style={styles.gameName} numberOfLines={1}>{item.name}</Text>
        {item.genre && (
          <View style={styles.genrePill}>
            <Text style={styles.genrePillText} numberOfLines={1}>{item.genre}</Text>
          </View>
        )}
        <View style={styles.gameMeta}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>👥 {item.players}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>보드게임 도감</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.primary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="찾으시는 보드게임이 있나요?"
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={text => {
              setSearchQuery(text);
              if (text) setSelectedGenre('전체'); // 검색 시 장르 필터 초기화
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
        <GenreTabs />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          key="game-grid-2"
          data={filteredGames}
          renderItem={renderGameItem}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gameGridRow}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={64} color={colors.border} />
              <Text style={styles.emptyText}>
                {selectedGenre !== '전체'
                  ? `"${selectedGenre}" 장르 게임이 없어요`
                  : '찾으시는 게임이 아직 도감에 없네요!'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
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
    color: '#2D3436',
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...commonStyles.shadow,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F2F6',
    paddingHorizontal: 16,
    borderRadius: 15,
    marginTop: 8,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#2D3436',
  },
  genreTabsContainer: {
    paddingBottom: 4,
    gap: 8,
  },
  genreTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F2F6',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  genreTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genreTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
  },
  genreTabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  listHeaderContainer: {
    paddingVertical: 16,
  },
  beginnerCard: {
    backgroundColor: '#FBF9FF',
    borderWidth: 1,
    borderColor: '#E8DEFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  beginnerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  beginnerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0E9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  beginnerTitleContent: { flex: 1 },
  beginnerTitle: {
    color: '#5631B5',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 3,
  },
  beginnerSubtitle: { color: '#73708A', fontSize: 13, lineHeight: 19 },
  beginnerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 15,
  },
  optionGroup: { flexGrow: 1 },
  optionLabel: { color: '#656176', fontSize: 12, fontWeight: '700', marginBottom: 7 },
  optionButtons: { flexDirection: 'row', gap: 5 },
  optionButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1D8F6',
  },
  optionButtonActive: { backgroundColor: '#6941C6', borderColor: '#6941C6' },
  optionButtonText: { color: '#625C73', fontSize: 12, fontWeight: '700' },
  optionButtonTextActive: { color: '#FFFFFF' },
  recommendationSpinner: { marginVertical: 24 },
  recommendationList: { gap: 10, paddingTop: 15 },
  recommendationItem: {
    width: 245,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEAF6',
    borderRadius: 13,
    padding: 10,
  },
  recommendationImage: { width: 58, height: 58, borderRadius: 9, backgroundColor: '#F1F2F6', marginRight: 9 },
  recommendationInfo: { flex: 1, minWidth: 0 },
  recommendationScore: { color: '#6941C6', fontSize: 10, fontWeight: '800', marginBottom: 2 },
  recommendationName: { color: '#2D3436', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  recommendationMeta: { color: '#687386', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  recommendationReason: { color: '#847D94', fontSize: 10, lineHeight: 14 },
  recommendationEmpty: { color: '#847D94', fontSize: 13, marginTop: 16 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2D3436',
    marginBottom: 16,
  },
  sectionCount: {
    fontSize: 16,
    fontWeight: '400',
    color: '#B2BEC3',
  },
  gameCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 9,
    ...commonStyles.shadow,
  },
  gameCardCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 10,
  },
  gameGridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gameImageContainer: {
    position: 'relative',
    width: 62,
    height: 62,
    flexShrink: 0,
  },
  gameImage: {
    width: 62,
    height: 62,
    borderRadius: 10,
    backgroundColor: '#F1F2F6',
  },
  gameDifficultyBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  difficultyBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gameInfo: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  gameInfoCompact: {
    marginLeft: 0,
    marginTop: 8,
  },
  gameName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 5,
  },
  genrePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    maxWidth: '100%',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 5,
  },
  genrePillText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
  gameMeta: {
    flexDirection: 'row',
  },
  metaBadge: {
    backgroundColor: '#F1F2F6',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaBadgeText: {
    fontSize: 11,
    color: '#2D3436',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#B2BEC3',
    fontWeight: '600',
    textAlign: 'center',
  },
});
