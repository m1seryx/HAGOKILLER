import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
  loadActionFeedback,
  loadWellnessPlans,
  saveActionFeedback,
  saveDailyActivityCheckIn,
  saveWellnessPlan,
} from '../services/userStorage';
import { getRecommendations } from '../utils/recommendations';
import {
  downloadOnDeviceModel,
  getOnDeviceModelPreference,
  isOnDeviceAiSupported,
  isOnDeviceModelDownloaded,
  ON_DEVICE_MODEL_SPECS,
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
import type { ActionFeedbackRecord, ActionFeedbackValue } from '../types';
import type { OnDeviceModelTier } from '../types';
import { actionKey, actionsAreSimilar } from '../utils/wellnessKnowledge';
import { notifyPersonalizedPlanReady } from '../services/assessmentNotifications';

const assessmentAdviceCache = new Map<string, RecommendationData>();
const ASSESSMENT_PLAN_VERSION = 4;

const keepExistingWhenEqual = <T,>(current: T | null, next: T | null): T | null => (
  JSON.stringify(current) === JSON.stringify(next) ? current : next
);

const buildAssessmentInputKey = (
  daily: DailyStats,
  monthly: MonthlyStats,
  dailyCheckIn: DailyActivityCheckIn | null,
  guidanceMode: OnDeviceModelTier | 'offline',
): string => JSON.stringify({
  planVersion: ASSESSMENT_PLAN_VERSION,
  guidanceMode,
  daily,
  monthly,
  checkIn: dailyCheckIn
    ? {
        date: dailyCheckIn.date,
        activities: dailyCheckIn.activities,
        otherActivityNote: dailyCheckIn.otherActivityNote ?? null,
        sleepFeeling: dailyCheckIn.sleepFeeling ?? null,
        sleepHours: dailyCheckIn.sleepHours ?? null,
        mouthBreathing: dailyCheckIn.mouthBreathing ?? null,
      }
    : null,
});

export const AssessmentScreen = () => {
  const navigation = useNavigation<any>();
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
  const [modelTier, setModelTier] = useState<OnDeviceModelTier>('compact');
  const [feedbackRecords, setFeedbackRecords] = useState<ActionFeedbackRecord[]>([]);
  const [feedbackLoaded, setFeedbackLoaded] = useState(false);
  const feedbackRef = useRef<ActionFeedbackRecord[]>([]);
  const [regeneratingActionIndex, setRegeneratingActionIndex] = useState<number | null>(null);
  const [hydratedPlanKey, setHydratedPlanKey] = useState('');
  const hasLoadedOnce = useRef(false);
  const todayDate = moment().format('YYYY-MM-DD');

  const checkModelAvailability = useCallback(async (isActive: () => boolean) => {
    if (!isOnDeviceAiSupported()) {
      if (isActive()) setModelStatus('unsupported');
      return;
    }

    try {
      const tier = await getOnDeviceModelPreference();
      const downloaded = await isOnDeviceModelDownloaded(tier);
      if (!isActive()) return;
      setModelTier(tier);
      setModelError('');
      setModelStatus(downloaded ? 'ready' : 'missing');
    } catch {
      if (!isActive()) return;
      setModelStatus('error');
      setModelError('Could not check the phone storage. Use an installed development or preview build.');
    }
  }, []);

  const load = useCallback(async () => {
    const [events, savedCheckIn, savedFeedback] = await Promise.all([
      bleService.fetchSleepEvents(),
      loadDailyActivityCheckIn(todayDate),
      loadActionFeedback(),
    ]);
    const data = calculateDashboardData(events);
    setToday((current) => keepExistingWhenEqual(current, data.today));
    setMonth((current) => keepExistingWhenEqual(current, data.thisMonth));
    setCheckIn((current) => keepExistingWhenEqual(current, savedCheckIn));
    feedbackRef.current = savedFeedback;
    setFeedbackRecords(savedFeedback);
    setFeedbackLoaded(true);
  }, [todayDate]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce.current) setLoading(true);
      load()
        .catch(() => undefined)
        .finally(() => {
          hasLoadedOnce.current = true;
          setLoading(false);
        });
    }, [load]),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void checkModelAvailability(() => active);
      return () => { active = false; };
    }, [checkModelAvailability]),
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

  const guidanceMode: OnDeviceModelTier | 'offline' = modelStatus === 'ready' ? modelTier : 'offline';
  const assessmentInputKey = useMemo(
    () => (today && month ? buildAssessmentInputKey(today, month, checkIn, guidanceMode) : ''),
    [today, month, checkIn, guidanceMode],
  );

  useEffect(() => {
    if (!assessmentInputKey) return undefined;
    let active = true;
    setHydratedPlanKey('');
    loadWellnessPlans()
      .then((plans) => {
        if (!active) return;
        const saved = plans.find((plan) => plan.date === todayDate && plan.inputKey === assessmentInputKey);
        if (saved) {
          assessmentAdviceCache.set(assessmentInputKey, saved.recommendation);
          setAiRecommendation(saved.recommendation);
          setAiStatus('ready');
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setHydratedPlanKey(assessmentInputKey);
      });
    return () => { active = false; };
  }, [assessmentInputKey, todayDate]);

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
    if (!today || !month || !fallbackRecommendations || !feedbackLoaded) {
      setAiRecommendation(null);
      setAiStatus('idle');
      return undefined;
    }
    if (hydratedPlanKey !== assessmentInputKey) {
      setAiStatus('idle');
      return undefined;
    }

    const cachedAdvice = assessmentAdviceCache.get(assessmentInputKey);
    if (cachedAdvice) {
      setAiRecommendation(cachedAdvice);
      setAiStatus('ready');
      setAiError('');
      return undefined;
    }

    if (modelStatus !== 'ready' || today.severity === 'danger') {
      setAiRecommendation(null);
      setAiStatus('idle');
      return undefined;
    }

    let active = true;
    setAiRecommendation(null);
    setAiStatus('loading');
    setAiError('');
    requestOnDeviceAssessmentAdvice(today, month, checkIn, fallbackRecommendations, feedbackRef.current)
      .then((advice) => {
        if (active) {
          assessmentAdviceCache.set(assessmentInputKey, advice);
          setAiRecommendation(advice);
          setAiStatus('ready');
          if (advice.source === 'on_device') void notifyPersonalizedPlanReady();
        }
      })
      .catch((error) => {
        if (active) {
          const rawMessage = error instanceof Error ? error.message.trim() : '';
          const message = !rawMessage || /unknown|hostfunction/i.test(rawMessage)
            ? 'The local AI could not run on this phone. Safe offline actions are shown instead.'
            : rawMessage;
          setAiError(message.slice(0, 240));
          setAiStatus('error');
        }
      });
    return () => { active = false; };
  }, [today, month, checkIn, fallbackRecommendations, assessmentInputKey, hydratedPlanKey, feedbackLoaded, modelStatus, aiRetryNonce]);

  const retryAi = () => {
    assessmentAdviceCache.delete(assessmentInputKey);
    setAiRetryNonce((value) => value + 1);
  };

  const visibleRecommendation = aiRecommendation ?? fallbackRecommendations;

  const visibleActionFeedback = useMemo(() => {
    const result: Record<number, ActionFeedbackValue> = {};
    visibleRecommendation?.actionItems.forEach((action, index) => {
      const saved = feedbackRecords.find((record) => record.actionKey === actionKey(action));
      if (saved) result[index] = saved.feedback;
    });
    return result;
  }, [visibleRecommendation, feedbackRecords]);

  const handleActionFeedback = async (index: number, feedback: ActionFeedbackValue) => {
    const action = visibleRecommendation?.actionItems[index];
    if (!action) return;
    const record: ActionFeedbackRecord = {
      actionKey: actionKey(action),
      actionText: action,
      feedback,
      planDate: todayDate,
      updatedAt: Date.now(),
    };
    await saveActionFeedback(record);
    setFeedbackRecords((current) => [record, ...current.filter((item) => item.actionKey !== record.actionKey)]);
    feedbackRef.current = [record, ...feedbackRef.current.filter((item) => item.actionKey !== record.actionKey)];
  };

  const regenerateOneAction = async (index: number) => {
    if (!today || !month || !fallbackRecommendations || !visibleRecommendation || regeneratingActionIndex !== null) return;
    const previousAction = visibleRecommendation.actionItems[index];
    if (!previousAction) return;
    setRegeneratingActionIndex(index);
    const negativeRecord: ActionFeedbackRecord = {
      actionKey: actionKey(previousAction), actionText: previousAction, feedback: 'not_helpful', planDate: todayDate, updatedAt: Date.now(),
    };
    try {
      await saveActionFeedback(negativeRecord);
      const memory = [negativeRecord, ...feedbackRef.current.filter((item) => item.actionKey !== negativeRecord.actionKey)];
      feedbackRef.current = memory;
      setFeedbackRecords(memory);
      const replacementPlan = await requestOnDeviceAssessmentAdvice(today, month, checkIn, fallbackRecommendations, memory);
      const replacementIndex = replacementPlan.actionItems.findIndex((candidate) => (
        !actionsAreSimilar(candidate, previousAction)
        && !visibleRecommendation.actionItems.some((existing, existingIndex) => existingIndex !== index && actionsAreSimilar(candidate, existing))
      ));
      if (replacementIndex < 0) return;
      const actionItems = [...visibleRecommendation.actionItems];
      const actionExplanations = [...(visibleRecommendation.actionExplanations ?? [])];
      actionItems[index] = replacementPlan.actionItems[replacementIndex];
      actionExplanations[index] = replacementPlan.actionExplanations?.[replacementIndex] ?? 'Suggested from your current sleep and check-in data.';
      const updated = { ...visibleRecommendation, actionItems, actionExplanations };
      assessmentAdviceCache.set(assessmentInputKey, updated);
      setAiRecommendation(updated);
    } finally {
      setRegeneratingActionIndex(null);
    }
  };

  useEffect(() => {
    if (!visibleRecommendation || !assessmentInputKey || !today || hydratedPlanKey !== assessmentInputKey) return;
    const waitingForAi = modelStatus === 'ready'
      && today.severity !== 'danger'
      && aiStatus === 'loading';
    if (waitingForAi) return;
    void saveWellnessPlan({
      date: todayDate,
      inputKey: assessmentInputKey,
      createdAt: Date.now(),
      recommendation: visibleRecommendation,
    }).catch(() => undefined);
  }, [visibleRecommendation, assessmentInputKey, hydratedPlanKey, today, todayDate, modelStatus, aiStatus]);

  if (loading || !today || !month) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading assessment…</Text>
      </SafeAreaView>
    );
  }

  const recommendations = visibleRecommendation;

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
          onRetryAi={retryAi}
          personalizedActionsOnly
          guideName="Hagosaur"
          guideImage={require('../../assets/hagosaur-wellness-guide.png')}
          actionFeedback={visibleActionFeedback}
          onActionFeedback={handleActionFeedback}
          onRegenerateAction={regenerateOneAction}
          regeneratingActionIndex={regeneratingActionIndex}
        />

        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => navigation.navigate('WellnessPlanHistory')}
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel="Open wellness plan history"
        >
          <View style={styles.historyIcon}>
            <FontAwesome5 name="history" size={14} color={colors.accent} />
          </View>
          <View style={styles.historyCopy}>
            <Text style={styles.historyTitle}>Plan history</Text>
            <Text style={styles.historyText}>Review your saved daily wellness plans</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={12} color={colors.textMuted} />
        </TouchableOpacity>

        {modelStatus !== 'ready' ? (
          <OnDeviceAiCard
            status={modelStatus}
            progress={modelProgress}
            error={modelError}
            onDownload={handleDownloadModel}
            modelSizeMb={ON_DEVICE_MODEL_SPECS[modelTier].sizeMb}
            modelLabel={ON_DEVICE_MODEL_SPECS[modelTier].label}
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
  historyButton: {
    flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 16,
    borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  historyIcon: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.backgroundSoft, marginRight: 11,
  },
  historyCopy: { flex: 1 },
  historyTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  historyText: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
});
