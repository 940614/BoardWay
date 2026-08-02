import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

import { notify } from '../utils/dialog';
import { apiFetch, setUnauthorizedHandler } from '../utils/api';

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
      const response = await apiFetch('/me', { token: authToken });
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
      notify('알림', '이메일과 비밀번호를 입력해주세요.');
      return false;
    }

    try {
      const response = await apiFetch('/login', {
        method: 'POST',
        json: { email, password },
        skipAuthHandler: true, // 401 = "비번 틀림", logout 트리거 안 함
      });

      const data = await response.json();

      if (response.ok) {
        const userToken = data.access_token;
        const userData = data.user;
        
        setToken(userToken);
        setUser(userData); // userData.points 가 useEffect 를 통해 setPoints 자동 반영
        await AsyncStorage.setItem('userToken', userToken);
        return true;
      } else {
        notify('로그인 실패', data.detail || '이메일 또는 비밀번호를 확인해주세요.');
        return false;
      }
    } catch (error) {
      console.error('로그인 에러:', error);
      notify('에러', '서버와 연결할 수 없습니다.');
      return false;
    }
  };

  const signup = async (email, password, nickname) => {
    if (!email || !password || !nickname) {
      notify('알림', '모든 정보를 입력해주세요.');
      return false;
    }

    try {
      const response = await apiFetch('/signup', {
        method: 'POST',
        json: { email, password, nickname, mannerScore: 5 },
      });

      const data = await response.json();

      if (response.ok) {
        notify('가입 완료', '회원가입이 완료되었습니다! 로그인 해주세요.');
        return true;
      } else {
        notify('가입 실패', data.detail || '이미 사용 중인 이메일이거나 오류가 발생했습니다.');
        return false;
      }
    } catch (error) {
      console.error('회원가입 에러:', error);
      notify('에러', '서버와 연결할 수 없습니다.');
      return false;
    }
  };

  const [points, setPoints] = useState(0);
  const [pointHistory, setPointHistory] = useState([]);
  const [reviewedMatches, setReviewedMatches] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (user) {
      setPoints(user.points || 0);
      loadUserPointHistory();
      loadUserReviewData();
      loadNotifications();
    } else {
      setPoints(0);
      setPointHistory([]);
      setReviewedMatches([]);
      setNotifications([]);
    }
  }, [user, token]);

  useEffect(() => {
    if (!user || !token) return;
    const id = setInterval(() => { loadNotifications(); }, 5000);
    return () => clearInterval(id);
  }, [user, token]);

  const loadUserPointHistory = async () => {
    if (!token) return;
    try {
      const response = await apiFetch('/me/points/history', { token });
      if (!response.ok) {
        console.error('포인트 히스토리 조회 실패', response.status);
        return;
      }
      const data = await response.json();
      setPointHistory(data);
    } catch (e) {
      console.error('Failed to load point history', e);
    }
  };

  const loadUserReviewData = async () => {
    if (!token) return;
    try {
      const response = await apiFetch('/me/reviewed-matches', { token });
      if (!response.ok) {
        console.error('리뷰 완료 매치 조회 실패', response.status);
        return;
      }
      const data = await response.json();
      setReviewedMatches(data); // 비즈니스 ID 리스트 (예: ["m1", "m3"])
    } catch (e) {
      console.error('Failed to load reviewed matches', e);
    }
  };

  const loadNotifications = async () => {
    if (!token) return;
    try {
      const response = await apiFetch('/me/notifications', { token });
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data);
    } catch (e) {
      // 폴링이라 조용히 무시
    }
  };

  const markNotificationRead = async (notifId) => {
    if (!token) return;
    try {
      const response = await apiFetch(`/me/notifications/${notifId}/read`, { method: 'POST', token });
      if (response.ok) {
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
      }
    } catch (e) {}
  };

  const markAllNotificationsRead = async () => {
    if (!token) return;
    try {
      const response = await apiFetch('/me/notifications/read-all', { method: 'POST', token });
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (e) {}
  };

  const verifyAndRechargePoints = async (paymentId, amount) => {
    if (!user || !token) return false;
    try {
      const response = await apiFetch('/payments/verify', {
        method: 'POST',
        token,
        json: { payment_id: paymentId, amount },
      });
      if (!response.ok) {
        console.error('결제 검증 실패', response.status);
        return false;
      }
      const updatedUser = await response.json();
      setUser(updatedUser);
      await loadUserPointHistory();
      return true;
    } catch (e) {
      console.error('결제 검증 에러', e);
      return false;
    }
  };

  const rechargePoints = async (amount, description = '포인트 충전') => {
    if (!user || !token) return false;

    try {
      const response = await apiFetch('/me/points/adjust', {
        method: 'POST',
        token,
        json: { delta: amount, description },
      });
      if (!response.ok) {
        console.error('포인트 적립 실패', response.status);
        return false;
      }
      const updatedUser = await response.json();
      setUser(updatedUser); // points 는 useEffect 가 갱신
      await loadUserPointHistory();
      return true;
    } catch (e) {
      console.error('Failed to recharge points', e);
      return false;
    }
  };

  const usePoints = async (amount, description) => {
    if (!user || !token) return { success: false, message: '로그인이 필요합니다.' };
    if (user.is_admin) {
      return { success: true };
    }
    if (points < amount) return { success: false, message: '포인트가 부족합니다.' };

    try {
      const response = await apiFetch('/me/points/adjust', {
        method: 'POST',
        token,
        json: { delta: -amount, description },
      });
      if (!response.ok) {
        return { success: false, message: '서버 오류가 발생했습니다.' };
      }
      const updatedUser = await response.json();
      setUser(updatedUser);
      await loadUserPointHistory();
      return { success: true };
    } catch (e) {
      console.error('Failed to use points', e);
      return { success: false, message: '저장 오류가 발생했습니다.' };
    }
  };

  const submitMatchReviews = async (matchId, reviews, comment = '') => {
    if (!user || !token) return { success: false, message: '로그인이 필요합니다.' };
    const submitRequest = () => apiFetch('/me/reviews', {
      method: 'POST',
      token,
      json: { match_id: matchId, comment, reviews },
    });

    try {
      let response;
      try {
        response = await submitRequest();
      } catch (firstError) {
        // Railway 재시작·일시적인 네트워크 단절로 응답을 못 받은 경우 한 번만 재시도합니다.
        // 서버는 동일 매치의 중복 평점을 막으므로 안전합니다.
        await new Promise((resolve) => setTimeout(resolve, 700));
        response = await submitRequest();
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // 첫 요청은 저장되었지만 응답만 끊긴 경우 재시도에서 중복 메시지를 받을 수 있습니다.
        // 이 경우에는 이미 평가가 반영된 것이므로 완료 처리합니다.
        if (String(data.detail || '').includes('이미 리뷰')) {
          await loadUserReviewData();
          return { success: true };
        }
        return { success: false, message: data.detail || '리뷰 제출에 실패했습니다.' };
      }
      await loadUserReviewData(); // 완료 매치 목록 서버에서 다시
      return { success: true };
    } catch (e) {
      console.error('Failed to submit reviews', e);
      return {
        success: false,
        message: `서버와 연결할 수 없습니다. (${e?.message || 'network error'})`,
      };
    }
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    setPoints(0);
    setPointHistory([]);
    setReviewedMatches([]);
    setNotifications([]);
    await AsyncStorage.removeItem('userToken');
  };

  // apiFetch 가 401 을 만나면 자동 logout 트리거. mount 시 1회 등록.
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, loading, login, signup, logout, fetchUserInfo,
      points, pointHistory, loadUserPointHistory, rechargePoints, verifyAndRechargePoints, usePoints,
      reviewedMatches, submitMatchReviews,
      notifications, loadNotifications, markNotificationRead, markAllNotificationsRead,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
