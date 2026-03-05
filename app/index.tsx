import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  ScrollView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { spacing, borderRadius } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { AppBar } from '../src/components/AppBar';
import { Button } from '../src/components/Button';
import { pickImage } from '../src/utils/platformFilePicker';

const TABS = [
  { label: 'Import', value: 'import' },
  { label: 'Past Imports', value: 'history' },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const [selectedImage, setSelectedImage] = useState<{ uri: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const previewOpacity = useRef(new Animated.Value(0)).current;
  const previewTranslate = useRef(new Animated.Value(16)).current;

  const handlePickImage = useCallback(async () => {
    setLoading(true);
    try {
      const file = await pickImage();
      if (file) {
        setSelectedImage(file);
        Animated.parallel([
          Animated.timing(previewOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(previewTranslate, {
            toValue: 0,
            useNativeDriver: true,
            speed: 18,
            bounciness: 6,
          }),
        ]).start();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleContinue = useCallback(() => {
    if (!selectedImage) return;
    router.push({
      pathname: '/review',
      params: {
        imageUri: selectedImage.uri,
        imageName: selectedImage.name,
      },
    });
  }, [selectedImage]);

  const handleTabChange = useCallback((value: string) => {
    if (value === 'history') {
      router.navigate('/history');
    }
  }, []);

  const handleReplaceImage = useCallback(() => {
    previewOpacity.setValue(0);
    previewTranslate.setValue(16);
    setSelectedImage(null);
    handlePickImage();
  }, [handlePickImage]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppBar
        title="Event Importer"
        tabs={TABS}
        selectedTab="import"
        onTabChange={handleTabChange}
        rightIcon="settings-outline"
        onRightPress={() => router.push('/settings')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.heroArea}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="calendar" size={36} color={colors.primary} />
          </View>
          <Text style={[typography.h2, { color: colors.text, textAlign: 'center', marginTop: spacing.lg }]}>
            Import an Event
          </Text>
          <Text
            style={[
              typography.body1,
              { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, maxWidth: 300 },
            ]}
          >
            Upload a flyer or screenshot — AI extracts the details automatically.
          </Text>
        </View>

        {/* Upload zone */}
        {!selectedImage ? (
          <TouchableOpacity
            style={[
              styles.uploadZone,
              {
                backgroundColor: colors.surface,
                borderColor: loading ? colors.primary : colors.border,
              },
            ]}
            onPress={handlePickImage}
            activeOpacity={0.75}
            disabled={loading}
          >
            <View style={[styles.uploadIconWrap, { backgroundColor: colors.primaryLight }]}>
              <Ionicons
                name={loading ? 'hourglass-outline' : 'cloud-upload-outline'}
                size={30}
                color={colors.primary}
              />
            </View>
            <Text style={[typography.h3, { color: colors.text, marginTop: spacing.md }]}>
              {loading ? 'Opening…' : 'Upload Flyer'}
            </Text>
            <Text style={[typography.body2, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              {Platform.OS === 'web' ? 'Tap to select or drag & drop' : 'Tap to select from your library'}
            </Text>
            <View style={[styles.uploadPill, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="image-outline" size={12} color={colors.primary} />
              <Text style={[typography.caption, { color: colors.primary, marginLeft: 4, fontWeight: '600' }]}>
                JPG · PNG · WEBP
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Preview (appears after selection) */}
        {selectedImage && (
          <Animated.View
            style={[
              styles.previewWrapper,
              {
                opacity: previewOpacity,
                transform: [{ translateY: previewTranslate }],
              },
            ]}
          >
            <View style={[styles.previewImageWrap, { backgroundColor: colors.surfaceVariant }]}>
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={[styles.replaceBtn, { backgroundColor: colors.overlay }]}
                onPress={handleReplaceImage}
                activeOpacity={0.8}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color="#FFFFFF" />
                <Text style={[typography.caption, { color: '#FFFFFF', marginLeft: 4, fontWeight: '600' }]}>
                  Replace
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.previewMeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="image-outline" size={16} color={colors.textSecondary} />
              <Text
                style={[typography.body2, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}
                numberOfLines={1}
              >
                {selectedImage.name}
              </Text>
              <View style={[styles.readyDot, { backgroundColor: colors.success }]} />
              <Text style={[typography.caption, { color: colors.success, marginLeft: 4, fontWeight: '600' }]}>
                Ready
              </Text>
            </View>

            <Button
              title="Continue to Review"
              onPress={handleContinue}
              fullWidth
              style={styles.continueButton}
            />
          </Animated.View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  heroArea: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 440,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadZone: {
    width: '100%',
    maxWidth: 440,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
    }),
  },
  uploadIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  previewWrapper: {
    width: '100%',
    maxWidth: 440,
  },
  previewImageWrap: {
    width: '100%',
    height: 240,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 20px rgba(0,0,0,0.12)' },
    }),
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  replaceBtn: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  continueButton: {
    marginTop: spacing.md,
  },
});
