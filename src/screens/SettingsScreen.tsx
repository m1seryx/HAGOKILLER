import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { GlassCard } from '../components/GlassCard';
import { ConfirmModal } from '../components/ConfirmModal';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { useDevice } from '../context/DeviceContext';
import { useUser } from '../context/UserContext';
import { bleService, isMockBle } from '../services/bleService';
import {
  hydrateNotificationPref,
  setNotificationsEnabled,
  sendTestNotification,
} from '../services/snoreNotifications';
import { BLEDevice } from '../types';
import { isValidPairingPin } from '../utils/pinValidation';
import { colors } from '../constants/theme';
import {
  PUMP_DURATION_MAX_SEC,
  PUMP_DURATION_MIN_SEC,
  PUMP_DURATION_STEP_SEC,
} from '../services/deviceSettings';

const PIN_LENGTH = 7;

type StepperProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
};

const Stepper = ({ value, min, max, step = 1, format, onChange }: StepperProps) => (
  <View style={styles.stepper}>
    <Pressable
      style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}
      onPress={() => onChange(Math.max(min, value - step))}
      accessibilityRole="button"
      accessibilityLabel="Decrease"
    >
      <Text style={styles.stepText}>-</Text>
    </Pressable>
    <Text style={styles.stepValue}>{format ? format(value) : String(value)}</Text>
    <Pressable
      style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}
      onPress={() => onChange(Math.min(max, value + step))}
      accessibilityRole="button"
      accessibilityLabel="Increase"
    >
      <Text style={styles.stepText}>+</Text>
    </Pressable>
  </View>
);

export const SettingsScreen = () => {
  const navigation = useNavigation<any>();
  const { userName, userProfile } = useUser();
  const {
    connected,
    pairedDevice,
    scanning,
    nearbyDevices,
    scan,
    pair,
    connect,
    disconnect,
    unpair,
  } = useDevice();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [snoreThreshold, setSnoreThreshold] = useState(3);
  const [pumpDuration, setPumpDuration] = useState(12);
  const [micShift, setMicShift] = useState(15);
  const settingsDirtyRef = useRef(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [disconnectVisible, setDisconnectVisible] = useState(false);
  const [unpairVisible, setUnpairVisible] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<BLEDevice | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [testingNotif, setTestingNotif] = useState(false);
  const pinRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!pinModalVisible) return;
    const timer = setTimeout(() => pinRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [pinModalVisible]);

  const loadStoredSettings = useCallback(() => {
    const settings = bleService.getDeviceSettings();
    setSnoreThreshold(settings.snoreThreshold);
    setPumpDuration(settings.pumpDuration);
    setMicShift(settings.micShift);
    settingsDirtyRef.current = false;
  }, []);

  useEffect(() => {
    loadStoredSettings();
    hydrateNotificationPref()
      .then(setNotificationsOn)
      .finally(() => setLoading(false));
  }, [loadStoredSettings]);

  useFocusEffect(
    useCallback(() => {
      if (!settingsDirtyRef.current) {
        loadStoredSettings();
      }
    }, [loadStoredSettings]),
  );

  const markSettingsDirty = () => {
    settingsDirtyRef.current = true;
  };

  const handleConfirmSave = async () => {
    setConfirmVisible(false);
    try {
      const saved = await bleService.saveDeviceSettings({ snoreThreshold, pumpDuration, micShift });
      setSnoreThreshold(saved.snoreThreshold);
      setPumpDuration(saved.pumpDuration);
      setMicShift(saved.micShift);
      settingsDirtyRef.current = false;
      setSaveError(false);
      setSaveMessage(
        connected ? 'Device settings saved to pillow' : 'Settings saved on phone (connect pillow to sync)',
      );
      setTimeout(() => setSaveMessage(''), 2800);
    } catch (error) {
      setSaveError(true);
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save settings');
      setTimeout(() => setSaveMessage(''), 3200);
    }
  };

  const handleScan = async () => {
    setBusy(true);
    try {
      await scan();
    } catch (error) {
      Alert.alert('Scan failed', error instanceof Error ? error.message : 'Could not scan.');
    } finally {
      setBusy(false);
    }
  };

  const openPinModal = (device: BLEDevice) => {
    setSelectedDevice(device);
    setPin('');
    setPinError('');
    setPinModalVisible(true);
  };

  const handlePair = async () => {
    if (!selectedDevice) return;
    if (!isValidPairingPin(pin)) {
      setPinError('Enter all 7 digits from the pillow label.');
      return;
    }
    setBusy(true);
    try {
      await pair(selectedDevice, pin);
      setPinModalVisible(false);
      setPin('');
    } catch (error) {
      setPinError(error instanceof Error ? error.message : 'Pairing failed');
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = async () => {
    setBusy(true);
    try {
      await connect();
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnectVisible(false);
    setBusy(true);
    try {
      await disconnect();
    } finally {
      setBusy(false);
    }
  };

  const handleUnpair = async () => {
    setUnpairVisible(false);
    setBusy(true);
    try {
      await unpair();
    } finally {
      setBusy(false);
    }
  };

  const handleToggleNotifications = async (next: boolean) => {
    setNotificationsOn(next);
    const applied = await setNotificationsEnabled(next);
    if (next && !applied) {
      setNotificationsOn(false);
      Alert.alert(
        'Permission needed',
        'Enable notifications in your system settings to receive snore alerts.',
      );
    }
  };

  const handleTestNotification = async () => {
    setTestingNotif(true);
    try {
      await sendTestNotification();
    } catch (error) {
      Alert.alert(
        'Test failed',
        error instanceof Error ? error.message : 'Could not send a test notification.',
      );
    } finally {
      setTestingNotif(false);
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

  const statusColor = connected ? '#10b981' : pairedDevice ? '#f59e0b' : '#94a3b8';
  const statusLabel = connected ? 'Connected' : pairedDevice ? 'Paired · Offline' : 'Not paired';
  const pinDigits = Array.from({ length: PIN_LENGTH }, (_, i) => pin[i] || '');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Pair your pillow here, then tune device behavior</Text>

        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.85}
        >
          <ProfileAvatar
            name={userName}
            photoUri={userProfile?.photoUri}
            size={56}
            radius={16}
          />
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{userName || 'Guest User'}</Text>
            <Text style={styles.profileHint}>Edit profile and photo</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={14} color="#94a3b8" />
        </TouchableOpacity>

        <GlassCard style={styles.card}>
          <View style={styles.deviceTitleRow}>
            <FontAwesome5 name="bell" size={16} color="#818cf8" />
            <Text style={styles.cardTitle}>Push notifications</Text>
          </View>
          <Text style={styles.cardHint}>
            Alerts only when consecutive snores hit your threshold or the pump inflates — not every sound.
          </Text>
          <View style={styles.notifyRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.settingLabel}>Snore alerts</Text>
              <Text style={styles.settingHint}>
                {notificationsOn ? 'Notifications are on' : 'Notifications are off'}
              </Text>
            </View>
            <Switch
              value={notificationsOn}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#374151', true: '#6366f1' }}
              thumbColor={notificationsOn ? '#c7d2fe' : '#9ca3af'}
              ios_backgroundColor="#374151"
            />
          </View>
          <TouchableOpacity
            style={[styles.testButton, !notificationsOn && styles.saveButtonDisabled]}
            onPress={handleTestNotification}
            disabled={!notificationsOn || testingNotif}
          >
            {testingNotif ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <FontAwesome5 name="paper-plane" size={13} color="#ffffff" />
                <Text style={styles.testButtonText}>Send test notification</Text>
              </>
            )}
          </TouchableOpacity>
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.deviceHeader}>
            <View style={styles.deviceTitleRow}>
              <FontAwesome5 name="bluetooth-b" size={16} color="#818cf8" />
              <Text style={styles.cardTitle}>Device pairing</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          <Text style={styles.cardHint}>
            {isMockBle
              ? 'Demo Bluetooth is on. This build is not talking to the ESP32.'
              : 'Live Bluetooth is on. Scan should find HAGOKILLER Pillow, and the ESP32 serial should show “app connected”.'}
          </Text>

          {[
            ['Bluetooth', isMockBle ? 'Demo' : 'Live'],
            ['Device', pairedDevice?.name || 'None'],
            ['Address', pairedDevice?.bleAddress || '—'],
            ['Signal', pairedDevice ? `${pairedDevice.signalStrength} dBm` : '—'],
            ['Session', connected ? 'Active BLE link' : 'Disconnected'],
          ].map(([label, value]) => (
            <View key={label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value}</Text>
            </View>
          ))}

          <View style={styles.actionRow}>
            {connected ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.disconnectButton]}
                onPress={() => setDisconnectVisible(true)}
                disabled={busy}
              >
                <FontAwesome5 name="unlink" size={13} color="#fecaca" />
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            ) : pairedDevice ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.connectButton]}
                onPress={handleConnect}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <FontAwesome5 name="link" size={13} color="#ffffff" />
                    <Text style={styles.connectText}>Reconnect</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.connectButton]}
                onPress={handleScan}
                disabled={busy || scanning}
              >
                {scanning || busy ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <FontAwesome5 name="search" size={13} color="#ffffff" />
                    <Text style={styles.connectText}>Scan nearby</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {pairedDevice ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.unpairButton]}
                onPress={() => setUnpairVisible(true)}
                disabled={busy}
              >
                <Text style={styles.unpairText}>Unpair</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {!pairedDevice && nearbyDevices.length > 0 ? (
            <View style={styles.scanList}>
              <Text style={styles.scanTitle}>Nearby pillows</Text>
              {nearbyDevices.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  style={styles.deviceRow}
                  onPress={() => openPinModal(device)}
                >
                  <View>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <Text style={styles.deviceMeta}>
                      {device.bleAddress} · {device.signalStrength} dBm
                    </Text>
                  </View>
                  <Text style={styles.pairChip}>Pair</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Device Parameter Settings</Text>
          <Text style={styles.cardHint}>
            Adjust snore detection and pump behavior for the connected pillow.
          </Text>

          <View style={styles.settingRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.settingLabel}>Consecutive snore threshold</Text>
              <Text style={styles.settingHint}>Events before the pump starts</Text>
            </View>
            <Stepper
              value={snoreThreshold}
              min={1}
              max={10}
              onChange={(value) => {
                markSettingsDirty();
                setSnoreThreshold(value);
              }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.settingLabel}>Pump activation duration</Text>
              <Text style={styles.settingHint}>Seconds the air pump stays on (5–120)</Text>
            </View>
            <Stepper
              value={pumpDuration}
              min={PUMP_DURATION_MIN_SEC}
              max={PUMP_DURATION_MAX_SEC}
              step={PUMP_DURATION_STEP_SEC}
              format={(value) => `${value}s`}
              onChange={(value) => {
                markSettingsDirty();
                setPumpDuration(value);
              }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.settingLabel}>Mic shift</Text>
              <Text style={styles.settingHint}>Higher = closer range (15 default, 16 if still far)</Text>
            </View>
            <Stepper
              value={micShift}
              min={12}
              max={16}
              onChange={(value) => {
                markSettingsDirty();
                setMicShift(value);
              }}
            />
          </View>

          {saveMessage ? (
            <Text style={[styles.saveMessage, saveError && styles.saveError]}>{saveMessage}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => setConfirmVisible(true)}
          >
            <Text style={styles.saveButtonText}>
              {connected ? 'Save Device Settings' : 'Save on Phone (connect pillow to sync)'}
            </Text>
          </TouchableOpacity>
        </GlassCard>
      </ScrollView>

      <Modal transparent visible={pinModalVisible} animationType="fade" onRequestClose={() => setPinModalVisible(false)}>
        <KeyboardAvoidingView style={styles.pinOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.pinCard}>
            <Text style={styles.pinTitle}>Pair {selectedDevice?.name}</Text>
            <Text style={styles.pinHint}>Enter the 7-digit PIN under the pillow. Demo PIN: 1234567</Text>
            <View style={styles.pinRow}>
              {pinDigits.map((digit, index) => (
                <View key={index} style={[styles.pinBox, digit ? styles.pinBoxFilled : null]} pointerEvents="none">
                  <Text style={styles.pinDigit}>{digit}</Text>
                </View>
              ))}
              <TextInput
                ref={pinRef}
                value={pin}
                onChangeText={(value) => {
                  setPin(value.replace(/\D/g, '').slice(0, PIN_LENGTH));
                  setPinError('');
                }}
                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                inputMode="numeric"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                importantForAutofill="no"
                maxLength={PIN_LENGTH}
                autoFocus
                caretHidden
                showSoftInputOnFocus
                blurOnSubmit={false}
                style={styles.pinOverlayInput}
              />
            </View>
            {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
            <View style={styles.pinActions}>
              <TouchableOpacity style={styles.pinCancel} onPress={() => setPinModalVisible(false)}>
                <Text style={styles.pinCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pinConfirm, pin.length !== PIN_LENGTH && styles.saveButtonDisabled]}
                onPress={handlePair}
                disabled={pin.length !== PIN_LENGTH || busy}
              >
                {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.pinConfirmText}>Pair</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmModal
        visible={confirmVisible}
        title="Save device settings?"
        message={`Apply ${snoreThreshold} snores, ${pumpDuration}s pump, and mic shift ${micShift}?`}
        confirmLabel="Save"
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmVisible(false)}
      />
      <ConfirmModal
        visible={disconnectVisible}
        title="Disconnect pillow?"
        message="The BLE session will close. You can reconnect later without entering the PIN again."
        confirmLabel="Disconnect"
        destructive
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnectVisible(false)}
      />
      <ConfirmModal
        visible={unpairVisible}
        title="Unpair this pillow?"
        message="This forgets the device. You will need the 7-digit PIN to pair again."
        confirmLabel="Unpair"
        destructive
        onConfirm={handleUnpair}
        onCancel={() => setUnpairVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textMuted, marginTop: 12, fontWeight: '600' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
  },
  profileCopy: { flex: 1, paddingHorizontal: 14 },
  profileName: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 2 },
  profileHint: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  testButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.35)',
  },
  testButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  card: { padding: 18, marginBottom: 16 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  cardHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 16 },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  deviceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 },
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
    borderTopColor: colors.border,
  },
  infoLabel: { color: colors.textMuted, fontSize: 13 },
  infoValue: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', maxWidth: '62%', textAlign: 'right' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectButton: { backgroundColor: '#6366f1' },
  disconnectButton: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  unpairButton: {
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 0.7,
  },
  connectText: { color: colors.onAccent, fontWeight: '800' },
  disconnectText: { color: '#fecaca', fontWeight: '800' },
  unpairText: { color: colors.textSecondary, fontWeight: '700' },
  scanList: { marginTop: 16 },
  scanTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deviceName: { color: colors.text, fontWeight: '700', marginBottom: 2 },
  deviceMeta: { color: colors.textMuted, fontSize: 11 },
  pairChip: { color: colors.accent, fontWeight: '800' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingLabel: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  settingHint: { color: colors.textMuted, fontSize: 11 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  stepButtonPressed: { backgroundColor: colors.accentSoft },
  stepText: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  stepValue: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 48, textAlign: 'center' },
  saveButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.35)',
  },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  saveMessage: { color: '#10b981', fontSize: 12, marginBottom: 10, fontWeight: '600' },
  saveError: { color: '#fca5a5' },
  pinOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(5,6,12,0.72)',
  },
  pinCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pinTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  pinHint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  pinRow: { flexDirection: 'row', gap: 6, marginBottom: 12, position: 'relative' },
  pinBox: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxFilled: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pinDigit: { color: colors.text, fontSize: 20, fontWeight: '800' },
  pinOverlayInput: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    fontSize: 16,
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  pinError: { color: '#fca5a5', textAlign: 'center', marginBottom: 10 },
  pinActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  pinCancel: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: colors.backgroundMuted,
  },
  pinCancelText: { color: colors.textSecondary, fontWeight: '700' },
  pinConfirm: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#6366f1',
  },
  pinConfirmText: { color: '#ffffff', fontWeight: '800' },
});
