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

    return {
      labels,
      datasets: [
        {
          data: eventCounts,
          strokeWidth: 3,
          color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`, // Electric Indigo
          fillShadowGradient: '#6366f1',
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
    backgroundColor: '#161722',
    backgroundGradientFrom: '#161722',
    backgroundGradientTo: '#1e1f2f',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(156, 163, 175, 0.8)`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '5',
      strokeWidth: '2.5',
      stroke: '#6366f1',
      fill: '#0a0b10',
    },
    propsForBackgroundLines: {
      strokeDasharray: '4',
      stroke: 'rgba(255, 255, 255, 0.04)',
    },
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleIndicator} />
        <Text style={styles.title}>{title}</Text>
      </View>

<<<<<<< HEAD
      <View style={styles.chartWrapper}>
        {chartType === 'line' ? (
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
=======
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
          yAxisLabel=""
          yAxisSuffix=""
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
>>>>>>> fbc19acd13655bc5980b18ad0e039e6e8d27ad05

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#6366f1' }]} />
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
    backgroundColor: 'rgba(26, 27, 38, 0.75)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
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
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    overflow: 'hidden',
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
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
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
    color: '#9ca3af',
    fontWeight: '500',
  },
  legendDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  legendHelp: {
    fontSize: 10,
    color: '#6b7280',
    fontStyle: 'italic',
  },
});
