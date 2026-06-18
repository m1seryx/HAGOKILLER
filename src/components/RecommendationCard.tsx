import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { RecommendationData } from '../types';
import { getSeverityColor } from '../utils/recommendations';

interface RecommendationCardProps {
  data: RecommendationData;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({ data }) => {
  const severityColor = getSeverityColor(data.severityLevel);
  const severityIcons: Record<string, string> = {
    normal: 'check-circle',
    bad: 'exclamation-circle',
    danger: 'times-circle',
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: severityColor + '20', borderLeftColor: severityColor }]}>
        <FontAwesome5 name={severityIcons[data.severityLevel]} size={28} color={severityColor} style={styles.icon} />
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: severityColor }]}>Sleep Health Status</Text>
          <Text style={styles.trendMessage}>{data.trendMessage}</Text>
        </View>
      </View>

      {/* Main Recommendation */}
      <View style={styles.mainRecommendation}>
        <Text style={styles.mainText}>{data.recommendation}</Text>
      </View>

      {/* Action Items */}
      {data.actionItems.length > 0 && (
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Recommended Actions:</Text>
          {data.actionItems.map((item, index) => (
            <View key={index} style={styles.actionItem}>
              <FontAwesome5 name="circle" size={6} color="#6b7280" style={styles.bullet} solid />
              <Text style={styles.actionText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Warning Banner for Danger Level */}
      {data.severityLevel === 'danger' && (
        <View style={styles.warningBanner}>
          <FontAwesome5 name="exclamation-triangle" size={18} color="#f59e0b" style={styles.warningIcon} />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Important Notice</Text>
            <Text style={styles.warningText}>
              This information is not a medical diagnosis. Please consult with a healthcare
              professional for proper evaluation and treatment.
            </Text>
          </View>
        </View>
      )}

      {/* Footer Message */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <FontAwesome5 name="lightbulb" size={12} color="#3b82f6" style={styles.footerIcon} solid />
          <Text style={styles.footerText}>
            Continue using your Smart Pillow to track long-term trends and monitor your sleep health.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#2d2d44', marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderLeftWidth: 4 },
  icon: { marginRight: 12 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  trendMessage: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },
  mainRecommendation: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#2d2d44', borderBottomWidth: 1, borderBottomColor: '#3d3d5c',
  },
  mainText: { fontSize: 14, color: '#e5e7eb', lineHeight: 20 },
  actionsContainer: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#2d2d44' },
  actionsTitle: { fontSize: 13, fontWeight: '600', color: '#d1d5db', marginBottom: 12 },
  actionItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  bullet: { marginTop: 5, marginRight: 10, width: 10 },
  actionText: { flex: 1, fontSize: 13, color: '#d1d5db', lineHeight: 18 },
  warningBanner: {
    flexDirection: 'row', backgroundColor: '#dc262640',
    borderTopWidth: 1, borderTopColor: '#ef4444',
    borderBottomWidth: 1, borderBottomColor: '#2d2d44',
    padding: 12, alignItems: 'flex-start',
  },
  warningIcon: { marginRight: 10, marginTop: 2 },
  warningContent: { flex: 1 },
  warningTitle: { fontSize: 12, fontWeight: '700', color: '#ef4444', marginBottom: 4 },
  warningText: { fontSize: 11, color: '#fca5a5', lineHeight: 16 },
  footer: { padding: 12, backgroundColor: '#0f172a' },
  footerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  footerIcon: { marginRight: 8, marginTop: 2 },
  footerText: { flex: 1, fontSize: 12, color: '#9ca3af', lineHeight: 16 },
});
