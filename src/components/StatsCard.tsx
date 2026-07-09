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
  const isSeverity = !!severity;
  const severityColor = severity ? getSeverityColor(severity) : '#6366f1';
  const displayLabel = severity ? getSeverityLabel(severity) : '';

  return (
    <View style={[
      styles.card,
      isSeverity && {
        borderColor: severityColor + '40',
        borderWidth: 1.5,
      }
    ]}>
      {/* Dynamic top-left color bar for visual cue */}
      <View style={[styles.glowBar, { backgroundColor: severityColor }]} />

      <View style={styles.header}>
        <View style={[
          styles.iconContainer, 
          { backgroundColor: severityColor + '1a' }
        ]}>
          <FontAwesome5 name={icon} size={15} color={severityColor} />
        </View>
        <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </Text>
      </View>

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
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '47%', // Allows side-by-side grid layout
    margin: 4,
    backgroundColor: 'rgba(26, 27, 38, 0.75)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 4,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 13,
    color: '#9ca3af',
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
