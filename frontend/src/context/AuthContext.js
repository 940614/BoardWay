import React, { createContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

import { API_URL } from '../config';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 앱 시작 시 저장된 토큰 확인
    const loadStorageData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        if (storedToken) {
          setToken(storedToken);
          // 토큰이 있으면 사용자 정보 가져오기
          await fetchUserInfo(storedToken);
        }
      } catch (e) {
        console.error('Failed to load storage data', e);
      } finally {
        setLoading(false);
      }
    };
    loadStorageData();
  }, []);

  const fetchUserInfo = async (authToken) => {
    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data);
      } else {
        // 토큰이 만료되었거나 유효하지 않은 경우
        await logout();
      }
    } catch (error) {
      console.error('Fetch user info error:', error);
    }
  };

  const login = async (email, password) => {
    if (!email || !password) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.');
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const userToken = data.access_token;
        const userData = data.user;
        
        setToken(userToken);
        setUser(userData);
        
        // 유저가 바뀌었으므로 포인트 초기화 (나중에 백엔드 연동 시 DB에서 가져올 부분)
        setPoints(0);
        setPointHistory([]);
        
        await AsyncStorage.setItem('userToken', userToken);
        return true;
      } else {
        const errorMsg = Array.isArray(data.detail)
          ? data.detail[0]?.msg || '입력값을 확인해주세요.'
          : data.detail || '이메일 또는 비밀번호를 확인해주세요.';
        Alert.alert('로그인 실패', errorMsg);
        return false;
      }
    } catch (error) {
      console.error('로그인 에러:', error);
      Alert.alert('에러', '서버와 연결할 수 없습니다.');
      return false;
    }
  };

  const signup = async (email, password, nickname) => {
    if (!email || !password || !nickname) {
      Alert.alert('알림', '모든 정보를 입력해주세요.');
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname, mannerScore: 5 }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('가입 완료', '회원가입이 완료되었습니다! 로그인 해주세요.');
        return true;
      } else {
        const errorMsg = Array.isArray(data.detail)
          ? data.detail[0]?.msg || '입력값을 확인해주세요.'
          : data.detail || '이미 사용 중인 이메일이거나 오류가 발생했습니다.';
        Alert.alert('가입 실패', errorMsg);
        return false;
      }
    } catch (error) {
      console.error('회원가입 에러:', error);
      Alert.alert('에러', '서버와 연결할 수 없습니다.');
      return false;
    }
  };

  const [points, setPoints] = useState(0);
  const [pointHistory, setPointHistory] = useState([]);

  // 유저가 로그인하거나 변경될 때 해당 유저의 포인트 데이터 로드
  useEffect(() => {
    if (user) {
      loadUserPointData(user.email);
    } else {
      setPoints(0);
      setPointHistory([]);
    }
  }, [user]);

  const loadUserPointData = async (email) => {
    try {
      const storedPoints = await AsyncStorage.getItem(`points_${email}`);
      const storedHistory = await AsyncStorage.getItem(`history_${email}`);
      
      setPoints(storedPoints ? parseInt(storedPoints, 10) : 0);
      setPointHistory(storedHistory ? JSON.parse(storedHistory) : []);
    } catch (e) {
      console.error('Failed to load point data', e);
    }
  };

  const rechargePoints = async (amount) => {
    if (!user) return false;

    const newPoints = points + amount;
    const historyItem = {
      id: Date.now().toString(),
      type: '충전',
      amount: amount,
      date: new Date().toISOString(),
      description: '포인트 충전',
    };
    const newHistory = [historyItem, ...pointHistory];

    setPoints(newPoints);
    setPointHistory(newHistory);

    try {
      await AsyncStorage.setItem(`points_${user.email}`, newPoints.toString());
      await AsyncStorage.setItem(`history_${user.email}`, JSON.stringify(newHistory));
      return true;
    } catch (e) {
      console.error('Failed to save point data', e);
      return false;
    }
  };

  const usePoints = async (amount, description) => {
    if (!user) return { success: false, message: '로그인이 필요합니다.' };
    if (points < amount) return { success: false, message: '포인트가 부족합니다.' };

    const newPoints = points - amount;
    const historyItem = {
      id: Date.now().toString(),
      type: '사용',
      amount: amount,
      date: new Date().toISOString(),
      description: description,
    };
    const newHistory = [historyItem, ...pointHistory];

    setPoints(newPoints);
    setPointHistory(newHistory);

    try {
      await AsyncStorage.setItem(`points_${user.email}`, newPoints.toString());
      await AsyncStorage.setItem(`history_${user.email}`, JSON.stringify(newHistory));
      return { success: true };
    } catch (e) {
      console.error('Failed to save point data', e);
      return { success: false, message: '저장 오류가 발생했습니다.' };
    }
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    setPoints(0);
    setPointHistory([]);
    await AsyncStorage.removeItem('userToken');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, points, pointHistory, rechargePoints, usePoints }}>
      {children}
    </AuthContext.Provider>
  );
};
