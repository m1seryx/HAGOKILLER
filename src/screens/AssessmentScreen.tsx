import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import { FontAwesome5 } from '@expo/vector-icons';
import { GlassCard } from '../components/GlassCard';
import { RecommendationCard } from '../components/RecommendationCard';
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
import { colors } from '../constants/theme';
import { DailyActivityCheckIn, DailyStats, MonthlyStats } from '../types';

export const AssessmentScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [today, setToday] = useState<DailyStats | null>(null);
  const [month, setMonth] = useState<MonthlyStats | null>(null);
  const [checkIn, setCheckIn] = useState<DailyActivityCheckIn | null>(null);
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

  if (loading || !today || !month) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading assessment…</Text>
      </SafeAreaView>
    );
  }

  const recommendations = getRecommendations(
    today,
    month,
    month.trend,
    checkIn,
    todayDate,
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Assessment</Text>
        <Text style={styles.subtitle}>
          Write what you did today. Keyword matching personalizes the tips below.
        </Text>

        <AssessmentQuestionnaire
          initialActivities={checkIn?.activities ?? []}
          initialOtherNote={checkIn?.otherActivityNote ?? ''}
          savedForToday={!!checkIn}
          onSave={handleSaveCheckIn}
        />

        <GlassCard style={styles.hintCard}>
          <View style={styles.hintRow}>
            <FontAwesome5 name="bell" size={14} color={colors.accentDark} style={{ marginRight: 10 }} />
            <Text style={styles.hintText}>
              A sleep tip notification is also scheduled daily at 8:00 AM, even if the app is closed.
            </Text>
          </View>
        </GlassCard>

        <RecommendationCard data={recommendations} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
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
  hintCard: { padding: 14, marginBottom: 16 },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start' },
  hintText: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
});
