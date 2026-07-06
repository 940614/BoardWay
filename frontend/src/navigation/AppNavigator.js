import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import IntroScreen from '../screens/IntroScreen';
import DiscoveryScreen from '../screens/DiscoveryScreen';
import MatchDetailScreen from '../screens/MatchDetailScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import MatchConfirmationScreen from '../screens/MatchConfirmationScreen';
import GameSearchScreen from '../screens/GameSearchScreen';
import GameDetailScreen from '../screens/GameDetailScreen';
import MyMatchesScreen from '../screens/MyMatchesScreen';
import MyPageScreen from '../screens/MyPageScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import PointHistoryScreen from '../screens/PointHistoryScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import MatchReviewScreen from '../screens/MatchReviewScreen';
import CreateMatchScreen from '../screens/CreateMatchScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PaymentWebViewScreen from '../screens/PaymentWebViewScreen';
import CustomerSupportScreen from '../screens/CustomerSupportScreen';
import FriendsScreen from '../screens/FriendsScreen';
import FriendChatScreen from '../screens/FriendChatScreen';
import FriendMatchesScreen from '../screens/FriendMatchesScreen';
import AdminUserManagementScreen from '../screens/AdminUserManagementScreen';
import AdminUserDetailScreen from '../screens/AdminUserDetailScreen';
import AdminPointGrantScreen from '../screens/AdminPointGrantScreen';
import AdminMatchManagementScreen from '../screens/AdminMatchManagementScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Intro"
      screenOptions={{
        headerShown: false, // 커스텀 헤더를 사용하므로 기본 헤더 숨김
        animation: 'fade', // 부드러운 화면 전환
      }}
    >
      <Stack.Screen name="Intro" component={IntroScreen} />
      <Stack.Screen name="Discovery" component={DiscoveryScreen} />
      <Stack.Screen name="GameSearch" component={GameSearchScreen} options={{ title: '게임 도감' }} />
      <Stack.Screen name="GameDetail" component={GameDetailScreen} options={{ title: '게임 정보' }} />
      <Stack.Screen name="MyMatches" component={MyMatchesScreen} />
      <Stack.Screen name="MyPage" component={MyPageScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PointHistory" component={PointHistoryScreen} options={{ title: '포인트 내역' }} />
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MatchReview" component={MatchReviewScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateMatch" component={CreateMatchScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PaymentWebView" component={PaymentWebViewScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="CustomerSupport" component={CustomerSupportScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Friends" component={FriendsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="FriendChat" component={FriendChatScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="FriendMatches" component={FriendMatchesScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AdminUsers" component={AdminUserManagementScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AdminPointGrant" component={AdminPointGrantScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AdminMatches" component={AdminMatchManagementScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen 
        name="MatchConfirmation" 
        component={MatchConfirmationScreen} 
        options={{ animation: 'fade' }} 
      />
      <Stack.Screen 
        name="MatchDetail" 
        component={MatchDetailScreen} 
        options={{ 
          animation: 'slide_from_bottom',
          headerShown: true,
          title: '매치 상세 정보',
          headerTintColor: '#1A2A3A',
          headerBackTitleVisible: false
        }} 
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ animation: 'slide_from_bottom' }} 
      />
      <Stack.Screen 
        name="SignUp" 
        component={SignUpScreen} 
        options={{ 
          headerShown: true, 
          title: '', 
          headerShadowVisible: false 
        }} 
      />
    </Stack.Navigator>
  );
}
