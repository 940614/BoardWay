import React, { useState, useContext, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { AuthContext } from '../context/AuthContext';
import { notify } from '../utils/dialog';

export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');

  const { signup } = useContext(AuthContext);
  const nicknameRef = useRef(null);
  const passwordRef = useRef(null);
  const passwordConfirmRef = useRef(null);

  const handleSignUp = async () => {
    if (/\s/.test(nickname)) {
      notify('알림', '닉네임에는 띄어쓰기를 사용할 수 없습니다.');
      return;
    }
    if (password !== passwordConfirm) {
      notify('알림', '비밀번호가 일치하지 않습니다.');
      return;
    }
    const success = await signup(email, password, nickname);
    if (success) {
      navigation.goBack(); // 로그인 화면으로 돌아가기
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>보드웨이 회원가입</Text>
        <Text style={styles.subtitle}>가장 바른 보드게임 문화를 함께 만들어가요!</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={styles.input}
            placeholder="example@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => nicknameRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>닉네임</Text>
          <TextInput
            ref={nicknameRef}
            style={styles.input}
            placeholder="사용하실 닉네임"
            value={nickname}
            onChangeText={(text) => {
              if (/\s/.test(text)) {
                notify('알림', '닉네임에는 띄어쓰기를 사용할 수 없습니다.');
              }
              setNickname(text.replace(/\s/g, ''));
            }}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder="비밀번호 입력"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => passwordConfirmRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>비밀번호 확인</Text>
          <TextInput
            ref={passwordConfirmRef}
            style={styles.input}
            placeholder="비밀번호 재입력"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignUp}
          />
        </View>

        <TouchableOpacity style={[commonStyles.button, styles.signupBtn]} onPress={handleSignUp}>
          <Text style={commonStyles.buttonText}>가입하기</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContainer: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: colors.background,
  },
  signupBtn: {
    marginTop: 20,
  }
});
