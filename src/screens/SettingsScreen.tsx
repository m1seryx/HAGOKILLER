import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { GlassCard } from '../components/GlassCard';
import { ConfirmModal } from '../components/ConfirmModal';
import { MockBLEService } from '../services/mockBLEService';

export const SettingsScreen = () => {
  const bleService = useRef(new MockBLEService()).current;
  const [loading, setLoading] = useState(true);
  const [snoreThreshold, setSnoreThreshold] = useState(3);
  const [pumpDuration, setPumpDuration] = useState(12);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [connected, setConnected] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({
    mode: 'Connecting…',
    signal: '—',
    battery: 0,
    pairingStatus: 'Pending',
    lastSeen: '—',
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await bleService.connect();
        const settings = bleService.getDeviceSettings();
        setSnoreThreshold(settings.snoreThreshold);
        setPumpDuration(settings.pumpDuration);
        setConnected(bleService.getIsConnected());
        setDeviceStatus({
          mode: 'Monitoring',
          signal: 'Strong',
          battery: 82,
          pairingStatus: 'Aligned',
          lastSeen: 'just now',
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [bleService]);

  const handleConfirmSave = async () => {
    setConfirmVisible(false);
    try {
      const saved = await bleService.saveDeviceSettings({
        snoreThreshold,
        pumpDuration,
      });
      setSnoreThreshold(saved.snoreThreshold);
      setPumpDuration(saved.pumpDuration);
      setSaveError(false);
      setSaveMessage('Device settings saved to pillow');
      setTimeout(() => setSaveMessage(''), 2800);
    } catch (error) {
      setSaveError(true);
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save settings');
      setTimeout(() => setSaveMessage(''), 3200);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color="#6366f1" size="large" />
          <Text style={styles.loadingText}>Loading device settings…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = connected ? '#10b981' : '#f59e0b';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Control pillow behavior and review device status</Text>

        <GlassCard style={styles.card}>
          <View style={styles.deviceHeader}>
            <View style={styles.deviceTitleRow}>
              <FontAwesome5 name="microchip" size={16} color="#818cf8" />
              <Text style={styles.cardTitle}>ESP32 Device Status</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
              <Text style={[styles.badgeText, { color: statusColor }]}>
                {connected ? 'Connected' : 'Offline'}
              </Text>
            </View>
          </View>

          {[
            ['Device', 'HAGOKILLER Pillow'],
            ['Mode', deviceStatus.mode],
            ['Signal', deviceStatus.signal],
            ['Battery', `${deviceStatus.battery}%`],
            ['Pairing', deviceStatus.pairingStatus],
            ['Last Seen', deviceStatus.lastSeen],
          ].map(([label, value]) => (
            <View key={label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value}</Text>
            </View>
          ))}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Device Parameter Settings</Text>
          <Text style={styles.cardHint}>
            Adjust snore detection and pump behavior for the connected pillow.
          </Text>

          <View style={styles.settingRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.settingLabel}>Consecutive snore threshold</Text>
              <Text style={styles.settingHint}>Events before intervention</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setSnoreThreshold((v) => Math.max(1, v - 1))}
              >
                <Text style={styles.stepText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{snoreThreshold}</Text>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setSnoreThreshold((v) => Math.min(10, v + 1))}
              >
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.settingLabel}>Pump activation duration</Text>
              <Text style={styles.settingHint}>Seconds of air pump delivery</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setPumpDuration((v) => Math.max(5, v - 1))}
              >
                <Text style={styles.stepText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{pumpDuration}s</Text>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setPumpDuration((v) => Math.min(30, v + 1))}
              >
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {saveMessage ? (
            <Text style={[styles.saveMessage, saveError && styles.saveError]}>{saveMessage}</Text>
          ) : null}

          <TouchableOpacity style={styles.saveButton} onPress={() => setConfirmVisible(true)}>
            <Text style={styles.saveButtonText}>Save Device Settings</Text>
          </TouchableOpacity>
        </GlassCard>
      </ScrollView>

      <ConfirmModal
        visible={confirmVisible}
        title="Save device settings?"
        message={`Apply threshold ${snoreThreshold} and pump duration ${pumpDuration}s to your smart pillow?`}
        confirmLabel="Save"
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0b10' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#9ca3af', marginTop: 12, fontWeight: '600' },
  title: { color: '#ffffff', fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: '#94a3b8', fontSize: 14, marginBottom: 20, lineHeight: 20 },
  card: { padding: 18, marginBottom: 16 },
  cardTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  cardHint: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginBottom: 16 },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  deviceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  infoLabel: { color: '#9ca3af', fontSize: 13 },
  infoValue: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingLabel: { color: '#f3f4f6', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  settingHint: { color: '#9ca3af', fontSize: 11 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  stepValue: { color: '#ffffff', fontSize: 16, fontWeight: '700', minWidth: 40, textAlign: 'center' },
  saveButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.35)',
  },
  saveButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  saveMessage: { color: '#10b981', fontSize: 12, marginBottom: 10, fontWeight: '600' },
  saveError: { color: '#fca5a5' },
});
