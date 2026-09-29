// 백엔드가 일시적으로 연결되지 않을 때도 도감이 비어 보이지 않도록 하는 읽기 전용 기본 데이터입니다.
// 정상적인 API 응답이 오면 서버 데이터가 이 목록보다 우선합니다.
const rows = [
  ['스플랜더','2-4인','보통','전략 / 엔진 빌딩',30], ['카탄','3-4인','어려움','전략 / 협상',90],
  ['루미큐브','2-4인','쉬움','숫자 / 타일',45], ['뱅!','4-7인','보통','마피아 / 심리전 / 다인용 게임',40],
  ['할리갈리','2-6인','쉬움','파티 / 순발력',15], ['다빈치 코드','2-4인','쉬움','추리 / 숫자',20],
  ['텔레스트레이션','4-8인','쉬움','파티 / 드로잉 / 다인용 게임',30], ['달무티','4-8인','쉬움','파티 / 카드 / 다인용 게임',30],
  ['아발론','5-10인','보통','마피아 / 심리전 / 다인용 게임',30], ['딕싯','3-6인','쉬움','파티 / 스토리텔링',30],
  ['윙스팬','1-5인','보통','전략 / 엔진 빌딩',60], ['코드네임','2-8인','쉬움','단어 / 팀 대항 / 다인용 게임',20],
  ['테라포밍 마스','1-5인','매우 어려움','전략 / 헤비게임',120], ['젠가','1-10인','쉬움','파티 / 균형 / 다인용 게임',20],
  ['부루마불','2-4인','쉬움','고전 / 경제',90], ['아줄','2-4인','보통','추상 전략 / 타일 배치',40],
  ['라스베가스','2-5인','쉬움','파티 / 주사위',30], ['스컬킹','2-6인','보통','카드 / 트릭 테이킹',45],
  ['클루','2-6인','보통','추리 / 블러핑',45], ['레지스탕스 쿠','2-6인','쉬움','마피아 / 블러핑',20],
  ['패치워크','2인 전용','쉬움','타일 배치 / 2인 전용',30], ['러브레터','2-4인','쉬움','카드 / 심리전',20],
  ['바퀴벌레 포커 로얄','2-6인','쉬움','마피아 / 블러핑',25], ['도블','2-8인','쉬움','파티 / 스피드 / 다인용 게임',15],
  ['우노','2-10인','쉬움','카드 / 파티 / 다인용 게임',20], ['노땡스','3-7인','쉬움','카드 / 심리전 / 다인용 게임',20],
  ['사보타지','3-10인','보통','마피아 / 협력 / 다인용 게임',30], ['익스플로딩 키튼','2-5인','쉬움','카드 / 파티',20],
  ['스시고','2-5인','쉬움','카드 / 전략',20], ['카르카손','2-5인','보통','전략 / 타일 배치',45],
  ['킹오브도쿄','2-6인','보통','전략 / 주사위',45], ['팬데믹','2-4인','보통','전략 / 협력',60],
  ['블러프','2-6인','쉬움','마피아 / 주사위',30], ['보난자','2-7인','쉬움','카드 / 협상 / 다인용 게임',45],
  ['티켓 투 라이드','2-5인','보통','전략 / 노선',60], ['7원더스','3-7인','보통','전략 / 드래프팅 / 다인용 게임',45],
  ['우봉고','2-4인','쉬움','파티 / 퍼즐',25],
];

const durationLabel = (minutes) => {
  if (minutes <= 20) return '약 20분';
  if (minutes <= 30) return '약 30분';
  if (minutes <= 45) return '약 45분';
  if (minutes <= 60) return '약 1시간';
  if (minutes <= 90) return '약 1시간 30분';
  return '약 2시간';
};

export const FALLBACK_GAMES = rows.map(([name, players, difficulty, genre, durationMinutes], index) => ({
  id: `fallback-g${index + 1}`,
  name,
  players,
  difficulty,
  genre,
  durationMinutes,
  duration: durationLabel(durationMinutes),
  description: `${name} 게임의 기본 정보입니다. 상세 룰과 AI 룰북 도우미는 백엔드 연결 후 이용할 수 있습니다.`,
  ruleUrl: '',
  image: null,
}));

const playerRangeIncludes = (players, target) => {
  const numbers = players.match(/\d+/g)?.map(Number) || [];
  if (numbers.length === 1) return numbers[0] === target;
  return target >= numbers[0] && target <= numbers[1];
};

export function getFallbackBeginnerRecommendations(players, availableMinutes, difficultyPreference = '쉬움', genrePreference = '전체') {
  return FALLBACK_GAMES
    .map((game) => {
      // 서버와 같은 기준의 점수. 장르·난이도 불일치를 실제 순위 차이로 만든다.
      let score = { 쉬움: 45, 보통: 32, 어려움: 18, '매우 어려움': 10 }[game.difficulty] ?? 20;
      const reasons = [];
      if (game.difficulty === '쉬움') {
        reasons.push('쉬운 난이도');
      } else if (game.difficulty === '보통') {
        reasons.push('입문 가능한 난이도');
      } else {
        score -= 10;
      }
      if (difficultyPreference === '쉬움') {
        if (game.difficulty === '쉬움') {
          score += 24;
          reasons.push('선호 난이도 일치');
        } else score -= 12;
      } else if (difficultyPreference === '보통') {
        if (game.difficulty === '보통') {
          score += 24;
          reasons.push('선호 난이도 일치');
        } else score -= 8;
      } else if (difficultyPreference === '도전') {
        if (game.difficulty === '어려움' || game.difficulty === '매우 어려움') {
          score += 30;
          reasons.push('도전 난이도 선호');
        } else score -= 12;
      }
      if (genrePreference !== '전체') {
        if (game.genre.includes(genrePreference)) {
          score += 26;
          reasons.push(`${genrePreference} 장르 선호`);
        } else score -= 26;
      }
      if (playerRangeIncludes(game.players, players)) {
        score += 18;
        reasons.push(`${players}명 플레이 가능`);
      } else score -= 35;
      if (game.durationMinutes <= availableMinutes) {
        score += 13;
        reasons.push(`약 ${game.durationMinutes}분 소요`);
      }
      else score -= Math.min(25, Math.ceil((game.durationMinutes - availableMinutes) / 5));
      return { ...game, recommendationScore: Math.max(0, Math.min(100, score)), recommendationReasons: reasons };
    })
    .filter((game) => game.recommendationScore >= 60)
    .sort((a, b) => b.recommendationScore - a.recommendationScore || a.durationMinutes - b.durationMinutes)
    .slice(0, 3);
}
