import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  ActivityIndicator, RefreshControl, TouchableOpacity, Modal,
  Animated,
} from 'react-native';
import moment from 'moment';
import { DashboardData, DailyStats, MonthlyStats, SleepEvent, UserProfile } from '../types';
import { calculateDailyStats, calculateMonthlyStats, calculateTrend, calculateInterventionEffectiveness } from '../utils/statsCalculator';
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
  userProfile?: UserProfile;
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
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'recommendations' | 'logs'>('analytics');
  const [eventLogs, setEventLogs] = useState<SleepEvent[]>([]);
  const [sortOption, setSortOption] = useState<'date' | 'severity' | 'duration'>('date');
  const [snoreThreshold, setSnoreThreshold] = useState(3);
  const [pumpDuration, setPumpDuration] = useState(12);
  const [saveMessage, setSaveMessage] = useState('');
  const barAnimations = useRef<Animated.Value[]>([]);
  const [deviceStatus] = useState({
    connected: true,
    mode: 'Pairing Ready',
    signal: 'Strong',
    battery: 82,
    pairingStatus: 'Aligned',
    lastSeen: 'just now',
  });
  const [dateRange, setDateRange] = useState<DateRange>({
    from: moment().subtract(7, 'days').format('YYYY-MM-DD'),
    to: moment().format('YYYY-MM-DD'),
  });

  const navigation = useNavigation<any>();
  const bleService = useRef(new MockBLEService()).current;

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!dashboardData) return;

    if (barAnimations.current.length === 0) {
      barAnimations.current = Array.from({ length: 24 }, () => new Animated.Value(0));
    }

    const animations = barAnimations.current.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 280,
        delay: index * 20,
        useNativeDriver: false,
      })
    );

    Animated.parallel(animations).start();
  }, [dashboardData]);

  const loadData = async () => {
    try {
      setLoading(true);
      const events = await bleService.fetchSleepEvents();
      setEventLogs(events);
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

  const getFilteredAndSortedLogs = (): SleepEvent[] => {
    const from = moment(dateRange.from);
    const to = moment(dateRange.to);
    const severityRank: Record<SleepEvent['severity'], number> = { low: 1, medium: 2, high: 3 };

    return [...eventLogs]
      .filter((event) => {
        const eventDate = moment(event.timestamp);
        return eventDate.isSameOrAfter(from, 'day') && eventDate.isSameOrBefore(to, 'day');
      })
      .sort((a, b) => {
        if (sortOption === 'duration') {
          return b.duration - a.duration;
        }
        if (sortOption === 'severity') {
          return severityRank[b.severity] - severityRank[a.severity];
        }
        return b.timestamp - a.timestamp;
      });
  };

  const handleDeleteLog = (id: string) => {
    setEventLogs((current) => current.filter((entry) => entry.id !== id));
  };

  const handleClearLogs = () => {
    setEventLogs([]);
  };

  const handleSaveDeviceSettings = () => {
    setSaveMessage('Device settings saved');
    setTimeout(() => setSaveMessage(''), 2800);
  };

  const visibleLogs = getFilteredAndSortedLogs();
  const logCount = visibleLogs.length;

  const { stats, trend } = getDisplayStats();
  const { data: chartData, title: chartTitle } = getChartData();
  const recommendations = getRecommendations(stats, dashboardData.thisMonth, trend);
  const severityColor = getSeverityColor(simulatedSeverity);
  const deviceStatusColor = deviceStatus.connected ? '#10b981' : '#f59e0b';
  const interventionMetrics = calculateInterventionEffectiveness(dashboardData.allData);
  const lowBattery = deviceStatus.battery <= 20;
  const pairingIssue = deviceStatus.pairingStatus !== 'Aligned';
  const activeAlerts = [
    deviceStatus.connected && lowBattery ? 'Low battery detected' : null,
    deviceStatus.connected && pairingIssue ? 'Pairing needs alignment' : null,
    stats.severity === 'danger' ? 'Elevated snoring risk detected' : null,
  ].filter(Boolean) as string[];

  const severityOptions: SimulatedSeverity[] = ['normal', 'bad', 'danger'];
  const settingsOptions = ['Pairing PIN', 'Bluetooth', 'Notifications'];
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
          <View style={styles.headerContent}>
            <Text style={styles.greeting}>Hello, {userName} <FontAwesome5 name="hand-paper" size={20} color="#f59e0b" /></Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Snoring Status — </Text>
              <Text style={[styles.statusValue, { color: severityColor }]}>
                {simulatedSeverity.charAt(0).toUpperCase() + simulatedSeverity.slice(1)}
              </Text>
            </View>
            <Text style={styles.headerSubtitle}>{moment().format('dddd, MMMM D, YYYY')}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.settingsButton} onPress={() => setSettingsVisible(true)}>
              <FontAwesome5 name="cog" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings Modal */}
        <Modal transparent visible={settingsVisible} animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setSettingsVisible(false)}>
            <View style={styles.modalMenu}>
              <Text style={styles.modalTitle}>Device Settings</Text>

              <View style={styles.deviceCard}>
                <View style={styles.deviceHeader}>
                  <View style={styles.deviceTitleRow}>
                    <FontAwesome5 name="microchip" size={16} color="#60a5fa" />
                    <Text style={styles.deviceTitle}>ESP32 Device Status</Text>
                  </View>
                  <View style={[styles.deviceBadge, { backgroundColor: deviceStatusColor + '22' }]}> 
                    <View style={[styles.statusDot, { backgroundColor: deviceStatusColor }]} />
                    <Text style={[styles.deviceBadgeText, { color: deviceStatusColor }]}> 
                      {deviceStatus.connected ? 'Connected' : 'Offline'}
                    </Text>
                  </View>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceLabel}>Device</Text>
                  <Text style={styles.deviceValue}>HAGOKILLER Pillow</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceLabel}>Mode</Text>
                  <Text style={styles.deviceValue}>{deviceStatus.mode}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceLabel}>Signal</Text>
                  <Text style={styles.deviceValue}>{deviceStatus.signal}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceLabel}>Battery</Text>
                  <Text style={styles.deviceValue}>{deviceStatus.battery}%</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceLabel}>Pairing</Text>
                  <Text style={styles.deviceValue}>{deviceStatus.pairingStatus}</Text>
                </View>
                <View style={styles.deviceInfoRow}>
                  <Text style={styles.deviceLabel}>Last Seen</Text>
                  <Text style={styles.deviceValue}>{deviceStatus.lastSeen}</Text>
                </View>
              </View>

              {settingsOptions.map((opt) => (
                <View key={opt} style={styles.modalOption}>
                  <Text style={styles.modalOptionText}>{opt}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Alert Banner */}
        {activeAlerts.length > 0 ? (
          <View style={styles.alertBanner}>
            <FontAwesome5 name="exclamation-triangle" size={15} color="#fbbf24" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>System Alert</Text>
              <Text style={styles.alertText}>{activeAlerts.join(' • ')}</Text>
            </View>
          </View>
        ) : null}

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
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'logs' && styles.tabButtonActive]}
            onPress={() => setActiveTab('logs')}
          >
            <FontAwesome5 name="clipboard-list" size={13} color={activeTab === 'logs' ? '#3b82f6' : '#6b7280'} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, activeTab === 'logs' && styles.tabTextActive]}>Logs</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'analytics' ? (
          <>
            {/* Key Metrics */}
            <View style={styles.metricsSection}>
              <StatsCard label="Snoring Events" value={stats.totalSnoreEvents} icon="volume-up" severity={stats.severity} />
              <StatsCard label="Avg. Duration" value={stats.averageDuration} icon="clock" unit=" sec" />
              <StatsCard label="Interventions" value={stats.interventionCount} icon="wind" />
              <StatsCard label="Peak Hour" value={moment(stats.peakHour, 'H').format('hA')} icon="moon" />
              <StatsCard
                label="Intervention Success"
                value={`${Math.round(interventionMetrics.successRatio * 100)}%`}
                icon="check-double"
                severity={interventionMetrics.trend === 'improving' ? 'normal' : interventionMetrics.trend === 'worsening' ? 'danger' : 'bad'}
              />
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

            {/* Hourly Snore Activity */}
            <View style={styles.hourlySection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.panelHeader}>Hourly Snore Activity</Text>
                <Text style={styles.sectionHint}>Bar chart of nightly event peaks</Text>
              </View>
              <View style={styles.hourlyChart}>
                {Array.from({ length: 24 }, (_, hour) => {
                  const count = dashboardData.allData.filter((event) => moment(event.timestamp).hour() === hour).length;
                  const targetHeight = Math.max(8, count * 5);
                  const animatedHeight = barAnimations.current[hour]?.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, targetHeight],
                  }) ?? targetHeight;
                  const animatedOpacity = barAnimations.current[hour]?.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }) ?? 1;

                  return (
                    <View key={hour} style={styles.hourlyBarColumn}>
                      <Animated.View style={[styles.hourlyBar, { height: animatedHeight, opacity: animatedOpacity }]} />
                      <Text style={styles.hourlyLabel}>{moment().hour(hour).format('hA')}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Monthly Trend */}
            <View style={styles.trendSection}>
              <Text style={styles.trendLabel}>Monthly Trend</Text>
              <View style={styles.trendCard}>
                {/* Trend summary badge */}
                <View style={[styles.trendSummary, {
                  backgroundColor: trend === 'improving' ? '#10b98120' : trend === 'worsening' ? '#ef444420' : '#f59e0b20',
                }]}>
                  <FontAwesome5
                    name={trend === 'improving' ? 'chart-line' : trend === 'worsening' ? 'exclamation-triangle' : 'equals'}
                    size={14}
                    color={trend === 'improving' ? '#10b981' : trend === 'worsening' ? '#ef4444' : '#f59e0b'}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.trendSummaryText, {
                    color: trend === 'improving' ? '#10b981' : trend === 'worsening' ? '#ef4444' : '#f59e0b',
                  }]}>
                    {trend === 'improving' ? 'Improving over time' : trend === 'worsening' ? 'Worsening over time' : 'Stable pattern'}
                  </Text>
                </View>

                {/* Month rows */}
                {monthHistory.map((m, i) => {
                  const prev = monthHistory[i - 1];
                  const change = prev ? m.totalSnoreEvents - prev.totalSnoreEvents : null;
                  const mColor = getSeverityColor(m.severity);
                  return (
                    <View key={m.month} style={styles.monthRow}>
                      <View style={styles.monthLeft}>
                        <Text style={styles.monthName}>{moment(m.month, 'YYYY-MM').format('MMMM YYYY')}</Text>
                        <View style={[styles.monthSeverityBadge, { backgroundColor: mColor + '22' }]}>
                          <View style={[styles.monthDot, { backgroundColor: mColor }]} />
                          <Text style={[styles.monthSeverityText, { color: mColor }]}>
                            {m.severity.charAt(0).toUpperCase() + m.severity.slice(1)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.monthRight}>
                        <Text style={styles.monthEvents}>{m.totalSnoreEvents}</Text>
                        <Text style={styles.monthEventsLabel}>events</Text>
                        {change !== null && (
                          <View style={styles.monthChange}>
                            <FontAwesome5
                              name={change < 0 ? 'arrow-down' : change > 0 ? 'arrow-up' : 'minus'}
                              size={10}
                              color={change < 0 ? '#10b981' : change > 0 ? '#ef4444' : '#f59e0b'}
                            />
                            <Text style={[styles.monthChangeText, {
                              color: change < 0 ? '#10b981' : change > 0 ? '#ef4444' : '#f59e0b',
                            }]}>
                              {Math.abs(change)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : activeTab === 'recommendations' ? (
          <View style={styles.recommendationSection}>
            <RecommendationCard data={recommendations} />
          </View>
        ) : (
          <View style={styles.logsSection}>
            <View style={styles.settingsCard}>
              <Text style={styles.sectionHeader}>Device Parameter Settings</Text>
              <Text style={styles.settingDescription}>
                Adjust the snore detection and pump behavior for the connected device.
              </Text>

              <View style={styles.settingRow}>
                <View>
                  <Text style={styles.settingLabel}>Consecutive snore threshold</Text>
                  <Text style={styles.settingHint}>Number of snoring events before intervention</Text>
                </View>
                <View style={styles.valueControlRow}>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setSnoreThreshold((value) => Math.max(1, value - 1))}
                  >
                    <Text style={styles.stepButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.settingValue}>{snoreThreshold}</Text>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setSnoreThreshold((value) => Math.min(10, value + 1))}
                  >
                    <Text style={styles.stepButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingRow}>
                <View>
                  <Text style={styles.settingLabel}>Pump activation duration</Text>
                  <Text style={styles.settingHint}>Seconds of air pump delivery</Text>
                </View>
                <View style={styles.valueControlRow}>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setPumpDuration((value) => Math.max(5, value - 1))}
                  >
                    <Text style={styles.stepButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.settingValue}>{pumpDuration}s</Text>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => setPumpDuration((value) => Math.min(30, value + 1))}
                  >
                    <Text style={styles.stepButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {saveMessage ? <Text style={styles.saveMessage}>{saveMessage}</Text> : null}
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveDeviceSettings}>
                <Text style={styles.saveButtonText}>Save Device Settings</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.settingsCard, { marginTop: 16 }]}> 
              <View style={styles.logsHeader}>
                <View>
                  <Text style={styles.sectionHeader}>Sleep Event Logs</Text>
                  <Text style={styles.settingDescription}>{logCount} events shown for selected range</Text>
                </View>
                <TouchableOpacity style={styles.clearButton} onPress={handleClearLogs}>
                  <Text style={styles.clearButtonText}>Clear History</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Sort by</Text>
                {(['date', 'severity', 'duration'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.sortOption, sortOption === option && styles.sortOptionActive]}
                    onPress={() => setSortOption(option)}
                  >
                    <Text style={[styles.sortOptionText, sortOption === option && styles.sortOptionTextActive]}>
                      {option === 'date' ? 'Date' : option === 'severity' ? 'Severity' : 'Duration'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {visibleLogs.length === 0 ? (
                <View style={styles.emptyLogsRow}>
                  <Text style={styles.emptyLogsText}>No sleep events available for the selected range.</Text>
                </View>
              ) : (
                visibleLogs.map((entry) => (
                  <View key={entry.id} style={styles.logRow}>
                    <View style={styles.logContent}>
                      <Text style={styles.logTimestamp}>{moment(entry.timestamp).format('MMM D, h:mm A')}</Text>
                      <Text style={styles.logDetails}>
                        {entry.severity.charAt(0).toUpperCase() + entry.severity.slice(1)} severity · {entry.duration}s · Intervention {entry.interventionTriggered ? 'Yes' : 'No'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteLog(entry.id)} style={styles.deleteIconButton}>
                      <FontAwesome5 name="trash-alt" size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
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
    backgroundColor: '#0a0b10',
  },
  loadingContainer: { 
    flex: 1, 
    backgroundColor: '#0a0b10', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  centerContent: { 
    alignItems: 'center',
  },
  loadingText: { 
    fontSize: 14, 
    color: '#6366f1', 
    marginTop: 16, 
    fontWeight: '600', 
    letterSpacing: 0.5,
  },
  errorText: { 
    fontSize: 14, 
    color: '#ef4444',
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
  headerContent: { flex: 1, paddingRight: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3d3d5c',
  },
  greeting: { fontSize: 24, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statusLabel: { fontSize: 14, color: '#9ca3af' },
  statusValue: { fontSize: 14, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: '#6b7280' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },

  // Device Card (settings modal)
  deviceCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#2d2d44',
    borderWidth: 1,
    borderColor: '#3d3d5c',
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  deviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  deviceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deviceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  deviceLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  deviceValue: {
    fontSize: 12,
    color: '#f3f4f6',
    fontWeight: '600',
  },

  // Alert Banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f59e0b22',
    borderWidth: 1,
    borderColor: '#f59e0b55',
  },
  alertTitle: { fontSize: 12, fontWeight: '700', color: '#fbbf24', marginBottom: 2 },
  alertText: { fontSize: 12, color: '#fde68a', lineHeight: 18 },

  // Simulator
  simulatorSection: { paddingHorizontal: 20, marginBottom: 16 },
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
  dropdownButton: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderWidth: 1, 
    borderRadius: 12,
    paddingHorizontal: 16, 
    paddingVertical: 12,
  },
  dropdownLabel: { 
    fontSize: 12, 
    color: '#9ca3af', 
    fontWeight: '500',
  },
  dropdownButtonText: { 
    fontSize: 12, 
    fontWeight: '700',
  },
  
  // Layout utilities
  sectionPadding: { 
    paddingHorizontal: 24, 
    marginBottom: 8,
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
    borderRadius: 10,
  },
  tabButtonActive: { 
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  tabText: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#6b7280',
  },
  tabTextActive: { 
    color: '#ffffff',
    fontWeight: '700',
  },

  // Metrics
  metricsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
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

  // Hourly Activity
  hourlySection: { marginHorizontal: 20, marginBottom: 20, padding: 14, borderRadius: 14, backgroundColor: '#2d2d44', borderWidth: 1, borderColor: '#3d3d5c' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  panelHeader: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  sectionHint: { fontSize: 11, color: '#9ca3af' },
  hourlyChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 140 },
  hourlyBarColumn: { flex: 1, alignItems: 'center', marginHorizontal: 1 },
  hourlyBar: { width: '100%', maxWidth: 8, borderRadius: 999, backgroundColor: '#3b82f6', minHeight: 8 },
  hourlyLabel: { fontSize: 9, color: '#9ca3af', marginTop: 6 },

  // Trend Section
  trendSection: { marginHorizontal: 20, marginBottom: 20 },
  trendLabel: { fontSize: 12, fontWeight: '600', color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  trendCard: { 
    backgroundColor: '#2d2d44', 
    borderRadius: 12, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: '#3d3d5c',
  },
  trendSummary: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#3d3d5c',
  },
  trendSummaryText: { 
    fontSize: 13, 
    fontWeight: '700',
  },
  monthRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 14, 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#3d3d5c',
  },
  monthLeft: { flex: 1 },
  monthName: { fontSize: 14, fontWeight: '600', color: '#e5e7eb', marginBottom: 4 },
  monthSeverityBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  monthDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  monthSeverityText: { fontSize: 11, fontWeight: '700' },
  monthRight: { alignItems: 'flex-end' },
  monthEvents: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  monthEventsLabel: { fontSize: 10, color: '#6b7280', marginTop: -2 },
  monthChange: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 3 },
  monthChangeText: { fontSize: 11, fontWeight: '700' },

  // Recommendation & Logs sections
  recommendationSection: { paddingHorizontal: 20, marginBottom: 16 },
  logsSection: { paddingHorizontal: 20, marginBottom: 20 },
  settingsCard: { backgroundColor: '#2d2d44', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#3d3d5c' },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#ffffff', marginBottom: 6 },
  settingDescription: { fontSize: 12, color: '#9ca3af', marginBottom: 14, lineHeight: 18 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  valueControlRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: '#3d3d5c', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1f2937' },
  stepButtonText: { fontSize: 18, color: '#ffffff', fontWeight: '700' },
  settingValue: { fontSize: 16, fontWeight: '700', color: '#ffffff', minWidth: 40, textAlign: 'center' },
  settingLabel: { fontSize: 13, fontWeight: '700', color: '#f3f4f6', marginBottom: 2 },
  settingHint: { fontSize: 11, color: '#9ca3af' },
  saveButton: { marginTop: 6, backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  saveMessage: { color: '#10b981', fontSize: 12, marginBottom: 8 },
  logsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  clearButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ef4444' },
  clearButtonText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  sortRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sortLabel: { fontSize: 12, color: '#9ca3af', marginRight: 8 },
  sortOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#1f2937' },
  sortOptionActive: { backgroundColor: '#3b82f6' },
  sortOptionText: { fontSize: 12, color: '#e5e7eb' },
  sortOptionTextActive: { color: '#ffffff', fontWeight: '700' },
  emptyLogsRow: { paddingVertical: 22, alignItems: 'center' },
  emptyLogsText: { fontSize: 13, color: '#9ca3af' },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3d3d5c' },
  logContent: { flex: 1, paddingRight: 12 },
  logTimestamp: { fontSize: 13, color: '#ffffff', fontWeight: '700', marginBottom: 4 },
  logDetails: { fontSize: 12, color: '#9ca3af', lineHeight: 18 },
  deleteIconButton: { padding: 8 },

  // Modal
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    paddingHorizontal: 32,
  },
  modalMenu: { 
    backgroundColor: '#161722', 
    borderRadius: 16, 
    overflow: 'hidden', 
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    alignItems: 'center',
  },
  modalOptionText: { 
    fontSize: 14, 
    fontWeight: '700',
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
    fontStyle: 'italic',
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
