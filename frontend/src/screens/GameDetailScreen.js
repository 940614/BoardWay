import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Linking, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { useResponsiveLayout } from '../theme/responsive';
import { apiFetch } from '../utils/api';
import { AuthContext } from '../context/AuthContext';

export default function GameDetailScreen({ route, navigation }) {
  const { game } = route.params;
  const [playing, setPlaying] = useState(false);
  const { token } = useContext(AuthContext);
  const [question, setQuestion] = useState('');
  const [rulebookResult, setRulebookResult] = useState(null);
  const [rulebookError, setRulebookError] = useState('');
  const [askingRulebook, setAskingRulebook] = useState(false);
  const { isCompact } = useResponsiveLayout();

  const handlePlayVideo = () => {
    if (game.ruleUrl) {
      Linking.openURL(game.ruleUrl).catch(err => console.error("URL 열기 실패:", err));
    }
  };

  const handleAskRulebook = async (presetQuestion) => {
    const nextQuestion = (presetQuestion || question).trim();
    if (!nextQuestion || askingRulebook) return;
    if (!token) {
      setRulebookError('룰북 도우미를 이용하려면 로그인해 주세요.');
      return;
    }

    setQuestion(nextQuestion);
    setAskingRulebook(true);
    setRulebookError('');
    try {
      const response = await apiFetch(`/games/${encodeURIComponent(game.id)}/rulebook/ask`, {
        method: 'POST',
        token,
        json: { question: nextQuestion },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || '룰북 도우미 답변을 가져오지 못했습니다.');
      }
      setRulebookResult(data);
    } catch (error) {
      setRulebookResult(null);
      setRulebookError(error.message || '룰북 도우미와 연결하지 못했습니다.');
    } finally {
      setAskingRulebook(false);
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
              <Text style={styles.statLabel}>예상 소요 시간</Text>
              <Text style={styles.statValue}>{game.duration || '약 45분'}</Text>
            </View>
          </View>

          <View style={styles.ruleSection}>
            <Text style={styles.sectionTitle}>🏆 게임의 목표</Text>
            <Text style={styles.ruleText}>
              이 게임은 {game.name}으로, 보드게임 매니아들 사이에서 매우 인기 있는 게임입니다. 
              상세한 규칙은 위 영상을 참고하시거나, 매칭 현장에서 가이드분께 문의해 주세요!
            </Text>
          </View>

          <View style={styles.aiHelperCard}>
            <View style={styles.aiHelperTitleRow}>
              <Ionicons name="sparkles" size={22} color="#6941C6" />
              <View style={styles.aiHelperTitleText}>
                <Text style={styles.aiHelperTitle}>AI 룰북 도우미</Text>
                <Text style={styles.aiHelperSubtext}>등록된 룰북에서 근거를 찾아 답변합니다.</Text>
              </View>
            </View>

            {game.rulebookAvailable ? (
              <>
                <View style={styles.quickQuestionRow}>
                  {['게임 준비 방법', '내 차례에 할 수 있는 행동', '승리 조건'].map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={styles.quickQuestion}
                      onPress={() => handleAskRulebook(item)}
                      disabled={askingRulebook}
                    >
                      <Text style={styles.quickQuestionText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={question}
                  onChangeText={setQuestion}
                  placeholder={`${game.name} 규칙을 질문해 보세요`}
                  placeholderTextColor={colors.textLight}
                  multiline
                  maxLength={400}
                  style={styles.questionInput}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.askButton, askingRulebook && styles.askButtonDisabled]}
                  onPress={() => handleAskRulebook()}
                  disabled={askingRulebook || !question.trim()}
                >
                  {askingRulebook ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.askButtonText}>질문하기</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.rulebookPending}>
                <Ionicons name="time-outline" size={18} color={colors.textLight} />
                <Text style={styles.rulebookPendingText}>이 게임의 룰북 데이터는 준비 중입니다.</Text>
              </View>
            )}

            {rulebookError ? <Text style={styles.rulebookError}>{rulebookError}</Text> : null}

            {rulebookResult ? (
              <View style={styles.answerBox}>
                <Text style={styles.answerLabel}>
                  {rulebookResult.generation === 'llm' ? 'AI 답변' : '룰북 검색 결과'}
                </Text>
                <Text style={styles.answerText}>{rulebookResult.answer}</Text>
                {rulebookResult.sources?.length ? (
                  <View style={styles.sourcesBox}>
                    <Text style={styles.sourcesTitle}>참고한 룰북 근거</Text>
                    {rulebookResult.sources.slice(0, 3).map((source, index) => (
                      <Text key={`${source.source_file}-${source.page}-${index}`} style={styles.sourceText}>
                        [{index + 1}] {source.source_file} · {source.page}페이지
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
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
  aiHelperCard: {
    marginTop: 32,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8DEF8',
    backgroundColor: '#FCFAFF',
  },
  aiHelperTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  aiHelperTitleText: {
    flex: 1,
    marginLeft: 9,
  },
  aiHelperTitle: {
    color: '#4A2C96',
    fontSize: 18,
    fontWeight: 'bold',
  },
  aiHelperSubtext: {
    color: colors.textLight,
    fontSize: 13,
    marginTop: 3,
    lineHeight: 19,
  },
  quickQuestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  quickQuestion: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F0E9FF',
  },
  quickQuestionText: {
    fontSize: 12,
    color: '#5B38A8',
    fontWeight: '600',
  },
  questionInput: {
    minHeight: 76,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DCD5EA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  askButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 104,
    minHeight: 40,
    marginTop: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#5B38A8',
  },
  askButtonDisabled: {
    opacity: 0.6,
  },
  askButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  rulebookPending: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F4F5F7',
  },
  rulebookPendingText: {
    flex: 1,
    marginLeft: 8,
    color: colors.textLight,
    fontSize: 13,
  },
  rulebookError: {
    marginTop: 12,
    color: '#B42318',
    fontSize: 13,
    lineHeight: 19,
  },
  answerBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  answerLabel: {
    color: '#5B38A8',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  answerText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  sourcesBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEAF5',
  },
  sourcesTitle: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sourceText: {
    color: colors.textLight,
    fontSize: 12,
    lineHeight: 18,
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
