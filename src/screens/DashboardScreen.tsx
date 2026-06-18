import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import moment from 'moment';
import { DashboardData, DailyStats, MonthlyStats } from '../types';
import { calculateDailyStats, calculateMonthlyStats, calculateTrend } from '../utils/statsCalculator';
import { getRecommendations, getSeverityColor } from '../utils/recommendations';
import { StatsCard } from '../components/StatsCard';
import { SnorePatternsChart } from '../components/SnorePatternsChart';
import { RecommendationCard } from '../components/RecommendationCard';
import { StatsFilter, TimePeriod } from '../components/StatsFilter';
import { calculateDashboardData, MockBLEService } from '../services/mockBLEService';

interface DashboardScreenProps {
  onDeviceDisconnect?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onDeviceDisconnect }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TimePeriod>('week');
  const [monthHistory, setMonthHistory] = useState<MonthlyStats[]>([]);

  const bleService = new MockBLEService();

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const events = await bleService.fetchSleepEvents();
      const data = calculateDashboardData(events);
      setDashboardData(data);

      // Calculate month history for trend analysis
      const now = moment();
      const months: MonthlyStats[] = [];
      for (let i = 2; i >= 0; i--) {
        const monthStr = now.clone().subtract(i, 'months').format('YYYY-MM');
        const monthStats = calculateMonthlyStats(events, monthStr);
        months.push(monthStats);
      }
      setMonthHistory(months);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading sleep data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dashboardData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Failed to load data</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Get data based on selected filter
  const getDisplayStats = (): {
    stats: DailyStats;
    trend: 'improving' | 'stable' | 'worsening';
  } => {
    switch (activeFilter) {
      case 'today':
        return {
          stats: dashboardData.today,
          trend: 'stable',
        };
      case 'week': {
        const avgEvents =
          dashboardData.thisWeek.reduce((sum, d) => sum + d.totalSnoreEvents, 0) /
          dashboardData.thisWeek.length;
        const avgDuration =
          dashboardData.thisWeek.reduce((sum, d) => sum + d.averageDuration, 0) /
          dashboardData.thisWeek.length;
        const severity = calculateDailyStats(dashboardData.allData, '').severity;

        return {
          stats: {
            date: moment().format('YYYY-MM-DD'),
            totalSnoreEvents: Math.round(avgEvents * 7),
            averageDuration: Math.round(avgDuration),
            interventionCount: dashboardData.thisWeek.reduce((sum, d) => sum + d.interventionCount, 0),
            peakHour: dashboardData.thisWeek[0].peakHour,
            severity,
          },
          trend: calculateTrend(
            monthHistory.length >= 2
              ? monthHistory.slice(-2)
              : [monthHistory[0]]
          ),
        };
      }
      case 'month':
        return {
          stats: {
            date: moment().format('YYYY-MM-DD'),
            totalSnoreEvents: dashboardData.thisMonth.totalSnoreEvents,
            averageDuration: dashboardData.thisMonth.averageDuration,
            interventionCount: dashboardData.thisMonth.interventionCount,
            peakHour: 2, // Default
            severity: dashboardData.thisMonth.severity,
          },
          trend: dashboardData.thisMonth.trend,
        };
    }
  };

  const { stats, trend } = getDisplayStats();
  const recommendations = getRecommendations(stats, dashboardData.thisMonth, trend);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Sleep Analytics</Text>
            <Text style={styles.headerSubtitle}>
              {moment().format('dddd, MMMM D, YYYY')}
            </Text>
          </View>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: getSeverityColor(stats.severity) }]} />
            <Text style={styles.statusText}>{stats.severity.toUpperCase()}</Text>
          </View>
        </View>

        {/* Filter */}
        <View style={styles.filterWrapper}>
          <StatsFilter activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsSection}>
          <StatsCard
            label="Snoring Events"
            value={stats.totalSnoreEvents}
            icon="🔊"
            severity={stats.severity}
          />
          <StatsCard
            label="Avg. Duration"
            value={stats.averageDuration}
            icon="⏱️"
            unit=" sec"
          />
          <StatsCard
            label="Interventions"
            value={stats.interventionCount}
            icon="💨"
          />
          <StatsCard
            label="Peak Hour"
            value={moment(stats.peakHour, 'H').format('hA')}
            icon="🕐"
          />
        </View>

        {/* Chart */}
        <View style={styles.chartSection}>
          <SnorePatternsChart weeklyData={dashboardData.thisWeek} chartType="line" />
        </View>

        {/* Recommendations */}
        <View style={styles.recommendationSection}>
          <RecommendationCard data={recommendations} />
        </View>

        {/* Trend Message */}
        <View style={styles.trendSection}>
          <Text style={styles.trendLabel}>Monthly Trend</Text>
          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor:
                  trend === 'improving'
                    ? '#10b98126'
                    : trend === 'worsening'
                      ? '#ef444426'
                      : '#f5a52e26',
              },
            ]}
          >
            <Text
              style={[
                styles.trendBadgeText,
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
                ? '📈 Getting better'
                : trend === 'worsening'
                  ? '📉 Getting worse'
                  : '➡️ Stable'}
            </Text>
          </View>
        </View>

        {/* Footer Info */}
        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>
            💡 Last synced: {moment(dashboardData.allData[0]?.timestamp).fromNow()}
          </Text>
          <Text style={styles.disclaimerText}>
            This app provides general monitoring only. For medical concerns, consult a healthcare
            professional.
          </Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e5e7eb',
  },
  filterWrapper: {
    paddingHorizontal: 20,
  },
  metricsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  chartSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  recommendationSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  trendSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  trendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  trendBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerInfo: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 6,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
