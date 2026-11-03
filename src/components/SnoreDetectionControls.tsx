import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { ConfirmModal } from './ConfirmModal';
import { useDevice } from '../context/DeviceContext';
import { colors } from '../constants/theme';

type Props = {
  /** Compact layout for the home tab. */
  compact?: boolean;
  /** Hide the outer title when a parent section already labels it. */
  hideTitle?: boolean;
};

/**
 * Start / stop overnight snore listening.
 * Start asks for confirm, then shows a 3 → 2 → 1 countdown before enabling the mic.
 */
export const SnoreDetectionControls: React.FC<Props> = ({ compact, hideTitle }) => {
  const { connected, snoreDetectionEnabled, startSnoreDetection, stopSnoreDetection } = useDevice();
  const [startConfirmVisible, setStartConfirmVisible] = useState(false);
  const [stopConfirmVisible, setStopConfirmVisible] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 3500);
  };

  const beginCountdownAndStart = () => {
    setStartConfirmVisible(false);
    setCountdown(3);
    if (timerRef.current) clearInterval(timerRef.current);
    let remaining = 3;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setCountdown(null);
        void (async () => {
          setBusy(true);
          try {
            await startSnoreDetection();
            showMessage('Snore detection started');
          } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Could not start detection');
          } finally {
            setBusy(false);
          }
        })();
        return;
      }
      setCountdown(remaining);
    }, 1000);
  };

  const runStop = async () => {
    setStopConfirmVisible(false);
    setBusy(true);
    try {
      await stopSnoreDetection();
      showMessage('Snore detection stopped');
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Could not stop detection');
    } finally {
      setBusy(false);
    }
  };

  const disabled = !connected || busy || countdown != null;

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      {!hideTitle ? <Text style={styles.label}>Snore detection</Text> : null}
      <View style={styles.panel}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: !connected
                  ? '#94a3b8'
                  : snoreDetectionEnabled
                    ? '#10b981'
                    : '#ea580c',
              },
            ]}
          />
          <Text style={styles.status}>
            {!connected
              ? 'Pillow offline'
              : snoreDetectionEnabled
                ? 'Listening for snoring'
                : 'Paused — not listening'}
          </Text>
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.startButton,
              (disabled || snoreDetectionEnabled) && styles.buttonDisabled,
            ]}
            disabled={disabled || snoreDetectionEnabled}
            onPress={() => setStartConfirmVisible(true)}
            activeOpacity={0.85}
          >
            {busy && !snoreDetectionEnabled ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <FontAwesome5 name="play" size={12} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Start</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.stopButton,
              (disabled || !snoreDetectionEnabled) && styles.buttonDisabled,
            ]}
            disabled={disabled || !snoreDetectionEnabled}
            onPress={() => setStopConfirmVisible(true)}
            activeOpacity={0.85}
          >
            {busy && snoreDetectionEnabled ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <FontAwesome5 name="stop" size={12} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Stop</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {!connected ? (
          <Text style={styles.hint}>Pair or reconnect the pillow to control detection.</Text>
        ) : (
          <Text style={styles.hint}>
            Stays off after connect. Start runs a 3s countdown, then the mic listens.
          </Text>
        )}
      </View>

      <ConfirmModal
        visible={startConfirmVisible}
        title="Start snore detection?"
        message="A 3-second countdown will run, then Hagosaur will start listening for snoring on the pillow mic."
        confirmLabel="Start countdown"
        artwork="computer"
        onConfirm={beginCountdownAndStart}
        onCancel={() => setStartConfirmVisible(false)}
      />
      <ConfirmModal
        visible={stopConfirmVisible}
        title="Stop snore detection?"
        message="The pillow mic will stop listening for snoring until you start it again. Pump height is unchanged."
        confirmLabel="Stop listening"
        destructive
        artwork="unplug"
        onConfirm={runStop}
        onCancel={() => setStopConfirmVisible(false)}
      />

      <Modal transparent visible={countdown != null} animationType="fade">
        <View style={styles.countdownOverlay}>
          <View style={styles.countdownCard}>
            <Text style={styles.countdownEyebrow}>STARTING IN</Text>
            <Text style={styles.countdownNumber}>{countdown}</Text>
            <Text style={styles.countdownHint}>Listening starts when the countdown ends.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 0 },
  wrapCompact: { marginTop: 0 },
  label: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  panel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  status: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: { backgroundColor: '#059669' },
  stopButton: { backgroundColor: '#dc2626' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  hint: { marginTop: 10, color: colors.textMuted, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  message: { marginTop: 10, color: '#0369a1', fontSize: 11, fontWeight: '700' },
  countdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  countdownCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  countdownEyebrow: {
    color: colors.accentDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  countdownNumber: {
    color: colors.text,
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 80,
  },
  countdownHint: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },
});
