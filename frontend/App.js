import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MatchProvider } from './src/context/MatchContext';
import { AuthProvider } from './src/context/AuthContext';
import './src/theme/web.css';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MatchProvider>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="light" backgroundColor="#1A2A3A" />
          </NavigationContainer>
        </MatchProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
