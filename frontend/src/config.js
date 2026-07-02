import { Platform } from 'react-native';
import Constants from 'expo-constants';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;

function inferApiUrl() {
  // 1. .env 에 명시했으면 그거 우선 (배포·터널 같은 특수 케이스)
  if (envApiUrl) return envApiUrl;

  // 2. 웹 (브라우저) — 같은 PC 라서 localhost 면 끝
  if (Platform.OS === 'web') return 'http://127.0.0.1:8000';

  // 3. 폰(Expo Go): Metro 가 폰한테 알려준 호스트 IP 를 자동 추출
  //    예: "192.168.0.42:8081" → "192.168.0.42"
  const hostUri =
    Constants.expoConfig?.hostUri || Constants.expoGoConfig?.hostUri || '';
  const host = hostUri.split(':')[0];
  if (host) return `http://${host}:8000`;

  // 4. 마지막 폴백 (Android 에뮬레이터 — 실기기 아님)
  return 'http://10.0.2.2:8000';
}

export const API_URL = inferApiUrl();

// WebSocket URL — https → wss, http → ws 자동 변환
export const WS_URL = API_URL.replace(/^http/, 'ws');
