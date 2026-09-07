import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { DailyStats } from '../types';
import { getSeverityColor } from '../utils/recommendations';
import { colors } from '../constants/theme';

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
      legend: ['Snore Events'],
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

  const chartWidth = Dimensions.get('window').width - 48; // Adjusted padding

  const commonChartConfig = {
    backgroundColor: colors.chartGradientFrom,
    backgroundGradientFrom: colors.chartGradientFrom,
    backgroundGradientTo: colors.chartGradientTo,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '5',
      strokeWidth: '2.5',
      stroke: '#0ea5e9',
      fill: colors.chartFill,
    },
    propsForBackgroundLines: {
      strokeDasharray: '4',
      stroke: 'rgba(15, 23, 42, 0.08)',
    },
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleIndicator} />
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.chartWrapper}>
        {weeklyData.length === 0 ? (
          <Text style={styles.emptyChart}>No snore pattern data yet</Text>
        ) : chartType === 'line' ? (
          <LineChart
            data={chartData}
            width={chartWidth}
            height={200}
            chartConfig={commonChartConfig}
            style={styles.chart}
            withDots={true}
            withInnerLines={true}
            withOuterLines={true}
            withVerticalLabels={true}
            bezier
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
          <Text style={styles.legendLabel}>Snore Events (Count)</Text>
        </View>
        <View style={styles.legendDivider} />
        <Text style={styles.legendHelp}>Pulse shows severity spikes</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  titleIndicator: {
    width: 4,
    height: 14,
    backgroundColor: '#0ea5e9',
    borderRadius: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 120,
  },
  emptyChart: {
    color: colors.textMuted,
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
    borderTopColor: colors.border,
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
    color: colors.textMuted,
    fontWeight: '500',
  },
  legendDivider: {
    width: 1,
    height: 10,
    backgroundColor: colors.border,
  },
  legendHelp: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
