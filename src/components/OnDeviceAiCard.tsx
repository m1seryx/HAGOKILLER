import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { ON_DEVICE_MODEL_SIZE_MB } from '../services/onDeviceAssessment';

export type OnDeviceModelStatus =
  | 'checking'
  | 'missing'
  | 'downloading'
  | 'ready'
  | 'error'
  | 'unsupported';

interface OnDeviceAiCardProps {
  status: OnDeviceModelStatus;
  progress: number;
  error?: string;
  onDownload: () => void;
}

export const OnDeviceAiCard: React.FC<OnDeviceAiCardProps> = ({
  status,
  progress,
  error,
  onDownload,
}) => (
  <View style={styles.container}>
    <View style={styles.headingRow}>
      <View style={styles.icon}>
        <FontAwesome5 name="microchip" size={15} color={colors.accentDark} />
      </View>
      <View style={styles.headingText}>
        <Text style={styles.title}>Private on-device AI</Text>
        <Text style={styles.subtitle}>Runs offline after a one-time model download.</Text>
      </View>
    </View>

    {status === 'checking' ? (
      <View style={styles.statusRow}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.statusText}>Checking AI model...</Text>
      </View>
    ) : null}

    {status === 'ready' ? (
      <View style={styles.statusRow}>
        <FontAwesome5 name="check-circle" size={14} color="#10b981" />
        <Text style={styles.readyText}>Model ready · no computer or internet required</Text>
      </View>
    ) : null}

    {status === 'unsupported' ? (
      <Text style={styles.notice}>
        Expo Go cannot run llama.cpp. Install an EAS development or preview build to enable on-device AI.
      </Text>
    ) : null}

    {status === 'downloading' ? (
      <View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.statusText}>Downloading model... {Math.round(progress * 100)}%</Text>
      </View>
    ) : null}

    {status === 'missing' || status === 'error' ? (
      <>
        <Text style={styles.notice}>
          Download approximately {ON_DEVICE_MODEL_SIZE_MB} MB over Wi-Fi. The model stays in this app's private storage.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.button}
          onPress={onDownload}
          activeOpacity={0.8}
        >
          <FontAwesome5 name="download" size={13} color={colors.onAccent} />
          <Text style={styles.buttonText}>{status === 'error' ? 'Try download again' : 'Download AI model'}</Text>
        </TouchableOpacity>
      </>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headingText: { flex: 1 },
  title: { color: colors.text, fontSize: 14, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  readyText: { color: '#047857', fontSize: 12, fontWeight: '600', flex: 1 },
  notice: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  error: { color: '#b91c1c', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
  },
  buttonText: { color: colors.onAccent, fontSize: 13, fontWeight: '700' },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
});
