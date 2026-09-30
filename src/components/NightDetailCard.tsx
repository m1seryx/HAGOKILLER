import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import moment from 'moment';
import { NightDetail } from '../types';
import { getSeverityColor } from '../utils/recommendations';
import { formatPeakWindow, getNightLabel } from '../utils/statsCalculator';

interface NightDetailCardProps {
  night: NightDetail;
  nightKeys: string[];
  selectedKey: string;
  onSelectNight: (nightKey: string) => void;
}

export const NightDetailCard: React.FC<NightDetailCardProps> = ({
  night,
  nightKeys,
  selectedKey,
  onSelectNight,
}) => {
  const { width } = useWindowDimensions();
  const severityColor = getSeverityColor(night.severity);

  const visibleHours = useMemo(
    () => night.hourly.filter((h) => h.hour >= 21 || h.hour <= 8),
    [night.hourly],
  );

  const chartWidth = Math.min(width - 28, 560);

  const chartData = useMemo(() => {
    const labels = visibleHours.map((h) => moment().hour(h.hour).minute(0).format('ha'));
    const counts = visibleHours.map((h) => h.count);
    // chart-kit crashes on empty/all-zero in some cases — keep a floor dataset shape
    const data = counts.every((c) => c === 0) ? counts.map(() => 0) : counts;

    return {
      labels,
      datasets: [
        {
          data: data.length ? data : [0],
          colors: visibleHours.map((bucket) => {
            const isPeak = bucket.hour === night.peakHour && bucket.count > 0;
            return (opacity = 1) => {
              if (bucket.count === 0) return `rgba(14, 165, 233, ${opacity * 0.18})`;
              if (isPeak) {
                // Severity color with opacity
                const hex = severityColor.replace('#', '');
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
              }
              return `rgba(14, 165, 233, ${opacity * 0.85})`;
            };
          }),
        },
      ],
    };
  }, [visibleHours, night.peakHour, severityColor]);

  const chartConfig = {
    backgroundColor: '#0b1834',
    backgroundGradientFrom: '#0b1834',
    backgroundGradientTo: '#132b52',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(203, 225, 255, ${opacity})`,
    barPercentage: 0.65,
    propsForBackgroundLines: {
      strokeDasharray: '4',
      stroke: 'rgba(191, 219, 254, 0.14)',
    },
    style: { borderRadius: 16 },
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleIndicator} />
          <Text style={styles.title}>Night Detail</Text>
        </View>
        <Text style={styles.subtitle}>Peak snore times for this sleep night</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.nightChips}
      >
        {nightKeys.map((key) => {
          const active = key === selectedKey;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelectNight(key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {getNightLabel(key)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.peakCard, { borderColor: `${severityColor}55` }]}>
        <View style={[styles.peakIcon, { backgroundColor: `${severityColor}22` }]}>
          <FontAwesome5 name="clock" size={16} color={severityColor} />
        </View>
        <View style={styles.peakCopy}>
          <Text style={styles.peakEyebrow}>Peak snoring time</Text>
          <Text style={[styles.peakValue, { color: severityColor }]}>
            {night.totalSnoreEvents > 0 ? night.peakWindowLabel : 'No peak recorded'}
          </Text>
          <Text style={styles.peakMeta}>
            {night.totalSnoreEvents > 0
              ? `${night.hourly.find((h) => h.hour === night.peakHour)?.count ?? 0} events occurred during this hour`
              : 'A peak time will appear after the pillow records a snoring event.'}
          </Text>
        </View>
      </View>

      {night.totalSnoreEvents === 0 ? (
        <View style={styles.emptyWrap}>
          <FontAwesome5 name="moon" size={18} color="#7dd3fc" />
          <Text style={styles.emptyTitle}>No snoring recorded</Text>
          <Text style={styles.emptyHint}>This night has no logged snore events yet.</Text>
        </View>
      ) : (
        <>
          {night.topPeakHours.length > 1 ? (
            <View style={styles.topPeaksRow}>
              {night.topPeakHours.map((hour, index) => {
                const count = night.hourly.find((h) => h.hour === hour)?.count ?? 0;
                return (
                  <View key={`${hour}-${index}`} style={styles.topPeakPill}>
                    <Text style={styles.topPeakRank}>#{index + 1}</Text>
                    <Text style={styles.topPeakTime}>{formatPeakWindow(hour)}</Text>
                    <Text style={styles.topPeakCount}>{count}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={styles.timelineLabel}>Overnight timeline</Text>
          <View style={styles.chartWrapper}>
            <BarChart
              data={chartData}
              width={chartWidth}
              height={200}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={chartConfig}
              style={styles.chart}
              fromZero
              showValuesOnTopOfBars
              withCustomBarColorFromData
              flatColor
              withInnerLines
            />
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#38bdf8' }]} />
              <Text style={styles.legendLabel}>Hourly snores</Text>
            </View>
            <View style={styles.legendDivider} />
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: severityColor }]} />
              <Text style={styles.legendLabel}>Peak hour</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{night.totalSnoreEvents}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{night.interventionCount}</Text>
              <Text style={styles.statLabel}>Inflates</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{night.averageDuration}s</Text>
              <Text style={styles.statLabel}>Avg</Text>
            </View>
          </View>

          {night.firstSnoreAt && night.lastSnoreAt ? (
            <Text style={styles.spanText}>
              First {moment(night.firstSnoreAt).format('h:mm A')} · Last{' '}
              {moment(night.lastSnoreAt).format('h:mm A')}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 8,
    marginBottom: 16,
  },
  header: { marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  titleIndicator: {
    width: 4,
    height: 14,
    backgroundColor: '#38bdf8',
    borderRadius: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#eef7ff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  subtitle: { fontSize: 12, color: '#a9bfdf' },
  nightChips: { gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#15294c',
    borderWidth: 1,
    borderColor: '#294a78',
  },
  chipActive: {
    backgroundColor: '#123d68',
    borderColor: '#38bdf8',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: '#a9bfdf' },
  chipTextActive: { color: '#e0f2fe' },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#eef7ff' },
  emptyHint: { fontSize: 12, color: '#a9bfdf', textAlign: 'center' },
  peakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#132747',
    borderWidth: 1,
    marginBottom: 12,
  },
  peakIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peakCopy: { flex: 1 },
  peakEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a9bfdf',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  peakValue: { fontSize: 18, fontWeight: '800' },
  peakMeta: { fontSize: 12, color: '#a9bfdf', marginTop: 2 },
  topPeaksRow: { gap: 8, marginBottom: 14 },
  topPeakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#102342',
  },
  topPeakRank: { fontSize: 11, fontWeight: '800', color: '#7dd3fc', width: 22 },
  topPeakTime: { flex: 1, fontSize: 12, fontWeight: '600', color: '#eef7ff' },
  topPeakCount: { fontSize: 12, fontWeight: '700', color: '#a9bfdf' },
  timelineLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a9bfdf',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartWrapper: {
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0b1834',
  },
  chart: {
    marginVertical: 4,
    borderRadius: 12,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendColor: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: '#a9bfdf', fontWeight: '500' },
  legendDivider: { width: 1, height: 10, backgroundColor: '#294a78' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#294a78',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#eef7ff' },
  statLabel: { fontSize: 11, color: '#a9bfdf', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: '#294a78' },
  spanText: {
    marginTop: 10,
    fontSize: 11,
    color: '#a9bfdf',
    textAlign: 'center',
  },
});
