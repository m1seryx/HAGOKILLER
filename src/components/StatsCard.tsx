import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getSeverityColor, getSeverityLabel } from '../utils/recommendations';
import { colors } from '../constants/theme';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: string;
  severity?: 'normal' | 'bad' | 'danger';
  unit?: string;
  style?: StyleProp<ViewStyle>;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  icon = 'chart-bar',
  severity,
  unit = '',
  style,
}) => {
  const accent = severity ? getSeverityColor(severity) : colors.accent;
  const severityLabel = severity ? getSeverityLabel(severity) : '';

  return (
    <View style={[styles.card, { borderColor: accent + '33' }, style]}>
      <View style={[styles.iconWrap, { backgroundColor: accent + '18' }]}>
        <FontAwesome5 name={icon} size={14} color={accent} />
      </View>

      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </Text>

      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>

      {severity ? (
        <View style={[styles.badge, { backgroundColor: accent + '22' }]}>
          <Text style={[styles.badgeText, { color: accent }]}>{severityLabel}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  unit: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    fontWeight: '600',
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
