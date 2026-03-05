import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { AppBar } from '../../src/components/AppBar';
import { ListItem } from '../../src/components/ListItem';
import { getEvents, clearEvents } from '../../src/storage/events';
import { ImportedEvent } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = [
  { label: 'Import', value: 'import' },
  { label: 'Past Imports', value: 'history' },
];

export default function HistoryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<ImportedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Reload whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getEvents().then((data) => {
        if (active) {
          setEvents(data);
          setLoading(false);
        }
      });
      return () => { active = false; };
    }, [])
  );

  const handleClearHistory = useCallback(() => {
    if (Platform.OS === 'web') {
      if (window.confirm('Clear all import history? This cannot be undone.')) {
        clearEvents().then(() => setEvents([]));
      }
    } else {
      Alert.alert(
        'Clear History',
        'Delete all import history? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: () => clearEvents().then(() => setEvents([])),
          },
        ]
      );
    }
  }, []);

  const handleTabChange = useCallback((value: string) => {
    if (value === 'import') {
      router.navigate('/');
    }
  }, []);

  const handleItemPress = useCallback((id: string) => {
    router.push(`/history/${id}`);
  }, []);

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceVariant }]}>
        <Ionicons name="calendar-outline" size={40} color={colors.textDisabled} />
      </View>
      <Text style={[typography.h3, { color: colors.text, marginTop: spacing.md }]}>
        No imports yet
      </Text>
      <Text
        style={[typography.body2, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}
      >
        Import an event flyer to see it here.
      </Text>
      <TouchableOpacity
        style={[styles.importCta, { backgroundColor: colors.primary }]}
        onPress={() => router.navigate('/')}
        activeOpacity={0.8}
      >
        <Text style={[typography.button, { color: '#FFFFFF' }]}>Import Event</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppBar
        title="Event Importer"
        tabs={TABS}
        selectedTab="history"
        onTabChange={handleTabChange}
        rightIcon="settings-outline"
        onRightPress={() => router.push('/settings')}
      />

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListItem
            event={item}
            onPress={() => handleItemPress(item.id)}
            style={{ backgroundColor: colors.surface }}
          />
        )}
        ListEmptyComponent={loading ? null : renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          events.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          events.length > 0 ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
              <TouchableOpacity
                style={[styles.clearButton, { borderColor: colors.error }]}
                onPress={handleClearHistory}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text style={[typography.body2, { color: colors.error, marginLeft: spacing.xs }]}>
                  Clear History
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: {
    flexGrow: 1,
  },
  listContentEmpty: {
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importCta: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
  },
  footer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
});
