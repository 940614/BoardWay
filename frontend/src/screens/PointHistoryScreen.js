import React, { useContext, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { commonStyles } from '../theme/styles';
import { AuthContext } from '../context/AuthContext';

export default function PointHistoryScreen({ navigation }) {
  const { pointHistory, loadUserPointHistory } = useContext(AuthContext);

  useEffect(() => {
    loadUserPointHistory?.();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const renderHistoryItem = ({ item }) => {
    const isPlus = item.type === '충전' || item.description?.includes('리워드');

    return (
      <View style={styles.historyItem}>
        <View style={styles.itemLeft}>
          <Text style={styles.itemType}>{item.type}</Text>
          <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
        </View>
        <View style={styles.itemRight}>
          <Text style={[styles.itemAmount, isPlus ? styles.plusAmount : styles.minusAmount]}>
            {isPlus ? '+' : '-'}{item.amount.toLocaleString()} P
          </Text>
          <Text style={styles.itemDescription}>{item.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>포인트 사용 내역</Text>
        <View style={{ width: 40 }} />
      </View>

      {pointHistory.length > 0 ? (
        <FlatList
          data={pointHistory}
          renderItem={renderHistoryItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color={colors.border} />
          <Text style={styles.emptyText}>사용 내역이 없습니다.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  listContent: {
    padding: 16,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    ...commonStyles.shadow,
  },
  itemLeft: {
    flex: 1,
  },
  itemType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
    color: colors.textLight,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  plusAmount: {
    color: colors.primary,
  },
  minusAmount: {
    color: colors.error,
  },
  itemDescription: {
    fontSize: 12,
    color: colors.textLight,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textLight,
    fontWeight: '600',
  }
});
