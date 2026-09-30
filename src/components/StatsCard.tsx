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
  label, value, icon = 'chart-bar', severity, unit = '', style,
}) => {
  const isSeverity = !!severity;
  const severityColor = severity ? getSeverityColor(severity) : '#0ea5e9';
  const displayLabel = severity ? getSeverityLabel(severity) : '';

  return (
    <View style={[
      styles.card,
      isSeverity && {
        borderColor: severityColor + '40',
        borderWidth: 1.5,
      },
      style,
    ]}>
      {/* Dynamic top-left color bar for visual cue */}
      <View style={[styles.glowBar, { backgroundColor: severityColor }]} />

      <View style={styles.content}>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {value}
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </Text>
        
        {isSeverity && (
          <View style={[styles.severityBadge, { backgroundColor: severityColor + '20' }]}>
            <Text style={[styles.severityText, { color: severityColor }]}>
              {displayLabel}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.header}>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
        <View style={[
          styles.iconContainer,
          { backgroundColor: severityColor + '1a' }
        ]}>
          <FontAwesome5 name={icon} size={15} color={severityColor} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  glowBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.9,
  },
  header: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'right',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
  },
  value: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'center',
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
