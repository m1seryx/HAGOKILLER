import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import { FontAwesome5 } from '@expo/vector-icons';
import { GlassCard } from '../components/GlassCard';
import { RecommendationCard } from '../components/RecommendationCard';
import { OnDeviceAiCard, OnDeviceModelStatus } from '../components/OnDeviceAiCard';
import {
  AssessmentQuestionnaire,
  ActivityCheckInPayload,
} from '../components/AssessmentQuestionnaire';
import { bleService } from '../services/bleService';
import { calculateDashboardData } from '../services/mockBLEService';
import {
  loadDailyActivityCheckIn,
  saveDailyActivityCheckIn,
} from '../services/userStorage';
import { getRecommendations } from '../utils/recommendations';
import {
  downloadOnDeviceModel,
  isOnDeviceAiSupported,
  isOnDeviceModelDownloaded,
  requestOnDeviceAssessmentAdvice,
} from '../services/onDeviceAssessment';
import {
  completeModelDownloadNotification,
  failModelDownloadNotification,
  startModelDownloadNotification,
  updateModelDownloadNotification,
} from '../services/modelDownloadNotifications';
import { colors } from '../constants/theme';
import { DailyActivityCheckIn, DailyStats, MonthlyStats, RecommendationData } from '../types';

export const AssessmentScreen = () => {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [today, setToday] = useState<DailyStats | null>(null);
  const [month, setMonth] = useState<MonthlyStats | null>(null);
  const [checkIn, setCheckIn] = useState<DailyActivityCheckIn | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<RecommendationData | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [aiError, setAiError] = useState('');
  const [aiRetryNonce, setAiRetryNonce] = useState(0);
  const [modelStatus, setModelStatus] = useState<OnDeviceModelStatus>('checking');
  const [modelProgress, setModelProgress] = useState(0);
  const [modelError, setModelError] = useState('');
  const todayDate = moment().format('YYYY-MM-DD');

  const load = useCallback(async () => {
    const [events, savedCheckIn] = await Promise.all([
      bleService.fetchSleepEvents(),
      loadDailyActivityCheckIn(todayDate),
    ]);
    const data = calculateDashboardData(events);
    setToday(data.today);
    setMonth(data.thisMonth);
    setCheckIn(savedCheckIn);
  }, [todayDate]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveCheckIn = async (payload: ActivityCheckInPayload) => {
    const next: DailyActivityCheckIn = {
      date: todayDate,
      activities: payload.activities,
      otherActivityNote: payload.otherActivityNote ?? null,
      updatedAt: Date.now(),
    };
    await saveDailyActivityCheckIn(next);
    setCheckIn(next);
  };

  const fallbackRecommendations = useMemo(
    () => (today && month
      ? getRecommendations(today, month, month.trend, checkIn, todayDate)
      : null),
    [today, month, checkIn, todayDate],
  );

  useEffect(() => {
    if (!isOnDeviceAiSupported()) {
      setModelStatus('unsupported');
      return undefined;
    }
    let active = true;
    isOnDeviceModelDownloaded()
      .then((downloaded) => {
        if (active) setModelStatus(downloaded ? 'ready' : 'missing');
      })
      .catch(() => {
        if (active) {
          setModelStatus('error');
          setModelError('Could not check the phone storage. Use an installed development or preview build.');
        }
      });
    return () => { active = false; };
  }, []);

  const handleDownloadModel = async () => {
    setModelStatus('downloading');
    setModelProgress(0);
    setModelError('');
    try {
      await startModelDownloadNotification();
      await downloadOnDeviceModel((progress) => {
        setModelProgress(progress);
        updateModelDownloadNotification(progress);
      });
      setModelStatus('ready');
      await completeModelDownloadNotification();
    } catch (error) {
      setModelStatus('error');
      setModelError(error instanceof Error ? error.message : 'Could not download the AI model.');
      await failModelDownloadNotification();
    }
  };

  useEffect(() => {
    setAiRecommendation(null);
    if (!today || !month || !fallbackRecommendations || modelStatus !== 'ready') {
      setAiStatus('idle');
      return undefined;
    }
    if (today.severity === 'danger') {
      setAiStatus('idle');
      return undefined;
    }

    let active = true;
    setAiStatus('loading');
    setAiError('');
    requestOnDeviceAssessmentAdvice(today, month, checkIn, fallbackRecommendations)
      .then((advice) => {
        if (active) {
          setAiRecommendation(advice);
          setAiStatus('ready');
        }
      })
      .catch((error) => {
        if (active) {
          const message = error instanceof Error ? error.message : 'Unknown on-device AI error.';
          setAiError(message.slice(0, 240));
          setAiStatus('error');
        }
      });
    return () => { active = false; };
  }, [today, month, checkIn, fallbackRecommendations, modelStatus, aiRetryNonce]);

  if (loading || !today || !month) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading assessment…</Text>
      </SafeAreaView>
    );
  }

  const recommendations = aiRecommendation ?? fallbackRecommendations;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageColumn}>
        <Text style={styles.title}>Assessment</Text>
        <Text style={styles.subtitle}>
          Check in with your daily habits for more personal sleep guidance.
        </Text>

        <View style={[styles.hagosaurCard, compact && styles.hagosaurCardCompact]}>
          <View style={styles.hagosaurCopy}>
            <Text style={styles.hagosaurEyebrow}>HAGOSAUR WELLNESS GUIDE</Text>
            <Text style={[styles.hagosaurTitle, compact && styles.hagosaurTitleCompact]}>
              Small steps for a calmer night
            </Text>
            <Text style={styles.hagosaurText}>
              Tell Hagosaur about your day to receive supportive, personalized wellness actions.
            </Text>
          </View>
          <Image
            source={require('../../assets/sleeping-dinosaur.png')}
            style={[styles.hagosaurImage, compact && styles.hagosaurImageCompact]}
            resizeMode="contain"
            accessibilityLabel="Hagosaur, your sleep wellness guide"
          />
        </View>

        <AssessmentQuestionnaire
          key={todayDate}
          initialActivities={checkIn?.activities ?? []}
          initialOtherNote={checkIn?.otherActivityNote ?? ''}
          savedForToday={!!checkIn}
          onSave={handleSaveCheckIn}
        />

        <View style={styles.guidanceHeading}>
          <View style={styles.guidanceIcon}>
            <FontAwesome5 name="heart" size={12} color={colors.onAccent} solid />
          </View>
          <View style={styles.guidanceCopy}>
            <Text style={styles.guidanceEyebrow}>FROM HAGOSAUR</Text>
            <Text style={styles.guidanceTitle}>Your therapeutic wellness plan</Text>
          </View>
        </View>

        <RecommendationCard
          data={recommendations!}
          aiStatus={aiStatus}
          aiEnabled={modelStatus === 'ready' && today.severity !== 'danger'}
          aiError={aiError}
          onRetryAi={() => setAiRetryNonce((value) => value + 1)}
          personalizedActionsOnly
          guideName="Hagosaur"
          guideImage={require('../../assets/hagosaur-wellness-guide.png')}
        />

        {modelStatus !== 'ready' ? (
          <OnDeviceAiCard
            status={modelStatus}
            progress={modelProgress}
            error={modelError}
            onDownload={handleDownloadModel}
          />
        ) : null}

        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  pageColumn: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.accent,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  hagosaurCard: {
    minHeight: 150,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: colors.backgroundSoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingLeft: 18,
    marginBottom: 16,
  },
  hagosaurCardCompact: { minHeight: 138, paddingLeft: 14 },
  hagosaurCopy: { flex: 1, zIndex: 1, paddingVertical: 16 },
  hagosaurEyebrow: {
    color: colors.accentDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },
  hagosaurTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  hagosaurTitleCompact: { fontSize: 18, lineHeight: 22 },
  hagosaurText: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  hagosaurImage: { width: 190, height: 145, marginRight: -18 },
  hagosaurImageCompact: { width: 108, height: 112, marginRight: -10 },
  guidanceHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 10,
  },
  guidanceIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginRight: 10,
  },
  guidanceCopy: { flex: 1 },
  guidanceEyebrow: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  guidanceTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
});
