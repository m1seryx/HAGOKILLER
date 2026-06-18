import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
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
  const chartData = useMemo(() => {
    const labels = weeklyData.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 3);
    });

    const eventCounts = weeklyData.map((d) => d.totalSnoreEvents);
    const avgDurations = weeklyData.map((d) => d.averageDuration / 10); // Scale down for visibility

    return {
      labels,
      datasets: [
        {
          data: eventCounts,
          strokeWidth: 2,
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue
          fillShadowGradient: 'rgba(59, 130, 246, 0.2)',
          fillShadowGradientOpacity: 1,
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

  const chartWidth = Dimensions.get('window').width - 40;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {chartType === 'line' ? (
        <LineChart
          data={chartData}
          width={chartWidth}
          height={220}
          chartConfig={{
            backgroundColor: '#1a1a2e',
            backgroundGradientFrom: '#1a1a2e',
            backgroundGradientTo: '#2d2d44',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
            propsForDots: {
              r: '6',
              strokeWidth: '2',
              stroke: '#3b82f6',
              fill: '#1a1a2e',
            },
            propsForBackgroundLines: {
              strokeDasharray: '0',
              stroke: `rgba(156, 163, 175, 0.1)`,
            },
          }}
          style={styles.chart}
          withDots={true}
          withInnerLines={true}
          withOuterLines={true}
          withVerticalLabels={true}
        />
      ) : (
        <BarChart
          data={barChartData}
          width={chartWidth}
          height={220}
          chartConfig={{
            backgroundColor: '#1a1a2e',
            backgroundGradientFrom: '#1a1a2e',
            backgroundGradientTo: '#2d2d44',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
            propsForBackgroundLines: {
              strokeDasharray: '0',
              stroke: `rgba(156, 163, 175, 0.1)`,
            },
          }}
          style={styles.chart}
        />
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#3b82f6' }]} />
          <Text style={styles.legendLabel}>Snore Events</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  chart: {
    marginVertical: 0,
    borderRadius: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
