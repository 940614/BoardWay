import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { notify } from '../utils/dialog';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';

export default function FriendChatScreen({ route, navigation }) {
  const { friend } = route.params;
  const { user, token } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  const formatTime = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const loadMessages = async () => {
    if (!token) return;
    try {
      const response = await apiFetch(`/friends/${friend.user_id}/messages`, { token });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || '메시지를 불러오지 못했습니다.');
      setMessages(data.messages || []);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 80);
    } catch (error) {
      notify('오류', error.message || '메시지를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const timer = setInterval(loadMessages, 5000);
    return () => clearInterval(timer);
  }, [friend.user_id, token]);

  const sendMessage = async () => {
    const content = message.trim();
    if (!content || sending) return;
    setSending(true);
    setMessage('');
    try {
      const response = await apiFetch(`/friends/${friend.user_id}/messages`, {
        method: 'POST',
        token,
        json: { content },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || '메시지를 보내지 못했습니다.');
      setMessages((prev) => [...prev, data]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (error) {
      setMessage(content);
      notify('오류', error.message || '메시지를 보내지 못했습니다.');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === user?.id || item.sender_nickname === user?.nickname;
    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.friendRow]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.friendBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myText : styles.friendText]}>{item.content}</Text>
        </View>
        <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{friend.nickname}</Text>
          <Text style={styles.headerSub}>친구 1:1 채팅</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>아직 메시지가 없습니다. 첫 인사를 보내보세요.</Text>
            </View>
          }
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="메시지를 입력하세요"
            placeholderTextColor={colors.textLight}
            multiline={false}
            blurOnSubmit={false}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!message.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!message.trim() || sending}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  backButton: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  headerSub: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { padding: 16 },
  messageRow: { marginBottom: 12, maxWidth: '78%' },
  myRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  friendRow: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16 },
  myBubble: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
  friendBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 20 },
  myText: { color: '#FFFFFF' },
  friendText: { color: colors.text },
  messageTime: { color: colors.textLight, fontSize: 10, marginTop: 4 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: colors.textLight },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    color: colors.text,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: { backgroundColor: colors.border },
});
