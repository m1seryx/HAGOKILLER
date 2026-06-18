import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getSeverityColor, getSeverityLabel } from '../utils/recommendations';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: string;
  severity?: 'normal' | 'bad' | 'danger';
  unit?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  label, value, icon = 'chart-bar', severity, unit = '',
}) => {
  const iconColor = severity ? getSeverityColor(severity) : '#3b82f6';

  return (
    <View style={[styles.card, {
      backgroundColor: severity ? getSeverityColor(severity) + '26' : '#2d2d44',
      borderLeftColor: severity ? getSeverityColor(severity) : '#3b82f6',
    }]}>
      <View style={styles.header}>
        <FontAwesome5 name={icon} size={16} color={iconColor} style={styles.icon} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.value}>
          {value}
          {unit && <Text style={styles.unit}>{unit}</Text>}
        </Text>
        {severity && <Text style={[styles.severityLabel, { color: getSeverityColor(severity) }]}>{getSeverityLabel(severity)}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12, padding: 16, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: '#3b82f6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  icon: { marginRight: 8, width: 20 },
  label: { fontSize: 12, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  content: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  value: { fontSize: 28, fontWeight: 'bold', color: '#ffffff' },
  unit: { fontSize: 14, color: '#9ca3af', marginLeft: 4 },
  severityLabel: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2 },
});
