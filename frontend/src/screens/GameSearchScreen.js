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

// 장르 탭 — 키워드가 game.genre에 포함되면 해당 탭에 속함
const GENRE_TABS = ['전체', '다인용 게임', '전략', '파티', '마피아', '추리', '카드', '타일', '고전', '단어'];

export default function GameSearchScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState('전체');

  useEffect(() => {
    fetchGames();
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
    const featuredGame = games[0] || {};
    return (
      <View style={styles.listHeaderContainer}>
        {featuredGame.image && selectedGenre === '전체' && !searchQuery && (
          <TouchableOpacity
            style={styles.featuredCard}
            onPress={() => navigation.navigate('GameDetail', { game: featuredGame })}
          >
            <Image source={{ uri: featuredGame.image }} style={styles.featuredImage} />
            <View style={styles.featuredOverlay}>
              <Text style={styles.featuredLabel}>이번 주의 추천 게임</Text>
              <Text style={styles.featuredName}>{featuredGame.name}</Text>
            </View>
          </TouchableOpacity>
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
      style={styles.gameCard}
      onPress={() => navigation.navigate('GameDetail', { game: item })}
    >
      <View style={styles.gameImageContainer}>
        <Image source={{ uri: item.image }} style={styles.gameImage} />
        <View style={styles.gameDifficultyBadge}>
          <Text style={styles.difficultyBadgeText}>{item.difficulty}</Text>
        </View>
      </View>
      <View style={styles.gameInfo}>
        <Text style={styles.gameName}>{item.name}</Text>
        {item.genre && (
          <View style={styles.genrePill}>
            <Text style={styles.genrePillText}>{item.genre}</Text>
          </View>
        )}
        <Text style={styles.gameDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.gameMeta}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>👥 {item.players}</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.primary} />
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
          data={filteredGames}
          renderItem={renderGameItem}
          keyExtractor={item => item.id}
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
    paddingBottom: 30,
  },
  listHeaderContainer: {
    padding: 16,
  },
  featuredCard: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    ...commonStyles.shadow,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  featuredOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  featuredLabel: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  featuredName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
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
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    ...commonStyles.shadow,
  },
  gameImageContainer: {
    position: 'relative',
  },
  gameImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F1F2F6',
  },
  gameDifficultyBadge: {
    position: 'absolute',
    top: -5,
    left: -5,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  difficultyBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gameInfo: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  gameName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 4,
  },
  genrePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  genrePillText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  gameDesc: {
    fontSize: 13,
    color: '#636E72',
    lineHeight: 18,
    marginBottom: 8,
  },
  gameMeta: {
    flexDirection: 'row',
  },
  metaBadge: {
    backgroundColor: '#F1F2F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaBadgeText: {
    fontSize: 12,
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
