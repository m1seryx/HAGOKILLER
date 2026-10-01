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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import moment from 'moment';
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
import {
  cancelDailyAdviceNotifications,
  scheduleDailyAdviceNotifications,
} from '../services/dailyAdviceNotifications';
import { BLEDevice, OnDeviceModelTier } from '../types';
import { isValidPairingPin } from '../utils/pinValidation';
import { colors } from '../constants/theme';
import { loadSleepEvents } from '../services/userStorage';
import {
  PUMP_DURATION_MAX_SEC,
  PUMP_DURATION_MIN_SEC,
  PUMP_DURATION_STEP_SEC,
  SNORE_WINDOW_MAX_SEC,
  SNORE_WINDOW_MIN_SEC,
  SNORE_WINDOW_STEP_SEC,
} from '../services/deviceSettings';
import type { PillowCommand } from '../services/esp32Protocol';
import {
  isOnDeviceAiSupported,
  getDeviceModelRecommendation,
  getOnDeviceModelPreference,
  ON_DEVICE_MODEL_SPECS,
  repairOnDeviceModel,
} from '../services/onDeviceAssessment';
import {
  completeModelDownloadNotification,
  failModelDownloadNotification,
  startModelDownloadNotification,
  updateModelDownloadNotification,
} from '../services/modelDownloadNotifications';

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
  const { width } = useWindowDimensions();
  const compact = width < 380;
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
  const [snoreWindowSec, setSnoreWindowSec] = useState(15);
  const [pumpDuration, setPumpDuration] = useState(12);
  const [micShift, setMicShift] = useState(15);
  const settingsDirtyRef = useRef(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [disconnectVisible, setDisconnectVisible] = useState(false);
  const [reconnectVisible, setReconnectVisible] = useState(false);
  const [unpairVisible, setUnpairVisible] = useState(false);
  const [stopConfirmVisible, setStopConfirmVisible] = useState(false);
  const [valveConfirmVisible, setValveConfirmVisible] = useState(false);
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandMessage, setCommandMessage] = useState('');
  const [commandError, setCommandError] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<BLEDevice | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [testingNotif, setTestingNotif] = useState(false);
  const [modelRepairStatus, setModelRepairStatus] = useState<'idle' | 'downloading' | 'success' | 'error'>('idle');
  const [repairConfirmVisible, setRepairConfirmVisible] = useState(false);
  const [modelRepairProgress, setModelRepairProgress] = useState(0);
  const [modelRepairMessage, setModelRepairMessage] = useState('');
  const [selectedModelTier, setSelectedModelTier] = useState<OnDeviceModelTier>('compact');
  const [lastPillowSync, setLastPillowSync] = useState<number | null>(null);
  const pinRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!pinModalVisible) return;
    const timer = setTimeout(() => pinRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [pinModalVisible]);

  const loadStoredSettings = useCallback(() => {
    const settings = bleService.getDeviceSettings();
    setSnoreThreshold(settings.snoreThreshold);
    setSnoreWindowSec(settings.snoreWindowSec);
    setPumpDuration(settings.pumpDuration);
    setMicShift(settings.micShift);
    settingsDirtyRef.current = false;
  }, []);

  useEffect(() => {
    loadStoredSettings();
    hydrateNotificationPref()
      .then(setNotificationsOn)
      .finally(() => setLoading(false));
    getOnDeviceModelPreference().then(setSelectedModelTier).catch(() => undefined);
  }, [loadStoredSettings]);

  useFocusEffect(
    useCallback(() => {
      if (!settingsDirtyRef.current) {
        loadStoredSettings();
      }
      loadSleepEvents()
        .then((events) => setLastPillowSync(events[0]?.timestamp ?? null))
        .catch(() => setLastPillowSync(null));
    }, [loadStoredSettings]),
  );

  const markSettingsDirty = () => {
    settingsDirtyRef.current = true;
  };

  const handleConfirmSave = async () => {
    setConfirmVisible(false);
    try {
      const saved = await bleService.saveDeviceSettings({
        snoreThreshold,
        snoreWindowSec,
        pumpDuration,
        micShift,
      });
      setSnoreThreshold(saved.snoreThreshold);
      setSnoreWindowSec(saved.snoreWindowSec);
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

  const runPillowCommand = async (command: PillowCommand) => {
    setStopConfirmVisible(false);
    setValveConfirmVisible(false);
    setCommandBusy(true);
    setCommandMessage('');
    try {
      await bleService.sendDeviceCommand(command, command === 'open_valve' ? 8 : 0);
      setCommandError(false);
      setCommandMessage(
        command === 'emergency_stop'
          ? 'Air pump stop sent to pillow.'
          : 'Open solenoid valve sent to pillow.',
      );
      setTimeout(() => setCommandMessage(''), 4000);
    } catch (error) {
      setCommandError(true);
      setCommandMessage(error instanceof Error ? error.message : 'Command failed');
      setTimeout(() => setCommandMessage(''), 4000);
    } finally {
      setCommandBusy(false);
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
    setReconnectVisible(false);
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
        'Enable notifications in your system settings to receive snore alerts and daily tips.',
      );
      return;
    }
    if (applied && next) {
      await scheduleDailyAdviceNotifications('normal', 'stable');
    } else {
      await cancelDailyAdviceNotifications();
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

  const runModelRepair = async (tier: OnDeviceModelTier = selectedModelTier) => {
    setModelRepairStatus('downloading');
    setModelRepairProgress(0);
    setModelRepairMessage('');
    try {
      await startModelDownloadNotification();
      await repairOnDeviceModel((progress) => {
        setModelRepairProgress(progress);
        updateModelDownloadNotification(progress);
      }, tier);
      setSelectedModelTier(tier);
      setModelRepairStatus('success');
      setModelRepairMessage('AI model repaired successfully. Assessment guidance is ready.');
      await completeModelDownloadNotification();
    } catch (error) {
      setModelRepairStatus('error');
      setModelRepairMessage(error instanceof Error ? error.message : 'Could not repair the AI model.');
      await failModelDownloadNotification();
    }
  };

  const handleRepairModel = () => {
    if (!isOnDeviceAiSupported()) {
      Alert.alert('Native build required', 'Model repair is available in an installed EAS build, not Expo Go.');
      return;
    }
    setRepairConfirmVisible(true);
  };

  const chooseModelTier = (tier: OnDeviceModelTier) => {
    if (!isOnDeviceAiSupported()) {
      Alert.alert('Native build required', 'Local model downloads require an installed development or EAS build.');
      return;
    }
    const spec = ON_DEVICE_MODEL_SPECS[tier];
    Alert.alert(
      `Use ${spec.label}?`,
      `This downloads approximately ${spec.sizeMb} MB. Keep the app open and use Wi-Fi.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => { void runModelRepair(tier); } },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator color="#0ea5e9" size="large" />
          <Text style={styles.loadingText}>Loading device settings…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = connected ? '#10b981' : pairedDevice ? '#f59e0b' : '#94a3b8';
  const statusLabel = connected ? 'Connected' : pairedDevice ? 'Paired · Offline' : 'Not paired';
  const signalQuality = !pairedDevice
    ? 'Unavailable'
    : pairedDevice.signalStrength >= -60
      ? 'Strong'
      : pairedDevice.signalStrength >= -75 ? 'Fair' : 'Weak';
  const healthNeedsAttention = !connected || signalQuality === 'Weak';
  const pinDigits = Array.from({ length: PIN_LENGTH }, (_, i) => pin[i] || '');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pageColumn}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your account, smart pillow, alerts, and device behavior.</Text>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionEyebrow}>ACCOUNT</Text>
          <Text style={styles.sectionTitle}>Your profile</Text>
        </View>

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

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionEyebrow}>ALERTS</Text>
          <Text style={styles.sectionTitle}>Notifications</Text>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.deviceTitleRow}>
            <FontAwesome5 name="bell" size={16} color="#0284c7" />
            <Text style={styles.cardTitle}>Push notifications</Text>
          </View>
          <Text style={styles.cardHint}>
            Snore alerts when your threshold is hit or the pump inflates.
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
              trackColor={{ false: '#e0f2fe', true: '#0ea5e9' }}
              thumbColor={notificationsOn ? '#0284c7' : '#94a3b8'}
              ios_backgroundColor="#374151"
            />
          </View>
          <View style={styles.scheduleNote}>
            <View style={styles.scheduleIcon}>
              <FontAwesome5 name="clock" size={13} color="#0284c7" />
            </View>
            <View style={styles.scheduleCopy}>
              <Text style={styles.scheduleTitle}>Daily sleep tip</Text>
              <Text style={styles.scheduleText}>
                Scheduled every day at 8:00 AM, even when the app is closed.
              </Text>
            </View>
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

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionEyebrow}>INTELLIGENCE</Text>
          <Text style={styles.sectionTitle}>On-device guidance</Text>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.deviceTitleRow}>
            <FontAwesome5 name="tools" size={16} color={colors.accentDark} />
            <Text style={styles.cardTitle}>On-device AI model</Text>
          </View>
          <Text style={styles.cardHint}>
            Choose a model that fits this phone. Your selected model runs privately without sending sleep data to a server.
          </Text>
          <View style={styles.memoryRecommendation}>
            <FontAwesome5 name="mobile-alt" size={13} color={colors.accentDark} />
            <View style={styles.memoryRecommendationCopy}>
              <Text style={styles.memoryRecommendationTitle}>
                Recommended: {ON_DEVICE_MODEL_SPECS[getDeviceModelRecommendation().recommendedTier].label}
              </Text>
              <Text style={styles.memoryRecommendationText}>{getDeviceModelRecommendation().reason}</Text>
            </View>
          </View>
          <View style={styles.modelOptions}>
            {(['compact', 'enhanced'] as OnDeviceModelTier[]).map((tier) => {
              const spec = ON_DEVICE_MODEL_SPECS[tier];
              const active = selectedModelTier === tier;
              return (
                <TouchableOpacity
                  key={tier}
                  style={[styles.modelOption, active && styles.modelOptionActive]}
                  onPress={() => chooseModelTier(tier)}
                  disabled={modelRepairStatus === 'downloading'}
                >
                  <View style={styles.modelOptionTop}>
                    <Text style={styles.modelOptionTitle}>{spec.label}</Text>
                    {active ? <Text style={styles.modelActiveBadge}>ACTIVE</Text> : null}
                  </View>
                  <Text style={styles.modelOptionMeta}>{spec.sizeMb} MB · {tier === 'compact' ? 'Fastest and most compatible' : 'Stronger wording and reasoning'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {modelRepairStatus === 'downloading' ? (
            <View style={styles.modelProgressWrap}>
              <View style={styles.modelProgressTrack}>
                <View
                  style={[
                    styles.modelProgressFill,
                    { width: `${Math.round(modelRepairProgress * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.modelProgressText}>
                Redownloading AI model... {Math.round(modelRepairProgress * 100)}%
              </Text>
            </View>
          ) : null}
          {modelRepairMessage ? (
            <Text style={modelRepairStatus === 'error' ? styles.modelRepairError : styles.modelRepairSuccess}>
              {modelRepairMessage}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.testButton, modelRepairStatus === 'downloading' && styles.saveButtonDisabled]}
            onPress={handleRepairModel}
            disabled={modelRepairStatus === 'downloading'}
          >
            {modelRepairStatus === 'downloading' ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <>
                <FontAwesome5 name="sync-alt" size={13} color={colors.onAccent} />
                <Text style={styles.testButtonText}>Repair selected model ({ON_DEVICE_MODEL_SPECS[selectedModelTier].sizeMb} MB)</Text>
              </>
            )}
          </TouchableOpacity>
        </GlassCard>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionEyebrow}>HAGOKILLER</Text>
          <Text style={styles.sectionTitle}>Pairing and connection</Text>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.deviceHeader}>
            <View style={styles.deviceTitleRow}>
              <FontAwesome5 name="bluetooth-b" size={16} color="#0284c7" />
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
                onPress={() => setReconnectVisible(true)}
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
          <View style={styles.healthHeader}>
            <View style={styles.deviceTitleRow}>
              <FontAwesome5 name="heartbeat" size={16} color={healthNeedsAttention ? '#f59e0b' : '#10b981'} />
              <Text style={styles.cardTitle}>Hagokiller device health</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: healthNeedsAttention ? '#f59e0b22' : '#10b98122' }]}>
              <View style={[styles.dot, { backgroundColor: healthNeedsAttention ? '#f59e0b' : '#10b981' }]} />
              <Text style={[styles.badgeText, { color: healthNeedsAttention ? '#b45309' : '#047857' }]}>
                {healthNeedsAttention ? 'Check connection' : 'Ready'}
              </Text>
            </View>
          </View>
          <Text style={styles.cardHint}>Connection diagnostics use values the pillow currently reports. Missing firmware fields are shown honestly.</Text>
          <View style={styles.healthGrid}>
            {[
              ['Signal quality', signalQuality, 'signal'],
              ['Last synchronization', lastPillowSync ? moment(lastPillowSync).fromNow() : 'No events synced', 'sync'],
              ['Pump status', connected ? 'Ready · idle' : 'Unavailable offline', 'wind'],
              ['Battery', 'Not reported by firmware', 'battery-half'],
              ['Firmware version', 'Not reported by firmware', 'microchip'],
              ['Diagnostics', connected && signalQuality !== 'Weak' ? 'BLE link looks healthy' : 'Reconnect and move closer', 'stethoscope'],
            ].map(([label, value, icon]) => (
              <View key={label} style={styles.healthItem}>
                <View style={styles.healthIcon}><FontAwesome5 name={icon as any} size={11} color={colors.accentDark} /></View>
                <View style={styles.healthCopy}>
                  <Text style={styles.healthLabel}>{label}</Text>
                  <Text style={styles.healthValue}>{value}</Text>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionEyebrow}>PILLOW RESPONSE</Text>
          <Text style={styles.sectionTitle}>Detection and inflation</Text>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Device Parameter Settings</Text>
          <Text style={styles.cardHint}>
            Pump starts when enough snore events land inside the detection window (default: 3 in 15s).
          </Text>

          <View style={[styles.settingRow, compact && styles.settingRowCompact]}>
            <View style={[styles.settingCopy, compact && styles.settingCopyCompact]}>
              <Text style={styles.settingLabel}>Snoring events to trigger</Text>
              <Text style={styles.settingHint}>
                Count of snore detections inside the window (default 3)
              </Text>
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

          <View style={[styles.settingRow, compact && styles.settingRowCompact]}>
            <View style={[styles.settingCopy, compact && styles.settingCopyCompact]}>
              <Text style={styles.settingLabel}>Detection window</Text>
              <Text style={styles.settingHint}>
                If {snoreThreshold} snores occur within this time, the pump starts (default 15s)
              </Text>
            </View>
            <Stepper
              value={snoreWindowSec}
              min={SNORE_WINDOW_MIN_SEC}
              max={SNORE_WINDOW_MAX_SEC}
              step={SNORE_WINDOW_STEP_SEC}
              format={(value) => `${value}s`}
              onChange={(value) => {
                markSettingsDirty();
                setSnoreWindowSec(value);
              }}
            />
          </View>

          <View style={[styles.settingRow, compact && styles.settingRowCompact]}>
            <View style={[styles.settingCopy, compact && styles.settingCopyCompact]}>
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

          <View style={[styles.settingRow, compact && styles.settingRowCompact]}>
            <View style={[styles.settingCopy, compact && styles.settingCopyCompact]}>
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

        <View style={[styles.sectionHeading, styles.safetyHeading]}>
          <Text style={[styles.sectionEyebrow, styles.safetyEyebrow]}>SAFETY</Text>
          <Text style={styles.sectionTitle}>Manual pillow controls</Text>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Prototype safety controls</Text>
          <Text style={styles.cardHint}>
            Use if inflation fails or the pillow stays pressurized. Pillow must be connected over BLE.
          </Text>

          {commandMessage ? (
            <Text style={[styles.saveMessage, commandError && styles.saveError]}>{commandMessage}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.dangerButton, (!connected || commandBusy) && styles.saveButtonDisabled]}
            onPress={() => setStopConfirmVisible(true)}
            disabled={!connected || commandBusy}
          >
            {commandBusy ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <FontAwesome5 name="stop-circle" size={14} color="#ffffff" />
                <Text style={styles.dangerButtonText}>Manual stop air pump</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.valveButton, (!connected || commandBusy) && styles.saveButtonDisabled]}
            onPress={() => setValveConfirmVisible(true)}
            disabled={!connected || commandBusy}
          >
            <FontAwesome5 name="wind" size={14} color="#ffffff" />
            <Text style={styles.dangerButtonText}>Open solenoid valve (release air)</Text>
          </TouchableOpacity>
        </GlassCard>
        </View>
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
        visible={repairConfirmVisible}
        title="Repair AI model?"
        message={`This replaces ${ON_DEVICE_MODEL_SPECS[selectedModelTier].label} with a fresh ${ON_DEVICE_MODEL_SPECS[selectedModelTier].sizeMb} MB download. Keep the app open and use Wi-Fi.`}
        confirmLabel="Repair model"
        artwork="computer"
        onConfirm={() => {
          setRepairConfirmVisible(false);
          void runModelRepair();
        }}
        onCancel={() => setRepairConfirmVisible(false)}
      />
      <ConfirmModal
        visible={confirmVisible}
        title="Save device settings?"
        message={`Trigger after ${snoreThreshold} snores in ${snoreWindowSec}s, pump ${pumpDuration}s, mic shift ${micShift}?`}
        confirmLabel="Save"
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmVisible(false)}
      />
      <ConfirmModal
        visible={stopConfirmVisible}
        title="Stop the air pump?"
        message="Turns the air pump off immediately if a prototype failure occurs mid-inflate. Does not open the solenoid — use Release air for that."
        confirmLabel="Stop pump"
        destructive
        onConfirm={() => runPillowCommand('emergency_stop')}
        onCancel={() => setStopConfirmVisible(false)}
      />
      <ConfirmModal
        visible={valveConfirmVisible}
        title="Open solenoid valve?"
        message="Opens the valve to release air from the pillow. Confirm only when you need to deflate safely."
        confirmLabel="Release air"
        onConfirm={() => runPillowCommand('open_valve')}
        onCancel={() => setValveConfirmVisible(false)}
      />
      <ConfirmModal
        visible={disconnectVisible}
        title="Disconnect Hagokiller?"
        message="Hagosaur will close the BLE link to your smart pillow. You can reconnect later without entering the PIN again."
        confirmLabel="Disconnect"
        destructive
        artwork="ble-disconnect"
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnectVisible(false)}
      />
      <ConfirmModal
        visible={reconnectVisible}
        title="Reconnect Hagokiller?"
        message="Hagosaur will restore the BLE link to your paired smart pillow."
        confirmLabel="Reconnect"
        artwork="ble-reconnect"
        onConfirm={handleConnect}
        onCancel={() => setReconnectVisible(false)}
      />
      <ConfirmModal
        visible={unpairVisible}
        title="Unpair this pillow?"
        message="This forgets the device. You will need the 7-digit PIN to pair again."
        confirmLabel="Unpair"
        destructive
        artwork="unplug"
        onConfirm={handleUnpair}
        onCancel={() => setUnpairVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  pageColumn: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textMuted, marginTop: 12, fontWeight: '600' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  sectionHeading: { marginTop: 4, marginBottom: 9, paddingHorizontal: 2 },
  sectionEyebrow: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  safetyHeading: { marginTop: 6 },
  safetyEyebrow: { color: '#dc2626' },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 14,
    marginBottom: 22,
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
  scheduleNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scheduleIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: colors.accentSoft,
  },
  scheduleCopy: { flex: 1 },
  scheduleTitle: { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: 2 },
  scheduleText: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  testButton: {
    backgroundColor: 'rgba(14, 165, 233, 0.9)',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.35)',
  },
  testButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  modelProgressWrap: { marginBottom: 14 },
  modelProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.backgroundMuted,
    overflow: 'hidden',
    marginBottom: 8,
  },
  modelProgressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  modelProgressText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  memoryRecommendation: { flexDirection: 'row', alignItems: 'flex-start', padding: 11, borderRadius: 12, backgroundColor: colors.accentSoft, marginBottom: 10 },
  memoryRecommendationCopy: { flex: 1, marginLeft: 9 },
  memoryRecommendationTitle: { color: colors.text, fontSize: 11, fontWeight: '800' },
  memoryRecommendationText: { color: colors.textMuted, fontSize: 9, lineHeight: 14, marginTop: 3 },
  modelOptions: { marginBottom: 12 },
  modelOption: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundSoft, marginBottom: 8 },
  modelOptionActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  modelOptionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modelOptionTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  modelActiveBadge: { color: colors.accentDark, fontSize: 8, fontWeight: '900' },
  modelOptionMeta: { color: colors.textMuted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  modelRepairSuccess: { color: '#047857', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  modelRepairError: { color: '#b91c1c', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  card: { padding: 16, marginBottom: 22, borderRadius: 16 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  cardHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 16 },
  deviceHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    marginTop: 2,
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
  healthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  healthItem: { width: '48%', minHeight: 74, flexDirection: 'row', alignItems: 'flex-start', padding: 10, borderRadius: 12, backgroundColor: colors.backgroundSoft, borderWidth: 1, borderColor: colors.border },
  healthIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, marginRight: 8 },
  healthCopy: { flex: 1 },
  healthLabel: { color: colors.textMuted, fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  healthValue: { color: colors.textSecondary, fontSize: 10, lineHeight: 14, fontWeight: '700', marginTop: 3 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  actionButton: {
    flex: 1,
    minWidth: 120,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectButton: { backgroundColor: '#0ea5e9' },
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
  settingRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  settingCopy: { flex: 1, paddingRight: 12 },
  settingCopyCompact: { flex: 0, paddingRight: 0 },
  settingLabel: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  settingHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 10 },
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
    backgroundColor: 'rgba(14, 165, 233, 0.9)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.35)',
  },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  saveMessage: { color: '#10b981', fontSize: 12, marginBottom: 10, fontWeight: '600' },
  saveError: { color: '#fca5a5' },
  dangerButton: {
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  valveButton: {
    backgroundColor: '#0284c7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  dangerButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
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
    backgroundColor: '#0ea5e9',
  },
  pinConfirmText: { color: '#ffffff', fontWeight: '800' },
});
