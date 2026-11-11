import React, { useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { FontAwesome5 } from '@expo/vector-icons';
import moment from 'moment';
import { SleepEvent } from '../types';
import { colors } from '../constants/theme';
import {
  computeSessionConsecutiveStats,
  computeSessionLengthStats,
  computeSessionRmsStats,
  computeSnoreCountByDateRange,
} from '../utils/snoreClassifications';

interface SnoreAnalyticsDashboardProps {
  events: SleepEvent[];
}

type TabKey = 'count' | 'consecutive' | 'length' | 'rms';

const PAD_LEFT = 36;
const PAD_RIGHT = 14;
const PAD_TOP = 16;
const PAD_BOTTOM = 22;

export const SnoreAnalyticsDashboard: React.FC<SnoreAnalyticsDashboardProps> = ({ events }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('count');
  const [rangeMode, setRangeMode] = useState<'7' | 'custom'>('7');
  const [customStartDate, setCustomStartDate] = useState(moment().subtract(6, 'days').format('YYYY-MM-DD'));
  const [customEndDate, setCustomEndDate] = useState(moment().format('YYYY-MM-DD'));
  const [calendarPicker, setCalendarPicker] = useState<null | 'start' | 'end'>(null);
  const [pickerMonth, setPickerMonth] = useState(moment());
  const [chartWidth, setChartWidth] = useState(340);

  // Date range computations for Chart 1
  const dateRangeStats = useMemo(() => {
    let start: string;
    let end: string;
    if (rangeMode === '7') {
      end = moment().format('YYYY-MM-DD');
      start = moment().subtract(6, 'days').format('YYYY-MM-DD');
    } else {
      start = customStartDate;
      end = customEndDate;
    }
    return computeSnoreCountByDateRange(events, start, end);
  }, [events, rangeMode, customStartDate, customEndDate]);

  const openCalendarPicker = (which: 'start' | 'end') => {
    setPickerMonth(moment(which === 'start' ? customStartDate : customEndDate));
    setCalendarPicker(which);
  };

  const selectCustomDay = (day: number) => {
    const selected = pickerMonth.clone().date(day).format('YYYY-MM-DD');
    if (calendarPicker === 'start') {
      setCustomStartDate(selected);
      if (moment(selected).isAfter(moment(customEndDate))) {
        setCustomEndDate(selected);
      }
    } else if (calendarPicker === 'end') {
      setCustomEndDate(selected);
      if (moment(selected).isBefore(moment(customStartDate))) {
        setCustomStartDate(selected);
      }
    }
    setCalendarPicker(null);
  };

  // Consecutive streak stats for Chart 2
  const consecutiveStats = useMemo(() => computeSessionConsecutiveStats(events), [events]);

  // Snore duration length stats for Chart 3
  const lengthStats = useMemo(() => computeSessionLengthStats(events), [events]);

  // RMS level stats for Chart 4
  const rmsStats = useMemo(() => computeSessionRmsStats(events), [events]);

  return (
    <View style={styles.container}>
      {/* Header Badge & Title */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <FontAwesome5 name="chart-pie" size={13} color="#0284c7" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>SNORE MONITORING & ANALYTICS</Text>
          <Text style={styles.title}>Sleep Snore Classification</Text>
        </View>
      </View>

      {/* 3 Live Classification Threshold Reference Strips */}
      <View style={styles.classificationGuide}>
        {/* Consecutive guide */}
        <View style={styles.guideRow}>
          <View style={styles.guideLabelCol}>
            <Text style={styles.guideLabelTitle}>Consecutive</Text>
            <Text style={styles.guideLabelHint}>Streak</Text>
          </View>
          <View style={styles.guideTiers}>
            <View style={[styles.guidePill, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
              <Text style={[styles.guidePillText, { color: '#0284c7' }]}>1 Snore: Low</Text>
            </View>
            <View style={[styles.guidePill, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
              <Text style={[styles.guidePillText, { color: '#d97706' }]}>2 Snores: Mild</Text>
            </View>
            <View style={[styles.guidePill, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <Text style={[styles.guidePillText, { color: '#dc2626' }]}>3+ Snores: High</Text>
            </View>
          </View>
        </View>

        {/* Snore length guide */}
        <View style={styles.guideRow}>
          <View style={styles.guideLabelCol}>
            <Text style={styles.guideLabelTitle}>Length</Text>
            <Text style={styles.guideLabelHint}>Duration</Text>
          </View>
          <View style={styles.guideTiers}>
            <View style={[styles.guidePill, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
              <Text style={[styles.guidePillText, { color: '#059669' }]}>0-5s: Low</Text>
            </View>
            <View style={[styles.guidePill, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
              <Text style={[styles.guidePillText, { color: '#0284c7' }]}>6-15s: Mid</Text>
            </View>
            <View style={[styles.guidePill, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
              <Text style={[styles.guidePillText, { color: '#d97706' }]}>16-30s: High</Text>
            </View>
            <View style={[styles.guidePill, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <Text style={[styles.guidePillText, { color: '#dc2626' }]}>31-60s: Severe</Text>
            </View>
          </View>
        </View>

        {/* RMS sound guide */}
        <View style={[styles.guideRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
          <View style={styles.guideLabelCol}>
            <Text style={styles.guideLabelTitle}>RMS Sound</Text>
            <Text style={styles.guideLabelHint}>Intensity</Text>
          </View>
          <View style={styles.guideTiers}>
            <View style={[styles.guidePill, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
              <Text style={[styles.guidePillText, { color: '#059669' }]}>0-1000: Low</Text>
            </View>
            <View style={[styles.guidePill, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
              <Text style={[styles.guidePillText, { color: '#0284c7' }]}>1k-2k: Mid</Text>
            </View>
            <View style={[styles.guidePill, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
              <Text style={[styles.guidePillText, { color: '#d97706' }]}>2k-3.5k: High</Text>
            </View>
            <View style={[styles.guidePill, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <Text style={[styles.guidePillText, { color: '#dc2626' }]}>3.5k-4.5k: Severe</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 4 Visualization Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'count' && styles.tabButtonActive]}
          onPress={() => setActiveTab('count')}
        >
          <Text style={[styles.tabText, activeTab === 'count' && styles.tabTextActive]}>
            Counts & Avg
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'consecutive' && styles.tabButtonActive]}
          onPress={() => setActiveTab('consecutive')}
        >
          <Text style={[styles.tabText, activeTab === 'consecutive' && styles.tabTextActive]}>
            Consecutive
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'length' && styles.tabButtonActive]}
          onPress={() => setActiveTab('length')}
        >
          <Text style={[styles.tabText, activeTab === 'length' && styles.tabTextActive]}>
            Snore Length
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'rms' && styles.tabButtonActive]}
          onPress={() => setActiveTab('rms')}
        >
          <Text style={[styles.tabText, activeTab === 'rms' && styles.tabTextActive]}>
            RMS Level
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={styles.contentBody}
        onLayout={(e) => setChartWidth(Math.floor(e.nativeEvent.layout.width))}
      >
        {/* ============================================================== */}
        {/* TAB 1: SNORE COUNT TABLE & AVERAGE BY DATE RANGE                */}
        {/* ============================================================== */}
        {activeTab === 'count' ? (
          <View>
            {/* Filter buttons */}
            <View style={styles.subFilterRow}>
              <Text style={styles.subFilterLabel}>Date range:</Text>
              <TouchableOpacity
                style={[styles.rangePill, rangeMode === '7' && styles.rangePillActive]}
                onPress={() => setRangeMode('7')}
              >
                <Text style={[styles.rangePillText, rangeMode === '7' && styles.rangePillTextActive]}>
                  Last 7 Days
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rangePill, rangeMode === 'custom' && styles.rangePillActive]}
                onPress={() => setRangeMode('custom')}
              >
                <Text style={[styles.rangePillText, rangeMode === 'custom' && styles.rangePillTextActive]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            {/* Custom Date Range Picker */}
            {rangeMode === 'custom' ? (
              <View style={styles.customDateRow}>
                <TouchableOpacity
                  style={styles.customDateButton}
                  onPress={() => openCalendarPicker('start')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.customDateLabel}>START DATE</Text>
                  <View style={styles.customDateValueRow}>
                    <FontAwesome5 name="calendar-day" size={11} color="#0284c7" />
                    <Text style={styles.customDateValue}>{moment(customStartDate).format('MMM D, YYYY')}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.customDateArrow}>
                  <FontAwesome5 name="arrow-right" size={10} color="#94a3b8" />
                </View>

                <TouchableOpacity
                  style={styles.customDateButton}
                  onPress={() => openCalendarPicker('end')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.customDateLabel}>END DATE</Text>
                  <View style={styles.customDateValueRow}>
                    <FontAwesome5 name="calendar-day" size={11} color="#0284c7" />
                    <Text style={styles.customDateValue}>{moment(customEndDate).format('MMM D, YYYY')}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* KPI Summary Strip */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>TOTAL SNORES</Text>
                <Text style={styles.kpiValue}>{dateRangeStats.totalCount}</Text>
                <Text style={styles.kpiHint}>{dateRangeStats.daysInRange} days</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>DAILY AVERAGE</Text>
                <Text style={[styles.kpiValue, { color: '#0284c7' }]}>{dateRangeStats.averageCount}</Text>
                <Text style={styles.kpiHint}>snores / night</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>RANGE PEAK</Text>
                <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>{dateRangeStats.peakCount}</Text>
                <Text style={styles.kpiHint}>{dateRangeStats.peakDate ? moment(dateRangeStats.peakDate).format('MMM D') : '—'}</Text>
              </View>
            </View>

            {/* Visual Bar Chart with Average Line */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Daily snore frequency vs range average ({dateRangeStats.averageCount})</Text>
              {chartWidth > 0 && dateRangeStats.rows.length > 0 ? (
                <Svg width={chartWidth - 28} height={140}>
                  {/* Background horizontal lines */}
                  <Line x1={PAD_LEFT} y1={20} x2={chartWidth - PAD_RIGHT} y2={20} stroke="#e2e8f0" strokeWidth={1} />
                  <Line x1={PAD_LEFT} y1={70} x2={chartWidth - PAD_RIGHT} y2={70} stroke="#f1f5f9" strokeWidth={1} />
                  <Line x1={PAD_LEFT} y1={115} x2={chartWidth - PAD_RIGHT} y2={115} stroke="#cbd5e1" strokeWidth={1} />

                  {/* Average Reference Line (Dashed) */}
                  {(() => {
                    const maxCount = Math.max(1, dateRangeStats.peakCount, dateRangeStats.averageCount * 1.3);
                    const avgY = 115 - (dateRangeStats.averageCount / maxCount) * 95;
                    return (
                      <>
                        <Line
                          x1={PAD_LEFT}
                          y1={avgY}
                          x2={chartWidth - PAD_RIGHT}
                          y2={avgY}
                          stroke="#0284c7"
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                        />
                        <SvgText
                          x={PAD_LEFT - 6}
                          y={avgY + 3}
                          fill="#0284c7"
                          fontSize="9"
                          textAnchor="end"
                        >
                          Avg
                        </SvgText>
                      </>
                    );
                  })()}

                  {/* Bars for each day */}
                  {dateRangeStats.rows.map((row, idx) => {
                    const maxCount = Math.max(1, dateRangeStats.peakCount, dateRangeStats.averageCount * 1.3);
                    const plotW = chartWidth - PAD_LEFT - PAD_RIGHT;
                    const step = plotW / dateRangeStats.rows.length;
                    const barW = Math.max(4, Math.min(18, step * 0.65));
                    const x = PAD_LEFT + idx * step + (step - barW) / 2;
                    const barH = (row.count / maxCount) * 95;
                    const y = 115 - barH;
                    const isPeak = row.count === dateRangeStats.peakCount && row.count > 0;
                    const isAboveAvg = row.count > dateRangeStats.averageCount;

                    return (
                      <React.Fragment key={row.date}>
                        <Rect
                          x={x}
                          y={y}
                          width={barW}
                          height={Math.max(2, barH)}
                          fill={isPeak ? '#ef4444' : isAboveAvg ? '#f59e0b' : '#38bdf8'}
                          rx={3}
                        />
                        {/* Show count on bar for active dates */}
                        {barW >= 10 && row.count > 0 ? (
                          <SvgText
                            x={x + barW / 2}
                            y={Math.max(14, y - 4)}
                            fill="#475569"
                            fontSize="9"
                            textAnchor="middle"
                          >
                            {row.count}
                          </SvgText>
                        ) : null}
                        {/* Day label every few steps */}
                        {idx % Math.ceil(dateRangeStats.rows.length / 7) === 0 ? (
                          <SvgText
                            x={x + barW / 2}
                            y={130}
                            fill="#64748b"
                            fontSize="8"
                            textAnchor="middle"
                          >
                            {moment(row.date).format('M/D')}
                          </SvgText>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </Svg>
              ) : null}
            </View>

            {/* Snore Count Table */}
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 2 }]}>DATE</Text>
                <Text style={[styles.thCell, { flex: 1.5, textAlign: 'center' }]}>SNORES</Text>
                <Text style={[styles.thCell, { flex: 2, textAlign: 'right' }]}>VS AVG ({dateRangeStats.averageCount})</Text>
              </View>

              {dateRangeStats.rows.slice(-10).reverse().map((row) => {
                const diff = row.diffFromAvg;
                const isOver = diff > 0;
                return (
                  <View key={row.date} style={styles.tableRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.tdDate}>{row.displayDate}</Text>
                      <Text style={styles.tdDayName}>{moment(row.date).format('dddd')}</Text>
                    </View>
                    <View style={{ flex: 1.5, alignItems: 'center' }}>
                      <Text style={styles.tdValue}>{row.count}</Text>
                    </View>
                    <View style={{ flex: 2, alignItems: 'flex-end' }}>
                      <View style={[styles.diffBadge, isOver ? styles.diffBadgeOver : styles.diffBadgeUnder]}>
                        <Text style={[styles.diffText, { color: isOver ? '#c2410c' : '#047857' }]}>
                          {isOver ? `+${diff}` : diff === 0 ? 'Same' : `${diff}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ============================================================== */}
        {/* TAB 2: SNORE CONSECUTIVE LEVEL & PEAK AVERAGE                  */}
        {/* ============================================================== */}
        {activeTab === 'consecutive' ? (
          <View>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>PEAK STREAK</Text>
                <Text style={[styles.kpiValue, { color: consecutiveStats.peakStreakInfo.color }]}>
                  {consecutiveStats.peakStreakReached} Snores
                </Text>
                <Text style={styles.kpiHint}>{consecutiveStats.peakStreakInfo.label} level</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>AVG PEAK LEVEL</Text>
                <Text style={[styles.kpiValue, { color: '#0284c7' }]}>
                  {consecutiveStats.averagePeakStreakAcrossNights}
                </Text>
                <Text style={styles.kpiHint}>{consecutiveStats.averagePeakStreakLabel} across sessions</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>STREAK AVG</Text>
                <Text style={styles.kpiValue}>{consecutiveStats.streakSessionAverage}</Text>
                <Text style={styles.kpiHint}>snores / window</Text>
              </View>
            </View>

            {/* Proportion Bar */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Streak level distribution across all recorded events</Text>
              <View style={styles.proportionBar}>
                {consecutiveStats.rows.map((r) => (
                  <View
                    key={r.streakLevel}
                    style={{
                      flex: Math.max(1, r.percentage),
                      backgroundColor: r.color,
                      height: 14,
                    }}
                  />
                ))}
              </View>
              <View style={styles.proportionLegend}>
                {consecutiveStats.rows.map((r) => (
                  <View key={r.streakLevel} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: r.color }]} />
                    <Text style={styles.legendText}>
                      {r.streakName}: {r.percentage}% ({r.eventCount})
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Consecutive Level Table */}
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 2.5 }]}>CONSECUTIVE LEVEL</Text>
                <Text style={[styles.thCell, { flex: 1.5, textAlign: 'center' }]}>COUNT</Text>
                <Text style={[styles.thCell, { flex: 1.5, textAlign: 'center' }]}>AVG RMS</Text>
                <Text style={[styles.thCell, { flex: 2, textAlign: 'right' }]}>ACTION</Text>
              </View>

              {consecutiveStats.rows.map((row) => (
                <View key={row.streakLevel} style={styles.tableRow}>
                  <View style={{ flex: 2.5 }}>
                    <View style={[styles.tierTag, { backgroundColor: row.bg, borderColor: row.color }]}>
                      <Text style={[styles.tierTagText, { color: row.color }]}>{row.streakName}</Text>
                    </View>
                    <Text style={styles.tdSubText}>{row.label} intensity</Text>
                  </View>

                  <View style={{ flex: 1.5, alignItems: 'center' }}>
                    <Text style={styles.tdValue}>{row.eventCount}</Text>
                    <Text style={styles.tdSubText}>{row.percentage}%</Text>
                  </View>

                  <View style={{ flex: 1.5, alignItems: 'center' }}>
                    <Text style={styles.tdValue}>{row.avgRms}</Text>
                    <Text style={styles.tdSubText}>{row.avgDuration}s dur</Text>
                  </View>

                  <View style={{ flex: 2, alignItems: 'flex-end' }}>
                    <Text style={[styles.actionTag, { color: row.streakLevel === 'high' ? '#dc2626' : '#64748b' }]}>
                      {row.streakLevel === 'high' ? 'Inflates pillow' : 'Monitored'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ============================================================== */}
        {/* TAB 3: SNORE LENGTH VISUALIZATION (0-60s PER SECONDS)          */}
        {/* ============================================================== */}
        {activeTab === 'length' ? (
          <View>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>AVERAGE LENGTH</Text>
                <Text style={[styles.kpiValue, { color: '#0284c7' }]}>
                  {lengthStats.avgDurationSec}s
                </Text>
                <Text style={styles.kpiHint}>per snore</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>LONGEST SNORE</Text>
                <Text style={[styles.kpiValue, { color: '#dc2626' }]}>
                  {lengthStats.longestDurationSec}s
                </Text>
                <Text style={styles.kpiHint}>continuous chain</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>TOTAL DURATION</Text>
                <Text style={styles.kpiValue}>
                  {Math.round(lengthStats.totalDurationSec / 60)}m
                </Text>
                <Text style={styles.kpiHint}>{lengthStats.totalDurationSec}s total</Text>
              </View>
            </View>

            {/* Duration Tier Bars */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Snore duration tiers (0-60 secs)</Text>
              <View style={{ gap: 8, marginTop: 4 }}>
                {lengthStats.rows.map((tier) => (
                  <View key={tier.level}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={[styles.barLabel, { color: tier.color }]}>
                        {tier.range} · {tier.category} ({tier.label})
                      </Text>
                      <Text style={styles.barValue}>{tier.eventCount} ({tier.percentage}%)</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.max(2, tier.percentage)}%`,
                            backgroundColor: tier.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Duration Table */}
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 2 }]}>DURATION TIER</Text>
                <Text style={[styles.thCell, { flex: 2.2 }]}>CLASSIFICATION</Text>
                <Text style={[styles.thCell, { flex: 1.4, textAlign: 'center' }]}>COUNT</Text>
                <Text style={[styles.thCell, { flex: 1.6, textAlign: 'right' }]}>TOTAL TIME</Text>
              </View>

              {lengthStats.rows.map((row) => (
                <View key={row.level} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <View style={[styles.tierTag, { backgroundColor: row.bg, borderColor: row.color }]}>
                      <Text style={[styles.tierTagText, { color: row.color }]}>{row.range}</Text>
                    </View>
                    <Text style={styles.tdSubText}>{row.label} level</Text>
                  </View>

                  <View style={{ flex: 2.2 }}>
                    <Text style={styles.tdCategory}>{row.category}</Text>
                  </View>

                  <View style={{ flex: 1.4, alignItems: 'center' }}>
                    <Text style={styles.tdValue}>{row.eventCount}</Text>
                    <Text style={styles.tdSubText}>{row.percentage}%</Text>
                  </View>

                  <View style={{ flex: 1.6, alignItems: 'flex-end' }}>
                    <Text style={styles.tdValue}>{row.totalDurationSec}s</Text>
                    <Text style={styles.tdSubText}>{row.avgDurationSec}s avg</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ============================================================== */}
        {/* TAB 4: RMS CHART AND LEVELS THROUGHOUT SESSION                 */}
        {/* ============================================================== */}
        {activeTab === 'rms' ? (
          <View>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>PEAK RMS</Text>
                <Text style={[styles.kpiValue, { color: rmsStats.peakRmsInfo.color }]}>
                  {rmsStats.peakRms}
                </Text>
                <Text style={styles.kpiHint}>{rmsStats.peakRmsInfo.label} intensity</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>SESSION AVG RMS</Text>
                <Text style={[styles.kpiValue, { color: rmsStats.avgRmsInfo.color }]}>
                  {rmsStats.avgRms}
                </Text>
                <Text style={styles.kpiHint}>{rmsStats.avgRmsInfo.label} baseline</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>EVENTS MEASURED</Text>
                <Text style={styles.kpiValue}>{rmsStats.totalEvents}</Text>
                <Text style={styles.kpiHint}>snore spikes</Text>
              </View>
            </View>

            {/* Svg RMS Timeline with Colored Tier Zones */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>RMS sound levels across session (0-4500 RMS zones)</Text>

              {chartWidth > 0 && rmsStats.timelinePoints.length > 0 ? (
                <Svg width={chartWidth - 28} height={160}>
                  {/* Zone Backgrounds */}
                  {/* Severe Zone: 3500-4500 */}
                  <Rect x={PAD_LEFT} y={15} width={chartWidth - PAD_LEFT - PAD_RIGHT} height={30} fill="rgba(239, 68, 68, 0.08)" />
                  {/* High Zone: 2000-3500 */}
                  <Rect x={PAD_LEFT} y={45} width={chartWidth - PAD_LEFT - PAD_RIGHT} height={40} fill="rgba(245, 158, 11, 0.08)" />
                  {/* Mid Zone: 1000-2000 */}
                  <Rect x={PAD_LEFT} y={85} width={chartWidth - PAD_LEFT - PAD_RIGHT} height={30} fill="rgba(2, 132, 199, 0.08)" />
                  {/* Low Zone: 0-1000 */}
                  <Rect x={PAD_LEFT} y={115} width={chartWidth - PAD_LEFT - PAD_RIGHT} height={25} fill="rgba(16, 185, 129, 0.08)" />

                  {/* Horizontal Threshold Dividers */}
                  <Line x1={PAD_LEFT} y1={15} x2={chartWidth - PAD_RIGHT} y2={15} stroke="#ef4444" strokeWidth={0.8} strokeDasharray="3 3" />
                  <Line x1={PAD_LEFT} y1={45} x2={chartWidth - PAD_RIGHT} y2={45} stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="3 3" />
                  <Line x1={PAD_LEFT} y1={85} x2={chartWidth - PAD_RIGHT} y2={85} stroke="#0284c7" strokeWidth={0.8} strokeDasharray="3 3" />
                  <Line x1={PAD_LEFT} y1={115} x2={chartWidth - PAD_RIGHT} y2={115} stroke="#10b981" strokeWidth={0.8} strokeDasharray="3 3" />
                  <Line x1={PAD_LEFT} y1={140} x2={chartWidth - PAD_RIGHT} y2={140} stroke="#cbd5e1" strokeWidth={1} />

                  {/* Zone Axis Labels */}
                  <SvgText x={PAD_LEFT - 4} y={30} fill="#dc2626" fontSize="8" textAnchor="end">Severe</SvgText>
                  <SvgText x={PAD_LEFT - 4} y={65} fill="#d97706" fontSize="8" textAnchor="end">High</SvgText>
                  <SvgText x={PAD_LEFT - 4} y={100} fill="#0284c7" fontSize="8" textAnchor="end">Mid</SvgText>
                  <SvgText x={PAD_LEFT - 4} y={130} fill="#059669" fontSize="8" textAnchor="end">Low</SvgText>

                  {/* Connecting Polyline */}
                  {(() => {
                    const points = rmsStats.timelinePoints.slice(-16);
                    if (points.length < 2) return null;
                    const plotW = chartWidth - PAD_LEFT - PAD_RIGHT;
                    const coords = points.map((p, i) => {
                      const x = PAD_LEFT + (i / (points.length - 1)) * plotW;
                      const y = 140 - Math.min(1, p.rms / 4500) * 125;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    }).join(' ');

                    return (
                      <Polyline
                        points={coords}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    );
                  })()}

                  {/* Event Dots */}
                  {(() => {
                    const points = rmsStats.timelinePoints.slice(-16);
                    const plotW = chartWidth - PAD_LEFT - PAD_RIGHT;
                    return points.map((p, i) => {
                      const x = PAD_LEFT + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
                      const y = 140 - Math.min(1, p.rms / 4500) * 125;
                      const isPeak = p.rms === rmsStats.peakRms && p.rms > 0;
                      return (
                        <React.Fragment key={`${p.timestamp}-${i}`}>
                          <Circle
                            cx={x}
                            cy={y}
                            r={isPeak ? 5 : 3.5}
                            fill={p.color}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                          />
                          {isPeak ? (
                            <Circle
                              cx={x}
                              cy={y}
                              r={8}
                              fill="none"
                              stroke={p.color}
                              strokeWidth={1.5}
                            />
                          ) : null}
                          {/* Label every 4th point */}
                          {i % 4 === 0 || i === points.length - 1 ? (
                            <SvgText
                              x={x}
                              y={152}
                              fill="#64748b"
                              fontSize="8"
                              textAnchor="middle"
                            >
                              {p.timeLabel}
                            </SvgText>
                          ) : null}
                        </React.Fragment>
                      );
                    });
                  })()}
                </Svg>
              ) : null}
            </View>

            {/* RMS Tier Table */}
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { flex: 2 }]}>RMS TIER</Text>
                <Text style={[styles.thCell, { flex: 2.2 }]}>SOUND LEVEL</Text>
                <Text style={[styles.thCell, { flex: 1.4, textAlign: 'center' }]}>COUNT</Text>
                <Text style={[styles.thCell, { flex: 1.6, textAlign: 'right' }]}>AVG RMS</Text>
              </View>

              {rmsStats.rows.map((row) => (
                <View key={row.level} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <View style={[styles.tierTag, { backgroundColor: row.bg, borderColor: row.color }]}>
                      <Text style={[styles.tierTagText, { color: row.color }]}>{row.range}</Text>
                    </View>
                    <Text style={styles.tdSubText}>{row.label} intensity</Text>
                  </View>

                  <View style={{ flex: 2.2 }}>
                    <Text style={styles.tdCategory}>{row.category}</Text>
                  </View>

                  <View style={{ flex: 1.4, alignItems: 'center' }}>
                    <Text style={styles.tdValue}>{row.eventCount}</Text>
                    <Text style={styles.tdSubText}>{row.percentage}%</Text>
                  </View>

                  <View style={{ flex: 1.6, alignItems: 'flex-end' }}>
                    <Text style={styles.tdValue}>{row.avgRms}</Text>
                    <Text style={styles.tdSubText}>peak {row.maxRmsInTier}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* Calendar Modal for Custom Date Range */}
      <Modal transparent visible={calendarPicker !== null} animationType="fade" onRequestClose={() => setCalendarPicker(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCalendarPicker(null)}>
          <View style={styles.calendar}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => setPickerMonth((m) => m.clone().subtract(1, 'month'))}>
                <FontAwesome5 name="chevron-left" size={12} color="#334155" />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>{pickerMonth.format('MMMM YYYY')}</Text>
              <TouchableOpacity onPress={() => setPickerMonth((m) => m.clone().add(1, 'month'))}>
                <FontAwesome5 name="chevron-right" size={12} color="#334155" />
              </TouchableOpacity>
            </View>
            <View style={styles.dayGrid}>
              {Array.from({ length: pickerMonth.clone().startOf('month').day() }, (_, i) => (
                <View key={`blank-${i}`} style={styles.dayCell} />
              ))}
              {Array.from({ length: pickerMonth.clone().daysInMonth() }, (_, i) => {
                const day = i + 1;
                const cellDate = pickerMonth.clone().date(day).format('YYYY-MM-DD');
                const isSelected = calendarPicker === 'start' ? cellDate === customStartDate : cellDate === customEndDate;
                return (
                  <TouchableOpacity
                    key={`custom-day-${day}`}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                    onPress={() => selectCustomDay(day)}
                  >
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dce7ef',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#0284c7',
    fontWeight: '600',
    marginBottom: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#142c43',
  },
  classificationGuide: {
    backgroundColor: '#f8fbff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
    paddingBottom: 6,
  },
  guideLabelCol: {
    width: 78,
  },
  guideLabelTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  guideLabelHint: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '400',
  },
  guideTiers: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  guidePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
  },
  guidePillText: {
    fontSize: 9.5,
    fontWeight: '500',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
    gap: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0284c7',
    fontWeight: '600',
  },
  contentBody: {
    width: '100%',
  },
  subFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  subFilterLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginRight: 2,
  },
  rangePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  rangePillActive: {
    backgroundColor: '#0284c7',
  },
  rangePillText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#475569',
  },
  rangePillTextActive: {
    color: '#ffffff',
  },
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    marginBottom: 12,
    gap: 8,
  },
  customDateButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  customDateLabel: {
    fontSize: 8.5,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  customDateValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customDateValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  customDateArrow: {
    paddingHorizontal: 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 6, 12, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  calendar: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 5,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
  },
  dayText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '600',
    color: '#142c43',
  },
  kpiHint: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 1,
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fbff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  thCell: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tdDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#142c43',
  },
  tdDayName: {
    fontSize: 9.5,
    color: '#64748b',
  },
  tdValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#142c43',
  },
  tdSubText: {
    fontSize: 9,
    color: '#64748b',
  },
  tdCategory: {
    fontSize: 11,
    fontWeight: '500',
    color: '#334155',
  },
  diffBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  diffBadgeOver: {
    backgroundColor: '#ffedd5',
  },
  diffBadgeUnder: {
    backgroundColor: '#d1fae5',
  },
  diffText: {
    fontSize: 10,
    fontWeight: '600',
  },
  proportionBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    marginBottom: 8,
  },
  proportionLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '500',
  },
  tierTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 0.8,
    marginBottom: 2,
  },
  tierTagText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  actionTag: {
    fontSize: 10,
    fontWeight: '500',
  },
  barTrack: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  barValue: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#334155',
  },
});

