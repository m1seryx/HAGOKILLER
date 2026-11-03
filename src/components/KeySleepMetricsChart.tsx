import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { FontAwesome5 } from '@expo/vector-icons';
import moment from 'moment';
import { SleepEvent } from '../types';
import { colors } from '../constants/theme';

const PRIMARY = '#0ea5e9';
const COMPARE = '#f59e0b';
const BETTER = '#0f766e';
const WORSE = '#c2410c';
const PLOT_HEIGHT = 150;
const AXIS_HEIGHT = 28;
const PAD_LEFT = 42;
const PAD_RIGHT = 10;
const PAD_TOP = 12;

interface KeySleepMetricsChartProps {
  events: SleepEvent[];
}

interface SnorePoint {
  key: number;
  axisLabel: string;
  peakLabel: string;
  rms: number | null;
}

interface NightSummary {
  count: number;
  rms: number | null;
  peakLabel: string | null;
  peakRms: number | null;
  peakKey: number | null;
}

/** Evening hours stay before midnight so a night reads left to right. */
function nightKey(stamp: moment.Moment) {
  const seconds = stamp.hours() * 3600 + stamp.minutes() * 60 + stamp.seconds();
  return stamp.hours() < 12 ? seconds + 24 * 3600 : seconds;
}

function pointsForDate(events: SleepEvent[], date: string): SnorePoint[] {
  return events
    .filter((event) => moment(event.timestamp).format('YYYY-MM-DD') === date)
    .map((event) => {
      const stamp = moment(event.timestamp);
      return {
        key: nightKey(stamp),
        axisLabel: stamp.format('h:mma'),
        peakLabel: stamp.format('h:mm A'),
        rms: typeof event.rms === 'number' ? event.rms : null,
      };
    })
    .sort((left, right) => left.key - right.key);
}

function summarize(points: SnorePoint[]): NightSummary {
  const measured = points.filter((point): point is SnorePoint & { rms: number } => point.rms != null);
  if (points.length === 0 || measured.length === 0) {
    return { count: points.length, rms: null, peakLabel: null, peakRms: null, peakKey: null };
  }
  const peak = measured.reduce((best, point) => (point.rms > best.rms ? point : best));
  const rms = measured.reduce((sum, point) => sum + point.rms, 0) / measured.length;
  return {
    count: points.length,
    rms,
    peakLabel: peak.peakLabel,
    peakRms: peak.rms,
    peakKey: peak.key,
  };
}

function formatRms(value: number) {
  return String(Math.round(value));
}

function countChange(current: number, previous: number) {
  const diff = current - previous;
  if (diff === 0) return { text: 'Same count', tone: 'same' as const };
  if (diff < 0) return { text: `${Math.abs(diff)} fewer`, tone: 'better' as const };
  return { text: `${diff} more`, tone: 'worse' as const };
}

function rmsChange(current: number | null, previous: number | null) {
  if (current == null || previous == null) return null;
  const diff = Math.round(current) - Math.round(previous);
  if (diff === 0) return { text: 'Same RMS', tone: 'same' as const };
  if (diff < 0) return { text: `${Math.abs(diff)} lower`, tone: 'better' as const };
  return { text: `${diff} higher`, tone: 'worse' as const };
}

function labelIndexes(count: number, maxLabels: number) {
  if (count <= maxLabels) return Array.from({ length: count }, (_, index) => index);
  const chosen = new Set<number>([0, count - 1]);
  const step = (count - 1) / (maxLabels - 1);
  for (let index = 1; index < maxLabels - 1; index += 1) chosen.add(Math.round(index * step));
  return [...chosen].sort((left, right) => left - right);
}

export const KeySleepMetricsChart: React.FC<KeySleepMetricsChartProps> = ({ events }) => {
  const [primaryDate, setPrimaryDate] = useState(moment().format('YYYY-MM-DD'));
  const [compareDate, setCompareDate] = useState(moment().subtract(1, 'day').format('YYYY-MM-DD'));
  const [picker, setPicker] = useState<null | 'primary' | 'compare'>(null);
  const [pickerMonth, setPickerMonth] = useState(moment());
  const [chartWidth, setChartWidth] = useState(0);

  const primaryPoints = useMemo(() => pointsForDate(events, primaryDate), [events, primaryDate]);
  const comparePoints = useMemo(() => pointsForDate(events, compareDate), [events, compareDate]);
  const primary = summarize(primaryPoints);
  const compare = summarize(comparePoints);
  const countDelta = countChange(primary.count, compare.count);
  const rmsDelta = rmsChange(primary.rms, compare.rms);
  const peakDelta = rmsChange(primary.peakRms, compare.peakRms);

  const plot = useMemo(() => {
    const measured = [...primaryPoints, ...comparePoints].filter((point): point is SnorePoint & { rms: number } => point.rms != null);
    const combined = [...measured].sort((left, right) => left.key - right.key);
    if (combined.length === 0 || chartWidth <= 0) return null;
    const minKey = combined[0].key;
    const maxKey = combined[combined.length - 1].key;
    const sameMoment = maxKey === minKey;
    const origin = sameMoment ? minKey - 30 : minKey;
    const span = sameMoment ? 60 : maxKey - minKey;
    const plotWidth = Math.max(chartWidth - PAD_LEFT - PAD_RIGHT, 1);
    const yMax = Math.max(...combined.map((point) => point.rms), 1);
    const place = (point: SnorePoint & { rms: number }) => ({
      ...point,
      x: PAD_LEFT + ((point.key - origin) / span) * plotWidth,
      y: PAD_TOP + (1 - point.rms / yMax) * PLOT_HEIGHT,
    });
    const uniqueTimes = combined.filter((point, index, all) => all.findIndex((item) => item.key === point.key) === index);
    const labels: Array<SnorePoint & { x: number; y: number }> = [];
    labelIndexes(uniqueTimes.length, 6).forEach((index) => {
      const point = place(uniqueTimes[index]);
      const previous = labels[labels.length - 1];
      if (!previous || point.x - previous.x > 52) labels.push(point);
    });
    return {
      primary: primaryPoints.filter((point): point is SnorePoint & { rms: number } => point.rms != null).map(place),
      compare: comparePoints.filter((point): point is SnorePoint & { rms: number } => point.rms != null).map(place),
      labels,
      yMax: Math.round(yMax),
      yMid: Math.round(yMax / 2),
      baseline: PAD_TOP + PLOT_HEIGHT,
      mid: PAD_TOP + PLOT_HEIGHT / 2,
    };
  }, [primaryPoints, comparePoints, chartWidth]);

  const openPicker = (which: 'primary' | 'compare') => {
    setPickerMonth(moment(which === 'primary' ? primaryDate : compareDate));
    setPicker(which);
  };

  const selectDay = (day: number) => {
    const selected = pickerMonth.clone().date(day).format('YYYY-MM-DD');
    if (picker === 'primary') setPrimaryDate(selected);
    if (picker === 'compare') setCompareDate(selected);
    setPicker(null);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <FontAwesome5 name="chart-line" size={13} color={colors.accentDark} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>KEY SLEEP METRICS</Text>
          <Text style={styles.title}>Count, RMS, and peak time</Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateButton} onPress={() => openPicker('primary')} activeOpacity={0.7}>
          <View style={[styles.swatch, { backgroundColor: PRIMARY }]} />
          <View style={styles.dateCopy}>
            <Text style={styles.dateLabel}>DATE</Text>
            <Text style={styles.dateValue}>{moment(primaryDate).format('MMM D')}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateButton} onPress={() => openPicker('compare')} activeOpacity={0.7}>
          <View style={[styles.swatch, { backgroundColor: COMPARE }]} />
          <View style={styles.dateCopy}>
            <Text style={styles.dateLabel}>COMPARE</Text>
            <Text style={styles.dateValue}>{moment(compareDate).format('MMM D')}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHead}>
          <Text style={[styles.tableCell, styles.tableLabel]} />
          <Text style={[styles.tableCell, styles.tableHeadText]}>{moment(primaryDate).format('MMM D')}</Text>
          <Text style={[styles.tableCell, styles.tableHeadText]}>{moment(compareDate).format('MMM D')}</Text>
        </View>
        <MetricRow
          label="Snores"
          primary={String(primary.count)}
          compare={String(compare.count)}
          change={compare.count === 0 && primary.count === 0 ? null : countDelta}
        />
        <MetricRow
          label="RMS"
          primary={primary.rms == null ? '—' : formatRms(primary.rms)}
          compare={compare.rms == null ? '—' : formatRms(compare.rms)}
          change={rmsDelta}
        />
        <MetricRow
          label="Peak"
          primary={primary.peakLabel ?? '—'}
          compare={compare.peakLabel ?? '—'}
          primaryHint={primary.peakRms == null ? undefined : `RMS ${formatRms(primary.peakRms)}`}
          compareHint={compare.peakRms == null ? undefined : `RMS ${formatRms(compare.peakRms)}`}
          change={peakDelta ? { ...peakDelta, text: `Peak ${peakDelta.text}` } : null}
        />
      </View>

      <View
        style={styles.chartWrap}
        onLayout={({ nativeEvent }) => setChartWidth(Math.floor(nativeEvent.layout.width))}
      >
        {chartWidth <= 0 ? (
          <View style={{ height: PAD_TOP + PLOT_HEIGHT + AXIS_HEIGHT }} />
        ) : plot ? (
          <View style={{ height: PAD_TOP + PLOT_HEIGHT + AXIS_HEIGHT }}>
            <Svg width={chartWidth} height={PAD_TOP + PLOT_HEIGHT}>
              <Line x1={PAD_LEFT} y1={plot.mid} x2={chartWidth - PAD_RIGHT} y2={plot.mid} stroke="rgba(14, 165, 233, 0.12)" strokeWidth={1} />
              <Line x1={PAD_LEFT} y1={plot.baseline} x2={chartWidth - PAD_RIGHT} y2={plot.baseline} stroke="rgba(14, 165, 233, 0.2)" strokeWidth={1} />
              <RmsLine color={COMPARE} points={plot.compare} peakKey={compare.peakKey} />
              <RmsLine color={PRIMARY} points={plot.primary} peakKey={primary.peakKey} />
            </Svg>
            <Text style={[styles.yLabel, { top: PAD_TOP - 2 }]}>{plot.yMax}</Text>
            <Text style={[styles.yLabel, { top: plot.mid - 6 }]}>{plot.yMid}</Text>
            <Text style={[styles.yLabel, { top: plot.baseline - 8 }]}>0</Text>
            {plot.labels.map((point) => (
              <Text
                key={point.key}
                style={[styles.xLabel, { left: Math.min(Math.max(point.x - 28, 0), chartWidth - 56) }]}
              >
                {point.axisLabel}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>
            {primaryPoints.length + comparePoints.length > 0 ? 'No RMS recorded on these dates' : 'No snores on these dates'}
          </Text>
        )}
      </View>

      <Text style={styles.axisNote}>Each dot is a snore. Height is its RMS. The ring is the loudest.</Text>

      <Modal transparent visible={picker !== null} animationType="fade" onRequestClose={() => setPicker(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPicker(null)}>
          <View style={styles.calendar}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => setPickerMonth((month) => month.clone().subtract(1, 'month'))}>
                <FontAwesome5 name="chevron-left" size={12} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>{pickerMonth.format('MMMM YYYY')}</Text>
              <TouchableOpacity onPress={() => setPickerMonth((month) => month.clone().add(1, 'month'))}>
                <FontAwesome5 name="chevron-right" size={12} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.dayGrid}>
              {Array.from({ length: pickerMonth.clone().startOf('month').day() }, (_, index) => (
                <View key={`blank-${index}`} style={styles.dayCell} />
              ))}
              {Array.from({ length: pickerMonth.daysInMonth() }, (_, index) => {
                const day = index + 1;
                const date = pickerMonth.clone().date(day).format('YYYY-MM-DD');
                const selected = date === (picker === 'primary' ? primaryDate : compareDate);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayCell, selected && styles.dayCellSelected]}
                    onPress={() => selectDay(day)}
                  >
                    <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text>
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

function RmsLine({
  color,
  points,
  peakKey,
}: {
  color: string;
  points: Array<SnorePoint & { rms: number; x: number; y: number }>;
  peakKey: number | null;
}) {
  if (points.length === 0) return null;
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const loudest = Math.max(...points.map((point) => point.rms));
  return (
    <>
      {points.length > 1 ? (
        <Polyline points={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      ) : null}
      {points.map((point, index) => {
        const isPeak = point.rms === loudest
          && index === points.findIndex((item) => item.key === peakKey && item.rms === loudest);
        return (
          <Circle
            key={`${color}-${index}`}
            cx={point.x}
            cy={point.y}
            r={isPeak ? 5 : 3.5}
            fill={isPeak ? '#ffffff' : color}
            stroke={color}
            strokeWidth={isPeak ? 2.5 : 1}
          />
        );
      })}
    </>
  );
}

function MetricRow({
  label,
  primary,
  compare,
  primaryHint,
  compareHint,
  change,
}: {
  label: string;
  primary: string;
  compare: string;
  primaryHint?: string;
  compareHint?: string;
  change: { text: string; tone: 'better' | 'worse' | 'same' } | null;
}) {
  return (
    <View style={styles.tableRow}>
      <View style={styles.tableLabelWrap}>
        <Text style={styles.tableLabel}>{label}</Text>
        {change ? (
          <Text style={[styles.delta, change.tone === 'better' && styles.deltaBetter, change.tone === 'worse' && styles.deltaWorse]}>
            {change.text}
          </Text>
        ) : null}
      </View>
      <View style={styles.tableCell}>
        <Text style={styles.tableValue} numberOfLines={1}>{primary}</Text>
        {primaryHint ? <Text style={styles.tableHint}>{primaryHint}</Text> : null}
      </View>
      <View style={styles.tableCell}>
        <Text style={styles.tableValueMuted} numberOfLines={1}>{compare}</Text>
        {compareHint ? <Text style={styles.tableHint}>{compareHint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundMuted,
    marginRight: 10,
  },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8fbff',
  },
  swatch: { width: 8, height: 28, borderRadius: 4, marginRight: 8 },
  dateCopy: { flex: 1 },
  dateLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  dateValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
    backgroundColor: '#f8fbff',
  },
  tableHead: { flexDirection: 'row', paddingTop: 6, paddingBottom: 2 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableLabelWrap: { flex: 1.1, minWidth: 0, paddingRight: 6 },
  tableCell: { flex: 1, minWidth: 0 },
  tableLabel: { color: colors.text, fontSize: 12, fontWeight: '800' },
  tableHeadText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  tableValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  tableValueMuted: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  tableHint: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  delta: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  deltaBetter: { color: BETTER },
  deltaWorse: { color: WORSE },
  chartWrap: { minHeight: 168, marginTop: 4 },
  yLabel: {
    position: 'absolute',
    left: 0,
    width: 38,
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  xLabel: {
    position: 'absolute',
    bottom: 0,
    width: 56,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 48,
    textAlign: 'center',
  },
  axisNote: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 8 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 6, 12, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  calendar: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: { backgroundColor: colors.accent, borderRadius: 10 },
  dayText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  dayTextSelected: { color: '#ffffff', fontWeight: '800' },
});
