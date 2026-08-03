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
    return (
      <View style={styles.listHeaderContainer}>
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
