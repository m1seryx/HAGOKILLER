import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getSeverityColor, getSeverityLabel } from '../utils/recommendations';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: string;
  severity?: 'normal' | 'bad' | 'danger';
  unit?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  icon = '📊',
  severity,
  unit = '',
}) => {
  const backgroundColor = severity ? getSeverityColor(severity) : '#2d2d44';
  const opacity = severity ? 0.15 : 1;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: severity ? getSeverityColor(severity) + '26' : '#2d2d44',
          borderLeftColor: severity ? getSeverityColor(severity) : '#3b82f6',
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.value}>
          {value}
          {unit && <Text style={styles.unit}>{unit}</Text>}
        </Text>
        {severity && <Text style={styles.severityLabel}>{getSeverityLabel(severity)}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
  },
  label: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  unit: {
    fontSize: 14,
    color: '#9ca3af',
    marginLeft: 4,
  },
  severityLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
