import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { spacing, borderRadius } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { AppBar } from '../src/components/AppBar';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { pickImage } from '../src/utils/platformFilePicker';

const TABS = [
  { label: 'Import', value: 'import' },
  { label: 'Past Imports', value: 'history' },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const [selectedImage, setSelectedImage] = useState<{ uri: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Fade-in animation for preview card
  const previewOpacity = useRef(new Animated.Value(0)).current;

  const handlePickImage = useCallback(async () => {
    setLoading(true);
    try {
      const file = await pickImage();
      if (file) {
        setSelectedImage(file);
        Animated.timing(previewOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
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
        {/* Hero area */}
        <View style={styles.heroArea}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
            <Text style={styles.heroIcon}>📅</Text>
          </View>
          <Text style={[typography.h2, { color: colors.text, textAlign: 'center', marginTop: spacing.md }]}>
            Import an Event
          </Text>
          <Text
            style={[
              typography.body1,
              { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
            ]}
          >
            Upload a flyer or screenshot to extract date, time, and place.
          </Text>
        </View>

        {/* Import button */}
        <Button
          title={loading ? 'Opening…' : 'Import Event'}
          onPress={handlePickImage}
          loading={loading}
          fullWidth
          style={styles.importButton}
        />

        {/* Preview card (appears after image selection) */}
        {selectedImage && (
          <Animated.View style={{ opacity: previewOpacity, width: '100%' }}>
            <Card style={styles.previewCard}>
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <View style={styles.previewMeta}>
                <Text
                  style={[typography.body1, { color: colors.text, fontWeight: '500' }]}
                  numberOfLines={1}
                >
                  {selectedImage.name}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  Ready to review
                </Text>
              </View>
            </Card>

            <Button
              title="Continue"
              onPress={handleContinue}
              fullWidth
              style={styles.continueButton}
            />
          </Animated.View>
        )}
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
    maxWidth: 400,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    fontSize: 36,
  },
  importButton: {
    maxWidth: 400,
    width: '100%',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    maxWidth: 400,
    width: '100%',
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  previewMeta: {
    flex: 1,
  },
  continueButton: {
    marginTop: spacing.md,
    maxWidth: 400,
    width: '100%',
  },
});
