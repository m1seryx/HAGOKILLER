import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  ActivityIndicator, RefreshControl, TouchableOpacity, Modal,
} from 'react-native';
import moment from 'moment';
import { DashboardData, DailyStats, MonthlyStats } from '../types';
import { calculateDailyStats, calculateMonthlyStats, calculateTrend } from '../utils/statsCalculator';
import { getRecommendations, getSeverityColor, getSeverityLabel } from '../utils/recommendations';
import { StatsCard } from '../components/StatsCard';
import { SnorePatternsChart } from '../components/SnorePatternsChart';
import { RecommendationCard } from '../components/RecommendationCard';
import { StatsFilter, TimePeriod, DateRange } from '../components/StatsFilter';
import { calculateDashboardData, MockBLEService } from '../services/mockBLEService';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

type SimulatedSeverity = 'normal' | 'bad' | 'danger';

interface DashboardScreenProps {
  userName: string;
}

const SEVERITY_EVENTS: Record<SimulatedSeverity, number> = {
  normal: 2,
  bad: 7,
  danger: 13,
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ userName }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TimePeriod>('week');
  const [monthHistory, setMonthHistory] = useState<MonthlyStats[]>([]);
  const [simulatedSeverity, setSimulatedSeverity] = useState<SimulatedSeverity>('bad');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'recommendations'>('analytics');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: moment().subtract(7, 'days').format('YYYY-MM-DD'),
    to: moment().format('YYYY-MM-DD'),
  });

  const navigation = useNavigation<any>();
  const bleService = useRef(new MockBLEService()).current;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const events = await bleService.fetchSleepEvents();
      const data = calculateDashboardData(events);
      setDashboardData(data);
      const now = moment();
      const months: MonthlyStats[] = [];
      for (let i = 2; i >= 0; i--) {
        const monthStr = now.clone().subtract(i, 'months').format('YYYY-MM');
        months.push(calculateMonthlyStats(events, monthStr));
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
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Syncing biosensor data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dashboardData) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Connection to Smart Pillow failed</Text>
        </View>
      </SafeAreaView>
    );
  }

  const overrideSeverity = (stats: DailyStats): DailyStats => ({
    ...stats,
    totalSnoreEvents: SEVERITY_EVENTS[simulatedSeverity],
    severity: simulatedSeverity,
  });

  const getRangeStats = (): DailyStats => {
    const from = moment(dateRange.from);
    const to = moment(dateRange.to);
    const rangeEvents = dashboardData.allData.filter((e) => {
      const d = moment(e.timestamp);
      return d.isSameOrAfter(from, 'day') && d.isSameOrBefore(to, 'day');
    });
    const totalSnoreEvents = rangeEvents.length;
    const averageDuration = totalSnoreEvents > 0
      ? Math.round(rangeEvents.reduce((s, e) => s + e.duration, 0) / totalSnoreEvents)
      : 0;
    const interventionCount = rangeEvents.filter((e) => e.interventionTriggered).length;
    return {
      date: dateRange.to,
      totalSnoreEvents,
      averageDuration,
      interventionCount,
      peakHour: 2,
      severity: simulatedSeverity,
    };
  };

  const getDisplayStats = (): { stats: DailyStats; trend: 'improving' | 'stable' | 'worsening' } => {
    switch (activeFilter) {
      case 'today':
        return { stats: overrideSeverity(dashboardData.today), trend: 'stable' };
      case 'week': {
        const avgEvents = dashboardData.thisWeek.reduce((s, d) => s + d.totalSnoreEvents, 0) / dashboardData.thisWeek.length;
        const avgDuration = dashboardData.thisWeek.reduce((s, d) => s + d.averageDuration, 0) / dashboardData.thisWeek.length;
        return {
          stats: {
            date: moment().format('YYYY-MM-DD'),
            totalSnoreEvents: SEVERITY_EVENTS[simulatedSeverity] * 7,
            averageDuration: Math.round(avgDuration),
            interventionCount: dashboardData.thisWeek.reduce((s, d) => s + d.interventionCount, 0),
            peakHour: dashboardData.thisWeek[0].peakHour,
            severity: simulatedSeverity,
          },
          trend: calculateTrend(monthHistory.length >= 2 ? monthHistory.slice(-2) : [monthHistory[0]]),
        };
      }
      case 'month':
        return {
          stats: {
            date: moment().format('YYYY-MM-DD'),
            totalSnoreEvents: SEVERITY_EVENTS[simulatedSeverity] * 30,
            averageDuration: dashboardData.thisMonth.averageDuration,
            interventionCount: dashboardData.thisMonth.interventionCount,
            peakHour: 2,
            severity: simulatedSeverity,
          },
          trend: dashboardData.thisMonth.trend,
        };
      case 'range':
        return {
          stats: getRangeStats(),
          trend: calculateTrend(monthHistory.length >= 2 ? monthHistory.slice(-2) : [monthHistory[0]]),
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
        return { data: monthDays.filter((_, i) => i % 5 === 0 || i === 29), title: '30-Day Overview' };
      }
      case 'range': {
        const from = moment(dateRange.from);
        const to = moment(dateRange.to);
        const days: DailyStats[] = [];
        let cur = from.clone();
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
  const recommendations = getRecommendations(stats, dashboardData.thisMonth, trend);
  const severityColor = getSeverityColor(simulatedSeverity);

  const severityOptions: SimulatedSeverity[] = ['normal', 'bad', 'danger'];
  const severityLabels: Record<SimulatedSeverity, string> = {
    normal: 'Normal (0–3 events)',
    bad: 'Elevated (4–10 events)',
    danger: 'Critical (11+ events)',
  };

  const getInitials = (name: string) => name ? name.charAt(0).toUpperCase() : 'U';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTitleArea}>
            <Text style={styles.greeting}>Good evening, {userName}</Text>
            <Text style={styles.dateSubtitle}>{moment().format('dddd, MMMM Do')}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(userName)}</Text>
          </View>
        </View>

        {/* BLE Connection Card */}
        <View style={styles.bleCard}>
          <View style={styles.bleRow}>
            <View style={styles.bleIconWrapper}>
              <FontAwesome5 name="microchip" size={16} color="#3b82f6" />
            </View>
            <View style={styles.bleInfo}>
              <Text style={styles.bleTitle}>HAGOKILLER ESP32</Text>
              <Text style={styles.bleSubtitle}>Active Connection</Text>
            </View>
            <View style={styles.bleStats}>
              <View style={styles.bleStatBadge}>
                <FontAwesome5 name="battery-full" size={10} color="#10b981" style={{ marginRight: 4 }} />
                <Text style={styles.bleStatText}>85%</Text>
              </View>
              <View style={styles.bleStatBadge}>
                <FontAwesome5 name="signal" size={10} color="#3b82f6" style={{ marginRight: 4 }} />
                <Text style={styles.bleStatText}>Strong</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Simulation / Override Controller */}
        <View style={styles.simulatorSection}>
          <TouchableOpacity
            style={[styles.dropdownButton, { borderColor: severityColor + '60', backgroundColor: severityColor + '10' }]}
            onPress={() => setDropdownVisible(true)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.simulatorIndicator, { backgroundColor: severityColor }]} />
              <Text style={[styles.dropdownLabel]}>Simulation Override: </Text>
              <Text style={[styles.dropdownButtonText, { color: severityColor }]}>
                {severityLabels[simulatedSeverity]}
              </Text>
            </View>
            <FontAwesome5 name="chevron-down" size={11} color={severityColor} />
          </TouchableOpacity>
        </View>

        {/* Filter */}
        <View style={styles.sectionPadding}>
          <StatsFilter
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            dateRange={dateRange}
            onRangeChange={setDateRange}
          />
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'analytics' && styles.tabButtonActive]}
            onPress={() => setActiveTab('analytics')}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="chart-pie" size={13} color={activeTab === 'analytics' ? '#ffffff' : '#6b7280'} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>Analytics</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'recommendations' && styles.tabButtonActive]}
            onPress={() => setActiveTab('recommendations')}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="stethoscope" size={13} color={activeTab === 'recommendations' ? '#ffffff' : '#6b7280'} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, activeTab === 'recommendations' && styles.tabTextActive]}>Assessment</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'analytics' ? (
          <>
            {/* Grid Metrics Section */}
            <View style={styles.metricsGrid}>
              <StatsCard label="Snore Events" value={stats.totalSnoreEvents} icon="wave-square" severity={stats.severity} />
              <StatsCard label="Avg. Duration" value={stats.averageDuration} icon="stopwatch" unit="s" />
              <StatsCard label="Pillow Inflations" value={stats.interventionCount} icon="wind" />
              <StatsCard label="Peak Hour" value={moment(stats.peakHour, 'H').format('h A')} icon="moon" />
            </View>

            {activeFilter === 'today' && (
              <View style={styles.sectionPadding}>
                <TouchableOpacity 
                  style={styles.detailButton} 
                  onPress={() => navigation.navigate('NightDetail', { date: stats.date })}
                >
                  <Text style={styles.detailButtonText}>View Nightly Detail Timeline</Text>
                  <FontAwesome5 name="arrow-right" size={12} color="#ffffff" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>
            )}

            {/* Chart Section */}
            <View style={styles.sectionPadding}>
              <SnorePatternsChart weeklyData={chartData} chartType="line" title={chartTitle} />
            </View>

            {/* Trend History */}
            <View style={styles.sectionPadding}>
              <Text style={styles.sectionTitle}>Historical Trend</Text>
              <View style={styles.trendCard}>
                
                <View style={[styles.trendSummary, {
                  backgroundColor: trend === 'improving' ? 'rgba(16, 185, 129, 0.1)' : trend === 'worsening' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                }]}>
                  <View style={styles.trendIconBox}>
                    <FontAwesome5
                      name={trend === 'improving' ? 'arrow-trend-down' : trend === 'worsening' ? 'arrow-trend-up' : 'minus'}
                      size={12}
                      color={trend === 'improving' ? '#10b981' : trend === 'worsening' ? '#ef4444' : '#6366f1'}
                    />
                  </View>
                  <Text style={[styles.trendSummaryText, {
                    color: trend === 'improving' ? '#10b981' : trend === 'worsening' ? '#ef4444' : '#818cf8',
                  }]}>
                    {trend === 'improving' ? 'Patterns are improving' : trend === 'worsening' ? 'Condition is worsening' : 'Patterns are stable'}
                  </Text>
                </View>

                {monthHistory.map((m, i) => {
                  const prev = monthHistory[i - 1];
                  const change = prev ? m.totalSnoreEvents - prev.totalSnoreEvents : null;
                  const mColor = getSeverityColor(m.severity);
                  return (
                    <View key={m.month} style={styles.monthRow}>
                      <View style={styles.monthLeft}>
                        <Text style={styles.monthName}>{moment(m.month, 'YYYY-MM').format('MMMM')}</Text>
                        <View style={[styles.monthSeverityBadge, { backgroundColor: mColor + '1a' }]}>
                          <Text style={[styles.monthSeverityText, { color: mColor }]}>
                            {getSeverityLabel(m.severity)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.monthRight}>
                        <Text style={styles.monthEvents}>{m.totalSnoreEvents}</Text>
                        <Text style={styles.monthEventsLabel}>total</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.sectionPadding}>
            <RecommendationCard data={recommendations} />
          </View>
        )}

        {/* Footer */}
        <View style={styles.footerContainer}>
          <FontAwesome5 name="sync" size={10} color="#6b7280" style={{ marginRight: 6 }} />
          <Text style={styles.footerText}>
            System synced: {moment(dashboardData.allData[0]?.timestamp).fromNow()}
          </Text>
        </View>

        {/* System Logs Button */}
        <View style={styles.sectionPadding}>
          <TouchableOpacity
            style={styles.logsButton}
            onPress={() => navigation.navigate('Logs' as never, { events: dashboardData.allData } as never)}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="terminal" size={13} color="#6366f1" style={{ marginRight: 10 }} />
            <Text style={styles.logsButtonText}>View Historical Logs</Text>
            <FontAwesome5 name="chevron-right" size={11} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Simulator Modal */}
      <Modal transparent visible={dropdownVisible} animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setDropdownVisible(false)} activeOpacity={1}>
          <View style={styles.modalMenu}>
            <Text style={styles.modalTitle}>Override Sensor Data</Text>
            {severityOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.modalOption, simulatedSeverity === opt && { backgroundColor: getSeverityColor(opt) + '15' }]}
                onPress={() => { setSimulatedSeverity(opt); setDropdownVisible(false); }}
              >
                <View style={styles.modalOptionContent}>
                  <View style={[styles.simulatorIndicator, { backgroundColor: getSeverityColor(opt) }]} />
                  <Text style={[styles.modalOptionText, { color: getSeverityColor(opt) }]}>
                    {severityLabels[opt]}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0b10' // Space midnight background
  },
  loadingContainer: { 
    flex: 1, 
    backgroundColor: '#0a0b10', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  centerContent: { 
    alignItems: 'center' 
  },
  loadingText: { 
    fontSize: 14, 
    color: '#6366f1', 
    marginTop: 16, 
    fontWeight: '600', 
    letterSpacing: 0.5 
  },
  errorText: { 
    fontSize: 14, 
    color: '#ef4444' 
  },
  
  // Header
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingTop: 24, 
    paddingBottom: 20,
  },
  headerTitleArea: {
    flex: 1,
  },
  greeting: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#ffffff', 
    marginBottom: 4, 
    letterSpacing: 0.5 
  },
  dateSubtitle: { 
    fontSize: 13, 
    color: '#9ca3af', 
    fontWeight: '500' 
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1.5,
    borderColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },

  // BLE Card
  bleCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    backgroundColor: 'rgba(26, 27, 38, 0.75)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bleIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bleInfo: {
    flex: 1,
  },
  bleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  bleSubtitle: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  bleStats: {
    alignItems: 'flex-end',
    gap: 6,
  },
  bleStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bleStatText: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
  },

  // Simulator
  simulatorSection: { 
    paddingHorizontal: 24, 
    marginBottom: 20 
  },
  dropdownButton: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderWidth: 1, 
    borderRadius: 12,
    paddingHorizontal: 16, 
    paddingVertical: 12,
  },
  simulatorIndicator: {
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    marginRight: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  dropdownLabel: { 
    fontSize: 12, 
    color: '#9ca3af', 
    fontWeight: '500' 
  },
  dropdownButtonText: { 
    fontSize: 12, 
    fontWeight: '700' 
  },
  
  // Layout utilities
  sectionPadding: { 
    paddingHorizontal: 24, 
    marginBottom: 8 
  },
  
  // Tabs
  tabContainer: { 
    flexDirection: 'row', 
    marginHorizontal: 24, 
    marginBottom: 20, 
    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
    borderRadius: 12, 
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    borderRadius: 10 
  },
  tabButtonActive: { 
    backgroundColor: 'rgba(99, 102, 241, 0.2)' 
  },
  tabText: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#6b7280' 
  },
  tabTextActive: { 
    color: '#ffffff',
    fontWeight: '700'
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20, // slightly less to account for card margin
    marginBottom: 12,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  detailButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Trend Section
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  trendCard: { 
    backgroundColor: 'rgba(26, 27, 38, 0.75)', 
    borderRadius: 16, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  trendSummary: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255, 255, 255, 0.04)' 
  },
  trendIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  trendSummaryText: { 
    fontSize: 13, 
    fontWeight: '700' 
  },
  monthRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255, 255, 255, 0.04)' 
  },
  monthLeft: { 
    flex: 1 
  },
  monthName: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#e5e7eb', 
    marginBottom: 6 
  },
  monthSeverityBadge: { 
    alignSelf: 'flex-start', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6 
  },
  monthSeverityText: { 
    fontSize: 10, 
    fontWeight: '700', 
    textTransform: 'uppercase' 
  },
  monthRight: { 
    alignItems: 'flex-end' 
  },
  monthEvents: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#ffffff' 
  },
  monthEventsLabel: { 
    fontSize: 10, 
    color: '#9ca3af', 
    marginTop: 2, 
    textTransform: 'uppercase' 
  },

  // Modal
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    paddingHorizontal: 32 
  },
  modalMenu: { 
    backgroundColor: '#161722', 
    borderRadius: 16, 
    overflow: 'hidden', 
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  modalTitle: { 
    fontSize: 12, 
    color: '#9ca3af', 
    fontWeight: '600', 
    textTransform: 'uppercase', 
    paddingHorizontal: 12, 
    paddingVertical: 12,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  modalOption: { 
    paddingHorizontal: 12, 
    paddingVertical: 14, 
    borderRadius: 10,
    marginBottom: 4,
  },
  modalOptionContent: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  modalOptionText: { 
    fontSize: 14, 
    fontWeight: '700' 
  },

  // Footer
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: { 
    fontSize: 11, 
    color: '#6b7280', 
    fontStyle: 'italic' 
  },
  logsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 27, 38, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  logsButtonText: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '600',
  },
});
