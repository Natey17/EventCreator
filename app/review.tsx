import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/auth/AuthContext';
import { spacing, borderRadius } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { AppBar } from '../src/components/AppBar';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Toast } from '../src/components/Toast';
import { addEvent } from '../src/storage/events';
import { createEventDraft } from '../src/utils/mockEvent';
import { ImportedEvent } from '../src/types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}

function Field({ label, value, onChangeText, placeholder, multiline = false, colors }: FieldProps) {
  return (
    <View style={fieldStyles.container}>
      <Text style={[typography.label, fieldStyles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <TextInput
        style={[
          fieldStyles.input,
          {
            color: colors.text,
            borderBottomColor: colors.border,
            ...(multiline && { minHeight: 72, textAlignVertical: 'top' }),
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDisabled}
        multiline={multiline}
        returnKeyType={multiline ? 'default' : 'next'}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
  },
  input: {
    fontSize: 16,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
});

export default function ReviewScreen() {
  const { colors } = useTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const { imageUri, imageName } = useLocalSearchParams<{
    imageUri: string;
    imageName: string;
  }>();

  // Build initial draft from picked image
  const draft = createEventDraft(imageUri ?? '', imageName);

  const [title, setTitle] = useState(draft.title);
  const [date, setDate] = useState(draft.date);
  const [startTime, setStartTime] = useState(draft.startTime);
  const [endTime, setEndTime] = useState(draft.endTime);
  const [location, setLocation] = useState(draft.location);
  const [notes, setNotes] = useState(draft.notes);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleImport = useCallback(async () => {
    // Gate: require Google sign-in before importing
    if (!auth.isSignedIn) {
      router.push('/sign-in');
      return;
    }

    // Token is present — log confirmation (real Calendar insertion comes later)
    console.log('[Review] Import triggered', { accessTokenPresent: Boolean(auth.accessToken) });

    setSaving(true);
    const event: ImportedEvent = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      title: title || 'Untitled Event',
      date,
      startTime,
      endTime,
      location,
      notes,
      imageUri: imageUri ?? '',
      imageName,
    };
    try {
      await addEvent(event);
      setShowSuccess(true);
    } finally {
      setSaving(false);
    }
  }, [auth, title, date, startTime, endTime, location, notes, imageUri, imageName]);

  const handleSuccessDismiss = useCallback(() => {
    setShowSuccess(false);
    router.replace('/history');
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppBar
        title="Review"
        showBack
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image preview */}
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceVariant }]} />
          )}

          {/* Event details card */}
          <Card style={styles.detailsCard} padding="lg">
            <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
              Event Details
            </Text>

            <Field
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Event title"
              colors={colors}
            />
            <Field
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              colors={colors}
            />
            <Field
              label="Start Time"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="HH:MM"
              colors={colors}
            />
            <Field
              label="End Time"
              value={endTime}
              onChangeText={setEndTime}
              placeholder="HH:MM"
              colors={colors}
            />
            <Field
              label="Location"
              value={location}
              onChangeText={setLocation}
              placeholder="Where is it?"
              colors={colors}
            />
            <Field
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional details…"
              multiline
              colors={colors}
            />
          </Card>

          {/* Bottom spacer so content doesn't hide behind sticky button */}
          <View style={{ height: spacing.xxl + 64 }} />
        </ScrollView>

        {/* Sticky bottom button */}
        <View
          style={[
            styles.stickyBottom,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          {/* Auth hint */}
          {!auth.isSignedIn && (
            <Text
              style={[
                typography.caption,
                {
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginBottom: spacing.sm,
                },
              ]}
            >
              You'll be asked to sign in with Google first.
            </Text>
          )}
          <Button
            title="Import to Google Calendar"
            onPress={handleImport}
            loading={saving}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>

      <Toast
        visible={showSuccess}
        title="Imported (mock)"
        message="Event saved to your import history."
        onDismiss={handleSuccessDismiss}
        actionLabel="View History"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    maxWidth: 480,
    height: 220,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  imagePlaceholder: {
    width: '100%',
    maxWidth: 480,
    height: 220,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  detailsCard: {
    width: '100%',
    maxWidth: 480,
  },
  stickyBottom: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
