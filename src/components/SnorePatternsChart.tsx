import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { FontAwesome5 } from '@expo/vector-icons';
import { DailyStats } from '../types';
import { getSeverityColor } from '../utils/recommendations';

interface SnorePatternsChartProps {
  weeklyData: DailyStats[];
  chartType?: 'line' | 'bar';
  title?: string;
}

export const SnorePatternsChart: React.FC<SnorePatternsChartProps> = ({
  weeklyData,
  chartType = 'line',
  title = 'Snoring Pattern',
}) => {
  const [chartWidth, setChartWidth] = useState(0);
  const chartData = useMemo(() => {
    const labels = weeklyData.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 3);
    });

    const eventCounts = weeklyData.map((d) => d.totalSnoreEvents);

    return {
      labels,
      datasets: [
        {
          data: eventCounts,
          strokeWidth: 3,
          color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`, // Sky blue
          fillShadowGradient: '#0ea5e9',
          fillShadowGradientOpacity: 0.15,
        },
      ],
    };
  }, [weeklyData]);

  const summary = useMemo(() => {
    const total = weeklyData.reduce((sum, day) => sum + day.totalSnoreEvents, 0);
    const peak = weeklyData.reduce<DailyStats | null>(
      (best, day) => (!best || day.totalSnoreEvents > best.totalSnoreEvents ? day : best),
      null,
    );
    return {
      total,
      average: weeklyData.length ? Math.round((total / weeklyData.length) * 10) / 10 : 0,
      peakValue: peak?.totalSnoreEvents ?? 0,
      peakLabel: peak
        ? new Date(peak.date).toLocaleDateString('en-US', { weekday: 'short' })
        : '—',
    };
  }, [weeklyData]);

  const barChartData = useMemo(() => {
    const labels = weeklyData.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 3);
    });

    const eventCounts = weeklyData.map((d) => d.totalSnoreEvents);

    return {
      labels,
      datasets: [
        {
          data: eventCounts,
          colors: weeklyData.map(
            (d) => (opacity: number) =>
              getSeverityColor(d.severity) + Math.round(opacity * 255).toString(16).padStart(2, '0')
          ),
        },
      ],
    };
  }, [weeklyData]);


  const commonChartConfig = {
    backgroundColor: '#f8fbff',
    backgroundGradientFrom: '#f8fbff',
    backgroundGradientTo: '#eef8fd',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(82, 103, 123, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#38bdf8',
      fill: '#ffffff',
    },
    propsForBackgroundLines: {
      strokeDasharray: '3 5',
      stroke: 'rgba(2, 132, 199, 0.12)',
    },
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <FontAwesome5 name="chart-line" size={13} color="#7dd3fc" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>SLEEP ANALYTICS</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{weeklyData.length} DAYS</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>TOTAL</Text>
          <Text style={styles.summaryValue}>{summary.total}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>DAILY AVG</Text>
          <Text style={styles.summaryValue}>{summary.average}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>PEAK · {summary.peakLabel.toUpperCase()}</Text>
          <Text style={styles.summaryValue}>{summary.peakValue}</Text>
        </View>
      </View>

      <View style={styles.chartWrapper} onLayout={({ nativeEvent }) => setChartWidth(Math.floor(nativeEvent.layout.width))}>
        {weeklyData.length === 0 ? (
          <Text style={styles.emptyChart}>No snore pattern data yet</Text>
        ) : chartWidth <= 0 ? null : chartType === 'line' ? (
          <LineChart
            data={chartData}
            width={chartWidth}
            height={200}
            chartConfig={commonChartConfig}
            style={styles.chart}
            withDots={true}
            withInnerLines={true}
            withOuterLines={false}
            withVerticalLines={false}
            withVerticalLabels={true}
            fromZero
            segments={4}
          />
        ) : (
          <BarChart
            data={barChartData}
            width={chartWidth}
            height={200}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={commonChartConfig}
            style={styles.chart}
            withInnerLines={true}
            fromZero
          />
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#0ea5e9' }]} />
          <Text style={styles.legendLabel}>Snore events</Text>
        </View>
        <Text style={styles.legendHelp}>Count per night</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dce7ef',
    shadowColor: '#164e73',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#7dd3fc', fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginBottom: 2 },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#142c43',
  },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, backgroundColor: '#f0f9ff' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#38bdf8' },
  liveText: { color: '#52677b', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 12, borderRadius: 14, backgroundColor: '#f4f9fd' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { color: '#6b8298', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  summaryValue: { color: '#142c43', fontSize: 19, fontWeight: '900' },
  summaryDivider: { width: 1, height: 28, backgroundColor: '#dce7ef' },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 150,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#dce7ef',
  },
  emptyChart: {
    color: '#52677b',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 36,
  },
  chart: {
    marginVertical: 4,
    borderRadius: 12,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#dce7ef',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 11,
    color: '#52677b',
    fontWeight: '600',
  },
  legendHelp: {
    fontSize: 10,
    color: '#7890a5',
    fontWeight: '600',
  },
});
