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
import { ImportDataModal } from '../components/ImportDataModal';
import { SnoreDetectionControls } from '../components/SnoreDetectionControls';
import { BleRadarAnimation } from '../components/BleRadarAnimation';
import { MicTestRadar } from '../components/MicTestRadar';
import { useDevice } from '../context/DeviceContext';
import { useUser } from '../context/UserContext';
import { bleService, isMockBle } from '../services/bleService';
import { exportDataToFileOrShare, ImportResult } from '../services/dataExportImport';
import {
  hydrateNotificationPref,
  setNotificationsEnabled,
  sendTestNotification,
} from '../services/snoreNotifications';
import { playRiskAlarmSound, stopRiskAlarmSound, subscribeRiskAlarm } from '../services/riskAlarmSound';
import {
  cancelDailyAdviceNotifications,
  scheduleDailyAdviceNotifications,
} from '../services/dailyAdviceNotifications';
import { BLEDevice, OnDeviceModelTier } from '../types';
import { isValidPairingPin } from '../utils/pinValidation';
import { colors } from '../constants/theme';
import { loadSleepEvents, clearUserData } from '../services/userStorage';
import {
  PUMP_DURATION_MAX_SEC,
  PUMP_DURATION_MIN_SEC,
  PUMP_DURATION_STEP_SEC,
  SNORE_WINDOW_MAX_SEC,
  SNORE_WINDOW_MIN_SEC,
  SNORE_WINDOW_STEP_SEC,
} from '../services/deviceSettings';
import { TEST_PUMP_SECONDS } from '../services/esp32Protocol';
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
  const { userName } = useUser();
  const {
    connected,
    pairedDevice,
    scanning,
    nearbyDevices,
    snoreDetectionEnabled,
    micTestActive,
    micTestPreview,
    scan,
    pair,
    connect,
    disconnect,
    unpair,
    startMicTest,
    stopMicTest,
  } = useDevice();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [micTestBusy, setMicTestBusy] = useState(false);
  const [snoreThreshold, setSnoreThreshold] = useState(3);
  const [snoreWindowSec, setSnoreWindowSec] = useState(15);
  const [pumpDuration, setPumpDuration] = useState(40);
  const [micShift, setMicShift] = useState(12);
  const settingsDirtyRef = useRef(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [unpairVisible, setUnpairVisible] = useState(false);
  const [reconnectVisible, setReconnectVisible] = useState(false);
  const [disconnectVisible, setDisconnectVisible] = useState(false);
  const [stopConfirmVisible, setStopConfirmVisible] = useState(false);
  const [testPumpConfirmVisible, setTestPumpConfirmVisible] = useState(false);
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
  const [alarmPlaying, setAlarmPlaying] = useState(false);
  const [panel, setPanel] = useState<
    null | 'notifications' | 'model' | 'pairing' | 'health' | 'detection' | 'controls'
  >(null);
  const [modelRepairStatus, setModelRepairStatus] = useState<'idle' | 'downloading' | 'success' | 'error'>('idle');
  const [repairConfirmVisible, setRepairConfirmVisible] = useState(false);
  const [modelDownloadTier, setModelDownloadTier] = useState<OnDeviceModelTier | null>(null);
  const [modelRepairProgress, setModelRepairProgress] = useState(0);
  const [modelRepairMessage, setModelRepairMessage] = useState('');
  const [selectedModelTier, setSelectedModelTier] = useState<OnDeviceModelTier>('compact');
  const [lastPillowSync, setLastPillowSync] = useState<number | null>(null);
  const [clearingData, setClearingData] = useState(false);
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [clearMessage, setClearMessage] = useState('');
  const [exportingData, setExportingData] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [dataFeedbackMessage, setDataFeedbackMessage] = useState('');
  const [dataFeedbackType, setDataFeedbackType] = useState<'success' | 'error'>('success');
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
      // Mic test keeps running until the user taps Stop (do not auto-stop on blur).
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
    setTestPumpConfirmVisible(false);
    setCommandBusy(true);
    setCommandMessage('');
    try {
      const argSeconds = command === 'open_valve' ? 8 : command === 'test_pump' ? TEST_PUMP_SECONDS : 0;
      await bleService.sendDeviceCommand(command, argSeconds);
      setCommandError(false);
      setCommandMessage(
        command === 'emergency_stop'
          ? 'Air pump stop sent to pillow.'
          : command === 'test_pump'
            ? `Test pump sent — the pump should run for ${TEST_PUMP_SECONDS}s.`
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
    setPinError('');
    try {
      await pair(selectedDevice, pin);
      setPinModalVisible(false);
      setPin('');
    } catch (error) {
      // Stay on the PIN screen until the correct code is entered.
      setPin('');
      setPinError(error instanceof Error ? error.message : 'Pairing failed');
      setTimeout(() => pinRef.current?.focus(), 200);
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

  const handleReconnect = async () => {
    setReconnectVisible(false);
    setBusy(true);
    try {
      await connect();
    } catch (error) {
      Alert.alert(
        'Reconnect failed',
        error instanceof Error ? error.message : 'Could not restore the Bluetooth link.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnectVisible(false);
    setBusy(true);
    try {
      await disconnect();
    } catch (error) {
      Alert.alert(
        'Disconnect failed',
        error instanceof Error ? error.message : 'Could not close the Bluetooth link.',
      );
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

  useEffect(() => subscribeRiskAlarm(setAlarmPlaying), []);

  const handleTestAlarm = async () => {
    try {
      await playRiskAlarmSound();
    } catch (error) {
      Alert.alert(
        'Alarm test failed',
        error instanceof Error ? error.message : 'Could not play the alarm ringtone.',
      );
    }
  };

  const handleStopAlarm = async () => {
    try {
      await stopRiskAlarmSound();
    } catch (error) {
      Alert.alert(
        'Could not stop the alarm',
        error instanceof Error ? error.message : 'The ringtone is still playing.',
      );
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
    setModelDownloadTier(tier);
  };

  const handleClearData = () => {
    setClearConfirmVisible(true);
  };

  const handleExportData = async () => {
    setExportingData(true);
    setDataFeedbackMessage('');
    try {
      const res = await exportDataToFileOrShare();
      setDataFeedbackType('success');
      if (res.method === 'download') {
        setDataFeedbackMessage(`Backup file downloaded: ${res.filename}`);
      } else {
        setDataFeedbackMessage('Backup shared successfully.');
      }
      setTimeout(() => setDataFeedbackMessage(''), 5500);
    } catch (err: any) {
      setDataFeedbackType('error');
      setDataFeedbackMessage(err?.message || 'Failed to export sleep data.');
      setTimeout(() => setDataFeedbackMessage(''), 5500);
    } finally {
      setExportingData(false);
    }
  };

  const handleImportComplete = (result: ImportResult) => {
    setDataFeedbackType('success');
    setDataFeedbackMessage(
      `Imported ${result.eventsImported} sleep events (${result.mode === 'replace' ? 'replaced' : 'merged'}).`
    );
    setTimeout(() => setDataFeedbackMessage(''), 6000);
  };

  const executeClearData = async () => {
    setClearConfirmVisible(false);
    setClearingData(true);
    setClearMessage('');
    try {
      if (typeof (bleService as any).clearAllData === 'function') {
        await (bleService as any).clearAllData();
      } else if (typeof (bleService as any).resetAndReseed === 'function') {
        await (bleService as any).resetAndReseed();
      } else if (typeof (bleService as any).clearEvents === 'function') {
        await (bleService as any).clearEvents();
      }
      await clearUserData();
      setClearMessage('All sleep history and logs have been cleared.');
      setTimeout(() => setClearMessage(''), 4500);
    } catch (e) {
      console.error('[clear data]', e);
      setClearMessage('Failed to clear sleep data. Please try again.');
      setTimeout(() => setClearMessage(''), 4500);
    } finally {
      setClearingData(false);
    }
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

  const statusColor = connected ? '#10b981' : pairedDevice ? '#ea580c' : '#94a3b8';
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
        {panel == null ? (
          <>
            <Text style={styles.title}>Settings</Text>

            <Text style={styles.groupLabel}>Account</Text>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.6}
            >
              <FontAwesome5 name="user" size={16} color={colors.accentDark} style={styles.menuIcon} />
              <Text style={styles.menuLabel}>{userName || 'Profile'}</Text>
              <FontAwesome5 name="chevron-right" size={12} color="#c5ced6" />
            </TouchableOpacity>

            <Text style={styles.groupLabel}>Pillow</Text>
            {[
              ['bluetooth-b', 'Pairing', 'pairing', statusLabel],
              ['heartbeat', 'Device health', 'health', healthNeedsAttention ? 'Check' : 'Ready'],
              ['sliders-h', 'Detection and inflation', 'detection', `${snoreThreshold} in ${snoreWindowSec}s`],
              ['hand-paper', 'Manual controls', 'controls', ''],
            ].map(([icon, label, id, value]) => (
              <TouchableOpacity
                key={id}
                style={styles.menuRow}
                onPress={() => setPanel(id as 'pairing')}
                activeOpacity={0.6}
              >
                <FontAwesome5 name={icon as 'bluetooth-b'} size={16} color={colors.accentDark} style={styles.menuIcon} />
                <Text style={styles.menuLabel}>{label}</Text>
                {value ? <Text style={styles.menuValue}>{value}</Text> : null}
                <FontAwesome5 name="chevron-right" size={12} color="#c5ced6" />
              </TouchableOpacity>
            ))}

            <Text style={styles.groupLabel}>Alerts</Text>
            <TouchableOpacity style={styles.menuRow} onPress={() => setPanel('notifications')} activeOpacity={0.6}>
              <FontAwesome5 name="bell" size={16} color={colors.accentDark} style={styles.menuIcon} />
              <Text style={styles.menuLabel}>Notifications</Text>
              <Text style={styles.menuValue}>{notificationsOn ? 'On' : 'Off'}</Text>
              <FontAwesome5 name="chevron-right" size={12} color="#c5ced6" />
            </TouchableOpacity>

            <Text style={styles.groupLabel}>Guidance</Text>
            <TouchableOpacity style={styles.menuRow} onPress={() => setPanel('model')} activeOpacity={0.6}>
              <FontAwesome5 name="brain" size={16} color={colors.accentDark} style={styles.menuIcon} />
              <Text style={styles.menuLabel}>On-device AI</Text>
              <FontAwesome5 name="chevron-right" size={12} color="#c5ced6" />
            </TouchableOpacity>

            <Text style={styles.groupLabel}>About</Text>
            <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Faq')} activeOpacity={0.6}>
              <FontAwesome5 name="question-circle" size={16} color={colors.accentDark} style={styles.menuIcon} />
              <Text style={styles.menuLabel}>FAQ</Text>
              <FontAwesome5 name="chevron-right" size={12} color="#c5ced6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('About')} activeOpacity={0.6}>
              <FontAwesome5 name="info-circle" size={16} color={colors.accentDark} style={styles.menuIcon} />
              <Text style={styles.menuLabel}>About</Text>
              <FontAwesome5 name="chevron-right" size={12} color="#c5ced6" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.detailBack} onPress={() => setPanel(null)} activeOpacity={0.6}>
            <FontAwesome5 name="chevron-left" size={14} color={colors.accentDark} />
            <Text style={styles.detailTitle}>
              {panel === 'notifications' ? 'Notifications'
                : panel === 'model' ? 'On-device AI'
                  : panel === 'pairing' ? 'Pairing'
                    : panel === 'health' ? 'Device health'
                      : panel === 'detection' ? 'Detection and inflation'
                        : 'Manual controls'}
            </Text>
          </TouchableOpacity>
        )}

        {panel === 'notifications' ? <GlassCard style={styles.card}>
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
          <TouchableOpacity
            style={[styles.testButton, styles.alarmPlayButton, alarmPlaying && styles.saveButtonDisabled]}
            onPress={handleTestAlarm}
            disabled={alarmPlaying}
          >
            <FontAwesome5 name="volume-up" size={13} color="#ffffff" />
            <Text style={styles.testButtonText}>Play test alarm</Text>
          </TouchableOpacity>
          {alarmPlaying ? (
            <TouchableOpacity
              style={[styles.testButton, styles.alarmStopButton]}
              onPress={handleStopAlarm}
            >
              <FontAwesome5 name="stop" size={13} color="#ffffff" />
              <Text style={styles.testButtonText}>Stop alarm</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.alarmTestHint}>
            The ringtone loops until you tap Stop here or Stop on the notification.
          </Text>
        </GlassCard> : null}

        {panel === 'model' ? (
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
        ) : null}

        {panel === 'pairing' ? (
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

          <BleRadarAnimation
            scanning={scanning}
            connected={connected}
            paired={!!pairedDevice}
            devices={!pairedDevice ? nearbyDevices : []}
            onSelectDevice={openPinModal}
          />

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
            {!pairedDevice ? (
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
            ) : (
              <>
                {connected ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.disconnectButton]}
                    onPress={() => setDisconnectVisible(true)}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fecaca" size="small" />
                    ) : (
                      <>
                        <FontAwesome5 name="bluetooth" size={13} color="#fecaca" />
                        <Text style={styles.disconnectText}>Disconnect</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.connectButton]}
                    onPress={() => setReconnectVisible(true)}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <FontAwesome5 name="sync" size={13} color="#ffffff" />
                        <Text style={styles.connectText}>Reconnect</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.unpairButton]}
                  onPress={() => setUnpairVisible(true)}
                  disabled={busy}
                >
                  <FontAwesome5 name="unlink" size={13} color={colors.textSecondary} />
                  <Text style={styles.unpairText}>Unpair</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

        </GlassCard>
        ) : null}

        {panel === 'health' ? (
        <GlassCard style={styles.card}>
          <View style={styles.deviceHeader}>
            <View style={styles.deviceTitleRow}>
              <FontAwesome5
                name="heartbeat"
                size={16}
                color={healthNeedsAttention ? '#f59e0b' : '#10b981'}
              />
              <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Device health</Text>
            </View>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: healthNeedsAttention ? '#f59e0b22' : '#10b98122',
                },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: healthNeedsAttention ? '#f59e0b' : '#10b981' },
                ]}
              />
              <Text
                style={[
                  styles.badgeText,
                  { color: healthNeedsAttention ? '#b45309' : '#047857' },
                ]}
              >
                {healthNeedsAttention ? 'Needs check' : 'Healthy'}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.healthStatusCard,
              {
                borderColor: healthNeedsAttention
                  ? 'rgba(245,158,11,0.35)'
                  : 'rgba(16,185,129,0.28)',
                backgroundColor: healthNeedsAttention ? '#fffbeb' : '#ecfdf5',
              },
            ]}
          >
            <View style={styles.healthStatusTop}>
              <Text
                style={[
                  styles.healthStatusTitle,
                  { color: healthNeedsAttention ? '#b45309' : '#047857' },
                ]}
              >
                {!pairedDevice
                  ? 'No pillow paired'
                  : connected
                    ? 'BLE link is active'
                    : 'Pillow is paired but offline'}
              </Text>
              {pairedDevice ? (
                <View style={styles.signalBars}>
                  {[0, 1, 2, 3].map((i) => {
                    const level =
                      signalQuality === 'Strong'
                        ? 4
                        : signalQuality === 'Fair'
                          ? 2
                          : signalQuality === 'Weak'
                            ? 1
                            : 0;
                    const on = i < level;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.signalBar,
                          {
                            height: 6 + i * 4,
                            backgroundColor: on
                              ? healthNeedsAttention
                                ? '#f59e0b'
                                : '#10b981'
                              : 'rgba(20,44,67,0.12)',
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              ) : null}
            </View>
            <Text style={styles.healthStatusHint}>
              {!pairedDevice
                ? 'Open Pairing to scan and connect your HAGOKILLER pillow.'
                : connected && signalQuality !== 'Weak'
                  ? 'Signal and session look good for overnight monitoring.'
                  : 'Reconnect from Pairing, or unpair and pair again if the link stays weak.'}
            </Text>
          </View>

          {[
            [
              'Connection',
              connected ? 'Connected' : pairedDevice ? 'Offline' : 'Not paired',
            ],
            [
              'Signal',
              pairedDevice
                ? `${signalQuality} · ${pairedDevice.signalStrength} dBm`
                : '—',
            ],
            [
              'Last sync',
              lastPillowSync ? moment(lastPillowSync).fromNow() : 'No events yet',
            ],
            ['Pump', connected ? 'Ready · idle' : 'Offline'],
            ['Device', pairedDevice?.name || 'None'],
          ].map(([label, value]) => (
            <View key={label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value}</Text>
            </View>
          ))}

          {pairedDevice && !connected ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.connectButton]}
                onPress={() => setReconnectVisible(true)}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <FontAwesome5 name="sync" size={13} color="#ffffff" />
                    <Text style={styles.connectText}>Reconnect</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </GlassCard>
        ) : null}

        {panel === 'detection' ? (
        <GlassCard style={styles.card}>
          <View style={styles.deviceHeader}>
            <View style={styles.deviceTitleRow}>
              <FontAwesome5 name="sliders-h" size={15} color={colors.accentDark} />
              <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Detection & inflation</Text>
            </View>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: !connected
                    ? '#94a3b822'
                    : snoreDetectionEnabled
                      ? '#10b98122'
                      : '#ea580c22',
                },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: !connected
                      ? '#94a3b8'
                      : snoreDetectionEnabled
                        ? '#10b981'
                        : '#ea580c',
                  },
                ]}
              />
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: !connected
                      ? '#64748b'
                      : snoreDetectionEnabled
                        ? '#047857'
                        : '#c2410c',
                  },
                ]}
              >
                {!connected ? 'Offline' : snoreDetectionEnabled ? 'Listening' : 'Paused'}
              </Text>
            </View>
          </View>

          <View style={styles.detectionSummary}>
            <Text style={styles.detectionSummaryTitle}>Pump recipe</Text>
            <Text style={styles.detectionSummaryValue}>
              {snoreThreshold} snores in {snoreWindowSec}s → pump {pumpDuration}s
            </Text>
            <Text style={styles.detectionSummaryHint}>
              Adjust below, then tap Save. Nothing is sent until you save.
            </Text>
          </View>

          <View style={styles.detectionSection}>
            <Text style={styles.detectionSectionLabel}>Overnight listening</Text>
            <SnoreDetectionControls hideTitle />
          </View>

          <View style={styles.detectionSection}>
            <Text style={styles.detectionSectionLabel}>Test snore mic</Text>
            <Text style={styles.detectionSummaryHint}>
              Works only while overnight listening is paused. Shows live snore / non-snore % and a verdict — does not count sleep events or run the pump.
            </Text>
            <MicTestRadar active={micTestActive} preview={micTestPreview} size={compact ? 168 : 200} />
            <View style={styles.micTestActions}>
              <TouchableOpacity
                style={[
                  styles.micTestButton,
                  styles.micTestStart,
                  (!connected || snoreDetectionEnabled || micTestActive || micTestBusy) &&
                    styles.micTestButtonDisabled,
                ]}
                disabled={!connected || snoreDetectionEnabled || micTestActive || micTestBusy}
                activeOpacity={0.85}
                onPress={async () => {
                  setMicTestBusy(true);
                  try {
                    await startMicTest();
                  } catch (error) {
                    Alert.alert(
                      'Mic test',
                      error instanceof Error ? error.message : 'Could not start mic test.',
                    );
                  } finally {
                    setMicTestBusy(false);
                  }
                }}
              >
                {micTestBusy && !micTestActive ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <FontAwesome5 name="microphone" size={13} color="#ffffff" />
                    <Text style={styles.micTestButtonText}>Start mic test</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.micTestButton,
                  styles.micTestStop,
                  (!connected || !micTestActive || micTestBusy) && styles.micTestButtonDisabled,
                ]}
                disabled={!connected || !micTestActive || micTestBusy}
                activeOpacity={0.85}
                onPress={async () => {
                  setMicTestBusy(true);
                  try {
                    await stopMicTest();
                  } catch (error) {
                    Alert.alert(
                      'Mic test',
                      error instanceof Error ? error.message : 'Could not stop mic test.',
                    );
                  } finally {
                    setMicTestBusy(false);
                  }
                }}
              >
                {micTestBusy && micTestActive ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <FontAwesome5 name="stop" size={13} color="#ffffff" />
                    <Text style={styles.micTestButtonText}>Stop</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {!connected ? (
              <Text style={styles.saveFootnote}>Connect the pillow to test the mic.</Text>
            ) : snoreDetectionEnabled ? (
              <Text style={styles.saveFootnote}>
                Pause overnight listening first — mic test is blocked while detection is on.
              </Text>
            ) : null}
          </View>

          <View style={styles.detectionSection}>
            <Text style={styles.detectionSectionLabel}>Trigger & pump</Text>

            <View style={styles.paramCard}>
              <View style={styles.paramRow}>
                <View style={styles.paramCopy}>
                  <Text style={styles.paramLabel}>Snore count</Text>
                  <Text style={styles.paramHint}>Events needed in the window</Text>
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

              <View style={styles.paramDivider} />

              <View style={styles.paramRow}>
                <View style={styles.paramCopy}>
                  <Text style={styles.paramLabel}>Detection window</Text>
                  <Text style={styles.paramHint}>Time to collect {snoreThreshold} snores</Text>
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

              <View style={styles.paramDivider} />

              <View style={styles.paramRow}>
                <View style={styles.paramCopy}>
                  <Text style={styles.paramLabel}>Max pump time</Text>
                  <Text style={styles.paramHint}>Inflation after the window fills</Text>
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

              <View style={styles.paramDivider} />

              <View style={styles.paramRow}>
                <View style={styles.paramCopy}>
                  <Text style={styles.paramLabel}>Mic shift</Text>
                  <Text style={styles.paramHint}>Lower = longer range (8–16)</Text>
                </View>
                <Stepper
                  value={micShift}
                  min={8}
                  max={16}
                  onChange={(value) => {
                    markSettingsDirty();
                    setMicShift(value);
                  }}
                />
              </View>
            </View>
          </View>

          {saveMessage ? (
            <Text style={[styles.saveMessage, saveError && styles.saveError]}>{saveMessage}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => setConfirmVisible(true)}
            activeOpacity={0.85}
          >
            <FontAwesome5
              name={connected ? 'save' : 'mobile-alt'}
              size={13}
              color="#ffffff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.saveButtonText}>
              {connected ? 'Save to pillow' : 'Save on phone'}
            </Text>
          </TouchableOpacity>
          {!connected ? (
            <Text style={styles.saveFootnote}>
              Saved locally now. Connect the pillow later to sync these values.
            </Text>
          ) : null}
        </GlassCard>
        ) : null}

        {panel === 'controls' ? (
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

          <TouchableOpacity
            style={[styles.testPumpButton, (!connected || commandBusy) && styles.saveButtonDisabled]}
            onPress={() => setTestPumpConfirmVisible(true)}
            disabled={!connected || commandBusy}
          >
            <FontAwesome5 name="play-circle" size={14} color="#ffffff" />
            <Text style={styles.dangerButtonText}>Test air pump ({TEST_PUMP_SECONDS}s)</Text>
          </TouchableOpacity>

          <View style={styles.dataDivider} />

          <Text style={[styles.cardTitle, { marginTop: 4, marginBottom: 4 }]}>Backup and restore data</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>
            Export all sleep sessions, night details, and settings to a JSON backup, or import data from a previous file.
          </Text>

          {dataFeedbackMessage ? (
            <View style={[
              styles.feedbackBanner,
              dataFeedbackType === 'error' ? styles.feedbackBannerError : styles.feedbackBannerSuccess,
            ]}>
              <FontAwesome5
                name={dataFeedbackType === 'error' ? 'exclamation-circle' : 'check-circle'}
                size={13}
                color={dataFeedbackType === 'error' ? '#ef4444' : '#10b981'}
              />
              <Text style={[
                styles.feedbackText,
                dataFeedbackType === 'error' ? styles.feedbackTextError : styles.feedbackTextSuccess,
              ]}>
                {dataFeedbackMessage}
              </Text>
            </View>
          ) : null}

          {/* Export Button */}
          <TouchableOpacity
            style={[styles.exportButton, exportingData && styles.saveButtonDisabled]}
            onPress={handleExportData}
            disabled={exportingData}
            activeOpacity={0.85}
          >
            {exportingData ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <FontAwesome5 name="file-export" size={14} color="#ffffff" />
            )}
            <Text style={styles.exportButtonText}>
              {exportingData ? 'Exporting…' : 'Export sleep data (JSON)'}
            </Text>
          </TouchableOpacity>

          {/* Import Button */}
          <TouchableOpacity
            style={styles.importButton}
            onPress={() => setImportModalVisible(true)}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="file-import" size={14} color="#0284c7" />
            <Text style={styles.importButtonText}>Import sleep data (JSON)</Text>
          </TouchableOpacity>

          <View style={styles.dataDivider} />

          <Text style={[styles.cardTitle, { marginTop: 4, marginBottom: 4 }]}>Reset sleep data</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
            Permanently erase all recorded sleep sessions and start with a clean slate.
          </Text>

          {clearMessage ? (
            <View style={[styles.feedbackBanner, styles.feedbackBannerSuccess]}>
              <FontAwesome5 name="check-circle" size={13} color="#10b981" />
              <Text style={[styles.feedbackText, styles.feedbackTextSuccess]}>{clearMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.dangerButton, clearingData && styles.saveButtonDisabled]}
            onPress={handleClearData}
            disabled={clearingData}
            activeOpacity={0.85}
          >
            {clearingData ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <FontAwesome5 name="trash-alt" size={14} color="#ffffff" />
            )}
            <Text style={styles.dangerButtonText}>
              {clearingData ? 'Clearing…' : 'Clear all sleep data'}
            </Text>
          </TouchableOpacity>
        </GlassCard>
        ) : null}

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
        visible={modelDownloadTier !== null}
        title={modelDownloadTier ? `Download ${ON_DEVICE_MODEL_SPECS[modelDownloadTier].label}?` : 'Download AI model?'}
        message={modelDownloadTier
          ? `${ON_DEVICE_MODEL_SPECS[modelDownloadTier].sizeMb} MB · ${modelDownloadTier === 'compact' ? 'Fastest and most compatible' : 'Stronger wording and reasoning'}\n\nKeep Hagokiller open and connected to Wi-Fi while downloading. The model and your sleep data stay private on this phone.`
          : ''}
        eyebrow="PRIVATE ON-DEVICE AI"
        confirmLabel="Download model"
        artwork="computer"
        onConfirm={() => {
          const tier = modelDownloadTier;
          setModelDownloadTier(null);
          if (tier) void runModelRepair(tier);
        }}
        onCancel={() => setModelDownloadTier(null)}
      />
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
        visible={testPumpConfirmVisible}
        title="Test the air pump?"
        message={`Runs the air pump for ${TEST_PUMP_SECONDS} seconds to check it works. This adds a little air to the pillow but does not change its inflation cycle. Use Manual stop if you need to cut it short.`}
        confirmLabel="Run test"
        onConfirm={() => runPillowCommand('test_pump')}
        onCancel={() => setTestPumpConfirmVisible(false)}
      />
      <ConfirmModal
        visible={reconnectVisible}
        title="Reconnect Hagokiller?"
        message="Restores the Bluetooth link to your paired smart pillow without entering the PIN again."
        confirmLabel="Reconnect"
        artwork="ble-reconnect"
        onConfirm={handleReconnect}
        onCancel={() => setReconnectVisible(false)}
      />
      <ConfirmModal
        visible={disconnectVisible}
        title="Disconnect Hagokiller?"
        message="Closes the Bluetooth link but keeps the pillow paired. Use Reconnect later without entering the PIN again."
        confirmLabel="Disconnect"
        destructive
        artwork="ble-disconnect"
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnectVisible(false)}
      />
      <ConfirmModal
        visible={unpairVisible}
        title="Unpair this pillow?"
        message="This forgets the device and closes Bluetooth. Scan and enter the 7-digit PIN to pair again."
        confirmLabel="Unpair"
        destructive
        artwork="unplug"
        onConfirm={handleUnpair}
        onCancel={() => setUnpairVisible(false)}
      />
      <ConfirmModal
        visible={clearConfirmVisible}
        title="Erase all sleep data?"
        message="This permanently deletes all recorded sleep sessions and logs. The dashboard, night details, and logs will be reset to 0 events. This cannot be undone."
        eyebrow="DATA RESET"
        confirmLabel="Yes, clear data"
        cancelLabel="Keep data"
        destructive
        onConfirm={executeClearData}
        onCancel={() => setClearConfirmVisible(false)}
      />
      <ImportDataModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onImportComplete={handleImportComplete}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  groupLabel: {
    color: '#8e8e8e',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 22,
    marginBottom: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#efefef',
  },
  menuIcon: { width: 28 },
  menuLabel: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '400' },
  menuValue: { color: '#8e8e8e', fontSize: 14, marginRight: 8 },
  detailBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  detailTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  pageColumn: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textMuted, marginTop: 12, fontWeight: '600' },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginBottom: 18, lineHeight: 19 },
  sectionHeading: { marginTop: 2, marginBottom: 8, paddingHorizontal: 4 },
  sectionEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 0,
    textTransform: 'uppercase',
  },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  safetyHeading: { marginTop: 6 },
  safetyEyebrow: { color: '#dc2626' },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 0,
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    shadowColor: '#142c43',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
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
  alarmPlayButton: {
    marginTop: 10,
  },
  alarmStopButton: {
    marginTop: 10,
    backgroundColor: '#b91c1c',
    borderColor: '#991b1b',
  },
  alarmTestHint: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
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
  card: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 0,
    backgroundColor: '#ffffff',
    shadowColor: '#142c43',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  listLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#142c43',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f7fb',
    marginRight: 12,
  },
  listCopy: { flex: 1, paddingRight: 8 },
  listTitle: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  listHint: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  listDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e7edf2', marginLeft: 60 },
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
  healthStatusCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  healthStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  healthStatusTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  healthStatusHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  signalBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 18,
  },
  signalBar: {
    width: 4,
    borderRadius: 2,
  },
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
  detectionSummary: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.22)',
    backgroundColor: colors.backgroundSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  detectionSummaryTitle: {
    color: colors.accentDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detectionSummaryValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  detectionSummaryHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  detectionSection: {
    marginBottom: 18,
  },
  detectionSectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  micTestActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  micTestButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  micTestStart: {
    backgroundColor: colors.accentDark,
  },
  micTestStop: {
    backgroundColor: '#b91c1c',
  },
  micTestButtonDisabled: {
    opacity: 0.45,
  },
  micTestButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  paramCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  paramCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  paramLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  paramHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  paramDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 12,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8 },
  stepButton: {
    width: 40,
    height: 40,
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
  stepValue: { color: colors.text, fontSize: 15, fontWeight: '800', minWidth: 44, textAlign: 'center' },
  saveButton: {
    backgroundColor: 'rgba(14, 165, 233, 0.95)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.35)',
  },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  saveFootnote: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveMessage: { color: '#10b981', fontSize: 12, marginBottom: 10, fontWeight: '600' },
  saveError: { color: '#fca5a5' },
  exportButton: {
    backgroundColor: '#0284c7',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  importButton: {
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 14,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  importButtonText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '600',
  },
  dataDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  feedbackBannerSuccess: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  feedbackBannerError: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  feedbackText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  feedbackTextSuccess: {
    color: '#065f46',
    fontWeight: '500',
  },
  feedbackTextError: {
    color: '#b91c1c',
    fontWeight: '500',
  },
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
  testPumpButton: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  dangerButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
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
