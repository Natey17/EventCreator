import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, borderRadius } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { AppBar } from '../../src/components/AppBar';
import { ListItem } from '../../src/components/ListItem';
import { getEvents, clearEvents } from '../../src/storage/events';
import { ImportedEvent } from '../../src/types';

const TABS = [
  { label: 'Import', value: 'import' },
  { label: 'Past Imports', value: 'history' },
];

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        skeletonStyles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pulse },
      ]}
    >
      <View style={[skeletonStyles.dateBlock, { backgroundColor: colors.surfaceVariant }]} />
      <View style={skeletonStyles.lines}>
        <View style={[skeletonStyles.line, skeletonStyles.lineTitle, { backgroundColor: colors.surfaceVariant }]} />
        <View style={[skeletonStyles.line, skeletonStyles.lineShort, { backgroundColor: colors.surfaceVariant }]} />
      </View>
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    height: 72,
  },
  dateBlock: { width: 56 },
  lines: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  line: { borderRadius: borderRadius.sm, height: 12, marginBottom: spacing.sm },
  lineTitle: { width: '65%' },
  lineShort: { width: '40%' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<ImportedEvent[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (value === 'import') router.navigate('/');
  }, []);

  const handleItemPress = useCallback((id: string) => {
    router.push(`/history/${id}`);
  }, []);

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name="calendar-outline" size={40} color={colors.primary} />
      </View>
      <Text style={[typography.h3, { color: colors.text, marginTop: spacing.lg }]}>
        No imports yet
      </Text>
      <Text
        style={[
          typography.body2,
          { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, maxWidth: 260 },
        ]}
      >
        Import an event flyer and it will appear here once added to Google Calendar.
      </Text>
      <TouchableOpacity
        style={[styles.importCta, { backgroundColor: colors.primary }]}
        onPress={() => router.navigate('/')}
        activeOpacity={0.8}
      >
        <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
        <Text style={[typography.button, { color: '#FFFFFF', marginLeft: spacing.xs }]}>Import Event</Text>
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

      {loading ? (
        <View style={{ paddingTop: spacing.xs }}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} colors={colors} />
          ))}
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListItem
              event={item}
              onPress={() => handleItemPress(item.id)}
            />
          )}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            events.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            events.length > 0 ? (
              <Text style={[typography.caption, styles.listHeader, { color: colors.textSecondary }]}>
                {events.length} {events.length === 1 ? 'event' : 'events'}
              </Text>
            ) : null
          }
          ListFooterComponent={
            events.length > 0 ? (
              <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
                <TouchableOpacity
                  style={[styles.clearButton, { borderColor: colors.error }]}
                  onPress={handleClearHistory}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.error} />
                  <Text style={[typography.body2, { color: colors.error, marginLeft: spacing.xs }]}>
                    Clear History
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: {
    flexGrow: 1,
    paddingTop: spacing.xs,
  },
  listContentEmpty: {
    justifyContent: 'center',
  },
  listHeader: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
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
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
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
