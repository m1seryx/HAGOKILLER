import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import moment from 'moment';
import { ActionFeedbackRecord, DailyActivityCheckIn, DashboardData, DailyStats, MonthlyStats, RecommendationData, UserProfile } from '../types';
import {
  calculateDailyStats,
  calculateMonthlyStats,
  calculateTrend,
  calculateDailySeverity,
} from '../utils/statsCalculator';
import { getSeverityColor, getSeverityLabel, getMoodStatus } from '../utils/recommendations';
import { StatsCard } from '../components/StatsCard';
import { SnorePatternsChart } from '../components/SnorePatternsChart';
import { StatsFilter, TimePeriod, DateRange } from '../components/StatsFilter';
import { GlassCard } from '../components/GlassCard';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { calculateDashboardData } from '../services/mockBLEService';
import { bleService } from '../services/bleService';
import { scheduleDailyAdviceNotifications } from '../services/dailyAdviceNotifications';
import { useDevice } from '../context/DeviceContext';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { loadActionFeedback, loadDailyActivityCheckIns } from '../services/userStorage';
import { analyzeInterventionOutcomes, buildWeeklyRecap, calculateHabitCorrelations } from '../utils/wellnessAnalytics';
import { isOnDeviceModelDownloaded, requestOnDeviceAssessmentAdvice } from '../services/onDeviceAssessment';

interface DashboardScreenProps {
  userName: string;
  userProfile?: UserProfile;
}

const HAGOSAUR_MOOD_ART = {
  normal: require('../../assets/hagosaur-mood-happy.png'),
  bad: require('../../assets/hagosaur-mood-uneasy.png'),
  danger: require('../../assets/hagosaur-mood-unhappy.png'),
} as const;

const HAGOSAUR_CONNECTION_ART = {
  connected: require('../../assets/hagosaur-pillow-connected.png'),
  disconnected: require('../../assets/hagosaur-pillow-disconnected.png'),
} as const;

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ userName, userProfile }) => {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TimePeriod>('week');
  const [monthHistory, setMonthHistory] = useState<MonthlyStats[]>([]);
  const [checkIns, setCheckIns] = useState<DailyActivityCheckIn[]>([]);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedbackRecord[]>([]);
  const [weeklyAiGoals, setWeeklyAiGoals] = useState<string[] | null>(null);
  const [weeklyAiStatus, setWeeklyAiStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const weeklyAiKeyRef = useRef('');
  const [deviceStatus, setDeviceStatus] = useState({
    connected: false,
    mode: 'Connecting…',
    signal: '—',
    battery: 0,
    pairingStatus: 'Pending',
    lastSeen: '—',
  });
  const [dateRange, setDateRange] = useState<DateRange>({
    from: moment().subtract(7, 'days').format('YYYY-MM-DD'),
    to: moment().format('YYYY-MM-DD'),
  });

  const { connected, pairedDevice } = useDevice();

  useEffect(() => {
    loadData();
    return bleService.subscribeEvents((event) => {
      setDashboardData((current) =>
        calculateDashboardData([event, ...(current?.allData ?? [])]),
      );
    });
  }, []);

  const loadData = async (showFullScreenLoader = true) => {
    try {
      if (showFullScreenLoader) setLoading(true);
      await bleService.restoreSession();
      if (bleService.isPaired() && !bleService.getIsConnected()) {
        try {
          await bleService.connect();
        } catch (_) {
          // Keep last synced data if reconnect fails
        }
      }
      const [events, savedCheckIns, savedFeedback] = await Promise.all([
        bleService.fetchSleepEvents(),
        loadDailyActivityCheckIns(),
        loadActionFeedback(),
      ]);
      const data = calculateDashboardData(events);
      setDashboardData(data);
      setCheckIns(savedCheckIns);
      setActionFeedback(savedFeedback);

      const now = moment();
      const months: MonthlyStats[] = [];
      for (let i = 2; i >= 0; i--) {
        const monthStr = now.clone().subtract(i, 'months').format('YYYY-MM');
        months.push(calculateMonthlyStats(events, monthStr));
      }
      if (months.length >= 2) {
        months[months.length - 1].trend = calculateTrend(months.slice(-2));
        months[months.length - 2].trend =
          months.length >= 3 ? calculateTrend(months.slice(0, 2)) : 'stable';
      }
      setMonthHistory(months);
      const device = bleService.getPairedDevice();
      setDeviceStatus({
        connected: bleService.getIsConnected(),
        mode: bleService.getIsConnected() ? 'Monitoring' : 'Offline',
        signal: device ? `${device.signalStrength} dBm` : '—',
        battery: 82,
        pairingStatus: device ? 'Aligned' : 'Not paired',
        lastSeen: bleService.getIsConnected() ? 'just now' : 'offline',
      });
    } catch (error) {
      console.error('Error loading data:', error);
      setDashboardData(null);
      setDeviceStatus((current) => ({
        ...current,
        connected: false,
        mode: 'Offline',
        pairingStatus: 'Disconnected',
        lastSeen: 'unavailable',
      }));
    } finally {
      if (showFullScreenLoader) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadData(false),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!dashboardData) return;
    const severity = dashboardData.today.severity;
    const trendValue = dashboardData.thisMonth.trend;
    scheduleDailyAdviceNotifications(severity, trendValue).catch(() => undefined);
  }, [dashboardData?.today.severity, dashboardData?.thisMonth.trend]);

  useEffect(() => {
    if (!dashboardData) return;
    const sevenDaysAgo = moment().subtract(6, 'days').startOf('day');
    const weeklyEvents = dashboardData.allData.filter((event) => moment(event.timestamp).isSameOrAfter(sevenDaysAgo));
    const key = `${weeklyEvents.length}:${weeklyEvents[0]?.timestamp ?? 0}:${checkIns[0]?.updatedAt ?? 0}`;
    if (weeklyAiKeyRef.current === key) return;
    weeklyAiKeyRef.current = key;
    let active = true;
    const generateWeeklyCoach = async () => {
      if (!(await isOnDeviceModelDownloaded())) return;
      setWeeklyAiStatus('loading');
      const recap = buildWeeklyRecap(dashboardData.allData);
      const counts = new Map<string, number>();
      checkIns.filter((item) => moment(item.date).isSameOrAfter(sevenDaysAgo, 'day')).forEach((item) => {
        item.activities.forEach((activity) => counts.set(activity, (counts.get(activity) ?? 0) + 1));
      });
      const activities = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([activity]) => activity) as DailyActivityCheckIn['activities'];
      const total = weeklyEvents.length;
      const weeklyStats: DailyStats = {
        date: moment().format('YYYY-MM-DD'),
        totalSnoreEvents: total,
        averageDuration: total ? Math.round(weeklyEvents.reduce((sum, event) => sum + event.duration, 0) / total) : 0,
        interventionCount: weeklyEvents.filter((event) => event.interventionTriggered).length,
        peakHour: dashboardData.today.peakHour,
        severity: dashboardData.thisMonth.severity,
      };
      const fallback: RecommendationData = {
        severityLevel: weeklyStats.severity,
        recommendation: recap.message,
        actionItems: recap.goals,
        trendMessage: 'Weekly coaching based on the latest seven days.',
        source: 'rules',
        recommendationReasons: [`${total} snoring events were recorded during the latest seven days.`],
      };
      const plan = await requestOnDeviceAssessmentAdvice(
        weeklyStats,
        dashboardData.thisMonth,
        {
          date: weeklyStats.date,
          activities,
          otherActivityNote: 'Create three realistic weekly goals while keeping the daily wellness plan unchanged.',
          updatedAt: Date.now(),
        },
        fallback,
        actionFeedback,
      );
      if (!active) return;
      if (plan.source === 'on_device') {
        setWeeklyAiGoals(plan.actionItems.slice(0, 3));
        setWeeklyAiStatus('ready');
      } else {
        setWeeklyAiStatus('idle');
      }
    };
    void generateWeeklyCoach().catch(() => { if (active) setWeeklyAiStatus('idle'); });
    return () => { active = false; };
  }, [dashboardData, checkIns, actionFeedback]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <View style={styles.centerContent}>
          <Image
            source={require('../../assets/sleeping-dinosaur.png')}
            style={styles.loadingHagosaur}
            resizeMode="contain"
          />
          <Text style={styles.loadingTitle}>Hagosaur is checking your pillow</Text>
          <Text style={styles.loadingText}>Syncing your latest sleep data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dashboardData) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <View style={styles.centerContent}>
          <FontAwesome5 name="unlink" size={32} color="#ef4444" style={{ marginBottom: 16 }} />
          <Text style={styles.errorText}>Could not connect to your smart pillow</Text>
          <Text style={styles.errorHint}>Check that Bluetooth is on and your pillow is powered.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadData()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const aggregateWeekStats = (): DailyStats => {
    const week = dashboardData.thisWeek;
    const totalSnoreEvents = week.reduce((s, d) => s + d.totalSnoreEvents, 0);
    const weightedDuration = week.reduce((s, d) => s + d.averageDuration * d.totalSnoreEvents, 0);
    const averageDuration =
      totalSnoreEvents > 0 ? Math.round(weightedDuration / totalSnoreEvents) : 0;
    const interventionCount = week.reduce((s, d) => s + d.interventionCount, 0);
    const peakDay = week.reduce(
      (best, d) => (d.totalSnoreEvents > best.totalSnoreEvents ? d : best),
      week[0],
    );
    const avgDailyEvents = totalSnoreEvents / Math.max(week.length, 1);

    return {
      date: moment().format('YYYY-MM-DD'),
      totalSnoreEvents,
      averageDuration,
      interventionCount,
      peakHour: peakDay?.peakHour ?? 0,
      severity: calculateDailySeverity(avgDailyEvents, averageDuration),
    };
  };

  const getRangeStats = (): DailyStats => {
    const from = moment(dateRange.from);
    const to = moment(dateRange.to);
    const rangeEvents = dashboardData.allData.filter((e) => {
      const d = moment(e.timestamp);
      return d.isSameOrAfter(from, 'day') && d.isSameOrBefore(to, 'day');
    });
    const totalSnoreEvents = rangeEvents.length;
    const averageDuration =
      totalSnoreEvents > 0
        ? Math.round(rangeEvents.reduce((s, e) => s + e.duration, 0) / totalSnoreEvents)
        : 0;
    const interventionCount = rangeEvents.filter((e) => e.interventionTriggered).length;
    const peakHour =
      rangeEvents.length > 0
        ? rangeEvents.reduce((best, e) => {
            const hour = moment(e.timestamp).hour();
            const hourCount = rangeEvents.filter((ev) => moment(ev.timestamp).hour() === hour).length;
            const bestCount = rangeEvents.filter((ev) => moment(ev.timestamp).hour() === best).length;
            return hourCount > bestCount ? hour : best;
          }, moment(rangeEvents[0].timestamp).hour())
        : 0;
    const avgDailyEvents = totalSnoreEvents / Math.max(to.diff(from, 'days') + 1, 1);
    return {
      date: dateRange.to,
      totalSnoreEvents,
      averageDuration,
      interventionCount,
      peakHour,
      severity: calculateDailySeverity(avgDailyEvents, averageDuration),
    };
  };

  const getDisplayStats = (): {
    stats: DailyStats;
    trend: 'improving' | 'stable' | 'worsening';
  } => {
    switch (activeFilter) {
      case 'today':
        return { stats: dashboardData.today, trend: 'stable' };
      case 'week':
        return {
          stats: aggregateWeekStats(),
          trend: calculateTrend(
            monthHistory.length >= 2 ? monthHistory.slice(-2) : [monthHistory[0]],
          ),
        };
      case 'month':
        return {
          stats: {
            date: moment().format('YYYY-MM-DD'),
            totalSnoreEvents: dashboardData.thisMonth.totalSnoreEvents,
            averageDuration: dashboardData.thisMonth.averageDuration,
            interventionCount: dashboardData.thisMonth.interventionCount,
            peakHour: dashboardData.today.peakHour,
            severity: dashboardData.thisMonth.severity,
          },
          trend: dashboardData.thisMonth.trend,
        };
      case 'range':
        return {
          stats: getRangeStats(),
          trend: calculateTrend(
            monthHistory.length >= 2 ? monthHistory.slice(-2) : [monthHistory[0]],
          ),
        };
    }
  };

  const getChartData = (): { data: DailyStats[]; title: string } => {
    switch (activeFilter) {
      case 'today':
        return { data: [dashboardData.today], title: "Today's Events" };
      case 'week':
        return { data: dashboardData.thisWeek, title: '7-Day Trend' };
      case 'month': {
        const now = moment();
        const monthDays: DailyStats[] = [];
        for (let i = 29; i >= 0; i--) {
          const date = now.clone().subtract(i, 'days').format('YYYY-MM-DD');
          monthDays.push(calculateDailyStats(dashboardData.allData, date));
        }
        return {
          data: monthDays.filter((_, i) => i % 5 === 0 || i === 29),
          title: '30-Day Overview',
        };
      }
      case 'range': {
        const from = moment(dateRange.from);
        const to = moment(dateRange.to);
        const days: DailyStats[] = [];
        const cur = from.clone();
        while (cur.isSameOrBefore(to, 'day')) {
          days.push(calculateDailyStats(dashboardData.allData, cur.format('YYYY-MM-DD')));
          cur.add(1, 'day');
        }
        const step = Math.max(1, Math.floor(days.length / 7));
        return {
          data: days.filter((_, i) => i % step === 0 || i === days.length - 1),
          title: `Custom: ${dateRange.from} to ${dateRange.to}`,
        };
      }
    }
  };

  const { stats, trend } = getDisplayStats();
  const { data: chartData, title: chartTitle } = getChartData();
  const severityColor = getSeverityColor(stats.severity);
  const mood = getMoodStatus(stats.severity);
  const interventionOutcomes = analyzeInterventionOutcomes(dashboardData.allData);
  const successfulInterventions = interventionOutcomes.filter((outcome) => outcome.appearedEffective).length;
  const interventionSuccessRatio = interventionOutcomes.length > 0
    ? successfulInterventions / interventionOutcomes.length
    : 0;
  const interventionTrend = interventionSuccessRatio >= 0.6
    ? 'improving'
    : interventionSuccessRatio <= 0.25 ? 'worsening' : 'stable';
  const weeklyRecap = buildWeeklyRecap(dashboardData.allData);
  const habitCorrelations = calculateHabitCorrelations(checkIns, dashboardData.allData);
  const latestMonth = monthHistory[monthHistory.length - 1];
  const previousMonth = monthHistory[monthHistory.length - 2];
  const monthlyEventChange =
    latestMonth && previousMonth
      ? latestMonth.totalSnoreEvents - previousMonth.totalSnoreEvents
      : null;
  const monthlyCoachMessage =
    monthlyEventChange === null
      ? 'Hagosaur will compare your progress when another month of data is available.'
      : monthlyEventChange < 0
        ? `Your snoring events decreased by ${Math.abs(monthlyEventChange)} this month compared with last month. Keep it up!`
        : monthlyEventChange > 0
          ? `Your snoring events increased by ${monthlyEventChange} this month. Take it easy tonight—slow down, relax, and protect your bedtime routine.`
          : 'Your snoring events are steady compared with last month. Keep building your bedtime routine!';
  const monthlyCoachTone =
    monthlyEventChange !== null && monthlyEventChange > 0
      ? { background: '#fff7ed', border: '#fed7aa', accent: '#ea580c' }
      : monthlyEventChange === 0
        ? { background: '#eff6ff', border: '#bfdbfe', accent: '#0284c7' }
        : { background: '#ecfdf5', border: '#a7f3d0', accent: '#059669' };
  const lowBattery = deviceStatus.battery <= 20;
  const activeAlerts = [
    connected && lowBattery ? 'Low battery detected' : null,
    stats.severity === 'danger' ? 'Elevated snoring risk detected' : null,
  ].filter(Boolean) as string[];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={['transparent']}
            progressBackgroundColor="transparent"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageColumn}>
        {refreshing ? (
          <View style={styles.refreshHagosaurRow}>
            <Image
              source={require('../../assets/sleeping-dinosaur.png')}
              style={styles.refreshHagosaur}
              resizeMode="contain"
            />
            <View style={styles.refreshCopy}>
              <Text style={styles.refreshTitle}>Hagokiller is refreshing</Text>
              <Text style={styles.refreshText}>Checking the latest pillow readings...</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerContent}>
              <Text style={styles.brand}>HAGOKILLER</Text>
              <Text style={styles.greeting}>Hello, {userName}</Text>
              <Text style={styles.headerSubtitle}>{moment().format('dddd, MMMM D, YYYY')}</Text>
            </View>
            <View style={styles.profileButton}>
              <ProfileAvatar
                name={userName}
                photoUri={userProfile?.photoUri}
                size={48}
                radius={14}
              />
            </View>
          </View>

          <View style={[styles.headerGlass, compact && styles.headerGlassCompact]}>
            <Image
              source={HAGOSAUR_MOOD_ART[stats.severity]}
              style={[styles.snapshotHagosaur, compact && styles.snapshotHagosaurCompact]}
              resizeMode="contain"
              accessibilityLabel={`Hagosaur feeling ${mood.label.toLowerCase()}`}
            />
            <View style={styles.overviewCopy}>
              <Text style={styles.overviewEyebrow}>YOUR SLEEP SNAPSHOT</Text>
              <Text style={[styles.moodLabel, { color: mood.color }]}>{mood.label}</Text>
              <Text style={styles.moodCaption}>{mood.caption}</Text>
              <View style={styles.connectionRow}>
                <View style={[styles.liveDot, { backgroundColor: connected ? '#10b981' : '#f59e0b' }]} />
                <Text style={styles.connectionText} numberOfLines={1}>
                  {connected
                    ? `${pairedDevice?.name || 'Smart pillow'} connected`
                    : pairedDevice
                      ? 'Smart pillow offline'
                      : 'No smart pillow paired'}
                </Text>
                <Text style={[styles.severityTextInline, { color: severityColor }]}>
                  {getSeverityLabel(stats.severity)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <GlassCard
          style={[
            styles.connectionBanner,
            connected ? styles.connectionBannerOnline : styles.connectionBannerOffline,
          ]}
        >
          <Image
            source={connected ? HAGOSAUR_CONNECTION_ART.connected : HAGOSAUR_CONNECTION_ART.disconnected}
            style={styles.connectionHagosaur}
            resizeMode="contain"
            accessibilityLabel={connected
              ? 'Hagosaur showing a connected smart pillow cable'
              : 'Hagosaur preparing to connect the smart pillow cable'}
          />
          <View style={styles.connectionBannerCopy}>
            <Text style={styles.connectionEyebrow}>HAGOSAUR CONNECTION CHECK</Text>
            <Text style={styles.connectionTitle}>
              {connected
                ? 'Smart pillow connected'
                : pairedDevice
                  ? 'Reconnect your smart pillow'
                  : 'Connect your smart pillow'}
            </Text>
            <Text style={styles.connectionCaption}>
              {connected
                ? 'The cord is connected and Hagosaur is ready to monitor your sleep.'
                : pairedDevice
                  ? 'Your pillow is paired but currently offline. Reconnect it in Settings.'
                  : 'Pair your pillow in Settings so Hagosaur can begin tracking tonight.'}
            </Text>
            <View style={styles.connectionStateRow}>
              <FontAwesome5
                name={connected ? 'link' : 'unlink'}
                size={10}
                color={connected ? '#047857' : '#b45309'}
              />
              <Text style={[
                styles.connectionStateText,
                { color: connected ? '#047857' : '#b45309' },
              ]}>
                {connected ? 'CONNECTED' : pairedDevice ? 'OFFLINE' : 'NOT PAIRED'}
              </Text>
            </View>
          </View>
        </GlassCard>

        {activeAlerts.length > 0 ? (
          <GlassCard style={styles.alertBanner}>
            <View style={styles.alertRow}>
              <FontAwesome5
                name="exclamation-triangle"
                size={15}
                color="#fbbf24"
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>System Alert</Text>
                <Text style={styles.alertText}>{activeAlerts.join(' • ')}</Text>
              </View>
            </View>
          </GlassCard>
        ) : null}

        <View style={styles.sectionPadding}>
          <StatsFilter
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            dateRange={dateRange}
            onRangeChange={setDateRange}
          />
        </View>

        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Key sleep metrics</Text>
          <Text style={styles.sectionHint}>{activeFilter === 'week' ? 'Last 7 days' : chartTitle}</Text>
        </View>

        <View style={styles.metricsSection}>
          <StatsCard
            label="Snoring Events"
            value={stats.totalSnoreEvents}
            icon="volume-up"
            severity={stats.severity}
          />
          <StatsCard
            label="Avg. Duration"
            value={stats.averageDuration}
            icon="clock"
            unit=" sec"
          />
          <StatsCard label="Interventions" value={stats.interventionCount} icon="wind" />
          <StatsCard
            label="Peak Hour"
            value={moment(stats.peakHour, 'H').format('hA')}
            icon="moon"
          />
          <StatsCard
            label="Intervention Success"
            value={`${Math.round(interventionSuccessRatio * 100)}%`}
            icon="check-double"
            severity={
              interventionTrend === 'improving'
                ? 'normal'
                : interventionTrend === 'worsening'
                  ? 'danger'
                  : 'bad'
            }
            style={styles.successMetric}
          />
        </View>

        <View style={styles.sectionPadding}>
          <SnorePatternsChart weeklyData={chartData} chartType="line" title={chartTitle} />
        </View>

        <View style={styles.insightSection}>
          <Text style={styles.insightSectionLabel}>Your weekly Hagosaur recap</Text>
          <View style={[styles.weeklyRecapCard, weeklyRecap.trend === 'worsening' && styles.weeklyRecapCardWatch]}>
            <Image
              source={weeklyRecap.trend === 'worsening'
                ? require('../../assets/hagosaur-monthly-increasing.png')
                : require('../../assets/hagosaur-monthly-progress.png')}
              style={styles.weeklyRecapArt}
              resizeMode="contain"
              accessibilityLabel={weeklyRecap.trend === 'worsening' ? 'Hagosaur asking you to take it easy' : 'Hagosaur celebrating weekly progress'}
            />
            <View style={styles.weeklyRecapCopy}>
              <Text style={styles.weeklyRecapEyebrow}>
                {weeklyRecap.trend === 'improving' ? 'A CALMER WEEK' : weeklyRecap.trend === 'worsening' ? 'LET’S SLOW DOWN' : 'STEADY PROGRESS'}
              </Text>
              <Text style={styles.weeklyRecapText}>{weeklyRecap.message}</Text>
              <View style={styles.weeklyCountRow}>
                <Text style={styles.weeklyCount}>{weeklyRecap.currentEvents}</Text>
                <Text style={styles.weeklyCountLabel}> events this week</Text>
              </View>
            </View>
          </View>
          <View style={styles.goalCard}>
            <Text style={styles.goalTitle}>Three goals for this week</Text>
            <Text style={styles.weeklyAiLabel}>
              {weeklyAiStatus === 'loading'
                ? 'HAGOSAUR IS PERSONALIZING…'
                : weeklyAiStatus === 'ready' ? 'PRIVATE AI COACHING' : 'SAFE WEEKLY COACHING'}
            </Text>
            {(weeklyAiGoals ?? weeklyRecap.goals).map((goal, index) => (
              <View key={goal} style={styles.goalRow}>
                <View style={styles.goalNumber}><Text style={styles.goalNumberText}>{index + 1}</Text></View>
                <Text style={styles.goalText}>{goal}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.insightSection}>
          <Text style={styles.insightSectionLabel}>Habit correlation</Text>
          <View style={styles.habitCard}>
            {habitCorrelations.length > 0 ? habitCorrelations.slice(0, 3).map((correlation) => (
              <View key={correlation.activity} style={styles.habitRow}>
                <View style={[styles.habitIcon, correlation.direction === 'more' ? styles.habitIconWatch : styles.habitIconGood]}>
                  <FontAwesome5 name={correlation.direction === 'more' ? 'arrow-up' : correlation.direction === 'fewer' ? 'arrow-down' : 'minus'} size={10} color={correlation.direction === 'more' ? '#ef4444' : '#059669'} />
                </View>
                <View style={styles.habitCopy}>
                  <Text style={styles.habitTitle}>{correlation.label}</Text>
                  <Text style={styles.habitText}>{correlation.message}</Text>
                  <Text style={styles.habitSamples}>{correlation.sampleCount} matching check-ins · {correlation.baselineCount} comparison nights</Text>
                </View>
              </View>
            )) : (
              <View style={styles.habitEmpty}>
                <FontAwesome5 name="chart-pie" size={18} color={colors.accent} />
                <View style={styles.habitEmptyCopy}>
                  <Text style={styles.habitTitle}>Keep checking in</Text>
                  <Text style={styles.habitText}>
                    Hagosaur waits for at least 3 nights with a habit and 3 comparison nights before showing a pattern. You have {checkIns.length} saved check-in{checkIns.length === 1 ? '' : 's'}.
                  </Text>
                </View>
              </View>
            )}
            <Text style={styles.habitDisclaimer}>Patterns show association, not medical cause.</Text>
          </View>
        </View>

        <View style={styles.trendSection}>
          <Text style={styles.trendLabel}>Monthly progress</Text>
          <GlassCard style={styles.trendCard}>
            <View
              style={[
                styles.trendSummary,
                {
                  backgroundColor:
                    trend === 'improving'
                      ? '#10b98120'
                      : trend === 'worsening'
                        ? '#ef444420'
                        : '#f59e0b20',
                },
              ]}
            >
              <FontAwesome5
                name={
                  trend === 'improving'
                    ? 'chart-line'
                    : trend === 'worsening'
                      ? 'exclamation-triangle'
                      : 'minus'
                }
                size={12}
                color={
                  trend === 'improving'
                    ? '#10b981'
                    : trend === 'worsening'
                      ? '#ef4444'
                      : '#f59e0b'
                }
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.trendSummaryText,
                  {
                    color:
                      trend === 'improving'
                        ? '#10b981'
                        : trend === 'worsening'
                          ? '#ef4444'
                          : '#f59e0b',
                  },
                ]}
              >
                {trend === 'improving'
                  ? 'Improving'
                  : trend === 'worsening'
                    ? 'Worsening'
                    : 'Stable'}
              </Text>
            </View>
            <View
              style={[
                styles.progressCoachCard,
                {
                  backgroundColor: monthlyCoachTone.background,
                  borderColor: monthlyCoachTone.border,
                },
              ]}
            >
              <Image
                source={
                  monthlyEventChange !== null && monthlyEventChange > 0
                    ? require('../../assets/hagosaur-monthly-increasing.png')
                    : require('../../assets/hagosaur-monthly-progress.png')
                }
                style={styles.progressCoachArt}
                resizeMode="contain"
              />
              <View style={styles.progressCoachCopy}>
                <Text style={[styles.progressCoachEyebrow, { color: monthlyCoachTone.accent }]}>HAGOSAUR SAYS</Text>
                <Text style={styles.progressCoachText}>{monthlyCoachMessage}</Text>
              </View>
            </View>
            {monthHistory.map((m, index) => {
              const mColor = getSeverityColor(m.severity);
              const prev = index > 0 ? monthHistory[index - 1] : null;
              const change = prev ? m.totalSnoreEvents - prev.totalSnoreEvents : 0;
              return (
                <View key={m.month} style={styles.monthRow}>
                  <View style={[styles.monthMarker, { borderColor: `${mColor}55` }]}>
                    <Text style={[styles.monthMarkerText, { color: mColor }]}>{index + 1}</Text>
                  </View>
                  <View style={styles.monthLeft}>
                    <Text style={styles.monthName}>{moment(m.month, 'YYYY-MM').format('MMMM YYYY')}</Text>
                    <View style={styles.monthSeverityBadge}>
                      <View style={[styles.monthDot, { backgroundColor: mColor }]} />
                      <Text style={[styles.monthSeverityText, { color: mColor }]}>
                        {m.severity.charAt(0).toUpperCase() + m.severity.slice(1)}
                      </Text>
                    </View>
                    <View style={styles.monthProgressTrack}>
                      <View
                        style={[
                          styles.monthProgressFill,
                          {
                            backgroundColor: mColor,
                            width: `${Math.max(
                              8,
                              Math.round(
                                (m.totalSnoreEvents /
                                  Math.max(1, ...monthHistory.map((entry) => entry.totalSnoreEvents))) *
                                  100,
                              ),
                            )}%` as `${number}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.monthRight}>
                    <Text style={styles.monthEvents}>{m.totalSnoreEvents} events</Text>
                    {prev ? (
                      <View style={styles.monthChange}>
                        <FontAwesome5
                          name={change < 0 ? 'arrow-down' : change > 0 ? 'arrow-up' : 'minus'}
                          size={10}
                          color={change < 0 ? '#10b981' : change > 0 ? '#ef4444' : '#f59e0b'}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.monthChangeText,
                            {
                              color:
                                change < 0 ? '#10b981' : change > 0 ? '#ef4444' : '#f59e0b',
                            },
                          ]}
                        >
                          {Math.abs(change)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </GlassCard>
        </View>

        <View style={styles.footerContainer}>
          <FontAwesome5 name="sync" size={10} color="#6b7280" style={{ marginRight: 6 }} />
          <Text style={styles.footerText}>
            System synced:{' '}
            {dashboardData.allData[0]?.timestamp
              ? moment(dashboardData.allData[0].timestamp).fromNow()
              : '—'}
          </Text>
        </View>

        <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 24 },
  pageColumn: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: { alignItems: 'center' },
  loadingHagosaur: { width: 210, height: 170, marginBottom: 4 },
  loadingTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  loadingText: {
    fontSize: 14,
    color: '#0ea5e9',
    marginTop: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  refreshHagosaurRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshHagosaur: { width: 66, height: 52, marginRight: 10 },
  refreshCopy: { flex: 1 },
  refreshTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 2 },
  refreshText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 13,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  header: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16 },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerGlassCompact: { paddingHorizontal: 14, paddingVertical: 14 },
  headerContent: { flex: 1, paddingRight: 12 },
  brand: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 3,
  },
  greeting: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 3 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusLabel: { fontSize: 13, color: colors.textMuted },
  statusValue: { fontSize: 13, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, lineHeight: 18, color: colors.textMuted },
  profileButton: { alignItems: 'center', justifyContent: 'center' },
  overviewCopy: { flex: 1, minWidth: 0 },
  snapshotHagosaur: {
    width: 104,
    height: 88,
    marginLeft: -8,
    marginRight: 10,
  },
  snapshotHagosaurCompact: {
    width: 82,
    height: 76,
    marginLeft: -10,
    marginRight: 6,
  },
  overviewEyebrow: {
    color: colors.accentDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 3,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  connectionText: { flex: 1, color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  severityTextInline: { fontSize: 11, fontWeight: '800', marginLeft: 8 },

  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  connectionBannerOnline: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  connectionBannerOffline: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  connectionHagosaur: {
    width: 88,
    height: 82,
    marginLeft: -8,
    marginRight: 8,
  },
  connectionBannerCopy: { flex: 1, minWidth: 0 },
  connectionEyebrow: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  connectionTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  connectionCaption: { color: colors.textSecondary, fontSize: 11, lineHeight: 15 },
  connectionStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
  },
  connectionStateText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },

  alertBanner: { marginHorizontal: 16, marginBottom: 16, padding: 14, backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start' },
  alertTitle: { fontSize: 12, fontWeight: '700', color: '#b45309', marginBottom: 2 },
  alertText: { fontSize: 12, color: '#92400e', lineHeight: 18 },

  sectionPadding: { paddingHorizontal: 16, marginBottom: 12 },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 12,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionHint: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  moodSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  moodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  moodIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  moodCopy: { flex: 1 },
  moodLabel: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  moodCaption: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  moodMeta: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  metricsSection: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  successMetric: { width: '100%' },
  insightSection: { marginHorizontal: 16, marginBottom: 18 },
  insightSectionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  weeklyRecapCard: { minHeight: 142, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', padding: 10, borderRadius: 18, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  weeklyRecapCardWatch: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  weeklyRecapArt: { width: 118, height: 126, marginLeft: -6, marginRight: 6 },
  weeklyRecapCopy: { flex: 1, paddingRight: 6 },
  weeklyRecapEyebrow: { color: '#047857', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  weeklyRecapText: { color: '#24475b', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  weeklyCountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  weeklyCount: { color: colors.text, fontSize: 20, fontWeight: '900' },
  weeklyCountLabel: { color: colors.textMuted, fontSize: 10 },
  goalCard: { marginTop: 8, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  goalTitle: { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: 10 },
  weeklyAiLabel: { color: colors.accentDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginBottom: 9 },
  goalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  goalNumber: { width: 22, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, marginRight: 9 },
  goalNumberText: { color: colors.accentDark, fontSize: 9, fontWeight: '900' },
  goalText: { flex: 1, color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  habitCard: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  habitRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  habitIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  habitIconWatch: { backgroundColor: '#fee2e2' },
  habitIconGood: { backgroundColor: '#d1fae5' },
  habitCopy: { flex: 1 },
  habitTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  habitText: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  habitSamples: { color: colors.textMuted, fontSize: 8, marginTop: 4 },
  habitEmpty: { flexDirection: 'row', alignItems: 'center' },
  habitEmptyCopy: { flex: 1, marginLeft: 11 },
  habitDisclaimer: { color: colors.textMuted, fontSize: 8, fontStyle: 'italic', marginTop: 7 },

  trendSection: { marginHorizontal: 16, marginBottom: 20 },
  trendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendCard: { overflow: 'hidden', padding: 8 },
  trendSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  trendSummaryText: { fontSize: 13, fontWeight: '700' },
  progressCoachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 100,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
    marginBottom: 2,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  progressCoachArt: { width: 92, height: 92, marginRight: 8 },
  progressCoachCopy: { flex: 1 },
  progressCoachEyebrow: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  progressCoachText: { color: '#24475b', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 11,
    marginTop: 6,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthMarker: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
  },
  monthMarkerText: { fontSize: 12, fontWeight: '900' },
  monthLeft: { flex: 1, paddingRight: 12 },
  monthName: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  monthSeverityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  monthDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  monthSeverityText: { fontSize: 11, fontWeight: '700' },
  monthProgressTrack: { height: 4, borderRadius: 2, backgroundColor: '#e5edf4', marginTop: 8, overflow: 'hidden' },
  monthProgressFill: { height: '100%', borderRadius: 2 },
  monthRight: { alignItems: 'flex-end' },
  monthEvents: { fontSize: 22, fontWeight: '800', color: colors.text },
  monthEventsLabel: { fontSize: 10, color: colors.textMuted, marginTop: -2 },
  monthChange: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 3 },
  monthChangeText: { fontSize: 11, fontWeight: '700' },

  recommendationSection: { paddingHorizontal: 16, marginBottom: 16 },
  adviceHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: 10,
  },
  logsSection: { paddingHorizontal: 16, marginBottom: 20 },
  logsCard: { padding: 16 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  settingDescription: { fontSize: 12, color: colors.textMuted, marginBottom: 4, lineHeight: 18 },
  logsHeader: {
    marginBottom: 14,
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sortLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginRight: 4 },
  sortOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortOptionActive: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(14, 165, 233,0.35)',
  },
  sortOptionText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  sortOptionTextActive: { color: colors.accent },
  emptyLogsRow: { paddingVertical: 20 },
  emptyLogsText: { fontSize: 13, color: colors.textMuted },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  logIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logContent: { flex: 1, paddingRight: 8 },
  logTimestamp: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  logDetails: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  logRight: { alignItems: 'flex-end' },
  severityPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  severityText: { fontSize: 11, fontWeight: '800' },
  logDuration: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  paginationButtonDisabled: { opacity: 0.35 },
  paginationButtonText: { color: colors.onAccent, fontSize: 12, fontWeight: '700' },
  paginationLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  footerText: { fontSize: 11, color: '#333333', fontStyle: 'italic' },
});
