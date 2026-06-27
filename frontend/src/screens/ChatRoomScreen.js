import React, { useState, useContext, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { notify } from '../utils/dialog';
import { WS_URL } from '../config';

export default function ChatRoomScreen({ route, navigation }) {
  const { match } = route.params;
  const { user, token } = useContext(AuthContext);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef();
  const wsRef = useRef(null);

  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return ''; }
  };

  const scrollToBottom = (animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 60);
  };

  // 기존 메시지 초기 로드 (REST)
  useEffect(() => {
    if (!token) return;
    apiFetch(`/matches/${match.id}/messages`, { token })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setMessages(data);
          scrollToBottom(false);
        }
      })
      .catch(() => {});
  }, [match.id, token]);

  // WebSocket 연결 — 새 메시지 실시간 수신
  useEffect(() => {
    if (!token) return;
    const wsUrl = `${WS_URL}/ws/matches/${match.id}/chat`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // 연결되면 즉시 토큰 전송 (URL 노출 방지)
    ws.onopen = () => {
      ws.send(JSON.stringify({ token }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.error) return;
        setMessages(prev => {
          // 내가 보낸 메시지가 낙관적으로 이미 추가됐으면 중복 방지
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      } catch {}
    };

    ws.onerror = () => {};

    // 연결 끊기면 3초 후 자동 재연결
    ws.onclose = () => {
      setTimeout(() => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      }, 3000);
    };

    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, [match.id, token]);

  const handleSend = async () => {
    const content = message.trim();
    if (content === '' || sending) return;
    setSending(true);
    setMessage('');

    // WebSocket으로 전송
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ content }));
      setSending(false);
      return;
    }

    // WS 연결 없으면 REST 폴백
    try {
      const res = await apiFetch(`/matches/${match.id}/messages`, {
        method: 'POST',
        token,
        json: { content },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify('전송 실패', data.detail || '메시지 전송에 실패했습니다.');
        setMessage(content);
        return;
      }
      const created = await res.json();
      setMessages(prev => [...prev, created]);
      scrollToBottom();
    } catch (e) {
      notify('오류', '서버와 연결할 수 없습니다.');
      setMessage(content);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = user && item.sender_nickname === user.nickname;
    return (
      <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.otherMessageWrapper]}>
        {!isMe && <View style={styles.avatarSmall}><Text style={styles.avatarText}>{item.sender_nickname[0]}</Text></View>}
        <View style={styles.messageContent}>
          {!isMe && <Text style={styles.senderName}>{item.sender_nickname}</Text>}
          <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
            <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
              {item.content}
            </Text>
          </View>
          <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{match.games.join(', ')}</Text>
          <Text style={styles.headerSubTitle}>{match.location.venue} {match.location.branch}</Text>
        </View>
        <TouchableOpacity style={styles.menuBtn}>
          <Ionicons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.systemMessageContainer}>
            <Text style={styles.systemMessageText}>아직 메시지가 없습니다. 첫 인사를 남겨보세요! 👋</Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.plusBtn}>
            <Ionicons name="add" size={24} color={colors.textLight} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="메시지를 입력하세요..."
            value={message}
            onChangeText={setMessage}
            multiline={false}
            blurOnSubmit={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (message.trim() === '' || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={message.trim() === '' || sending}
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
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSubTitle: {
    fontSize: 11,
    color: colors.textLight,
  },
  menuBtn: {
    padding: 8,
  },
  messageList: {
    padding: 16,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  systemMessageText: {
    fontSize: 12,
    color: colors.textLight,
    backgroundColor: colors.border + '50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '80%',
  },
  myMessageWrapper: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  otherMessageWrapper: {
    alignSelf: 'flex-start',
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  messageContent: {
    flex: 1,
  },
  senderName: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 4,
    marginLeft: 4,
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderTopRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: colors.text,
  },
  messageTime: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  plusBtn: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 15,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: colors.border,
  }
});
