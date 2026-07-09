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
      <View style={[styles.header, { borderLeftColor: severityColor }]}>
        <View style={[styles.headerIconContainer, { backgroundColor: severityColor + '20' }]}>
          <FontAwesome5 name={severityIcons[data.severityLevel]} size={20} color={severityColor} />
        </View>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: severityColor }]}>Sleep Health Assessment</Text>
          <Text style={styles.trendMessage}>{data.trendMessage}</Text>
        </View>
      </View>

      {/* Main Recommendation Text */}
      <View style={styles.mainRecommendation}>
        <Text style={styles.mainText}>{data.recommendation}</Text>
        <Text style={[styles.mainText, { marginTop: 8, fontStyle: 'italic', color: '#9ca3af', fontSize: 11 }]}>
          If symptoms persist, consult your doctor.
        </Text>
      </View>

      {/* Action Items List */}
      {data.actionItems.length > 0 && (
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Therapeutic Action Items</Text>
          {data.actionItems.map((item, index) => (
            <View key={index} style={styles.actionItem}>
              <View style={styles.checkWrapper}>
                <FontAwesome5 name="check" size={9} color="#6366f1" />
              </View>
              <Text style={styles.actionText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Warning Alert Panel */}
      {data.severityLevel === 'danger' && (
        <View style={styles.warningBanner}>
          <View style={styles.warningIconWrapper}>
            <FontAwesome5 name="exclamation-triangle" size={14} color="#ef4444" />
          </View>
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Medical Disclaimer</Text>
            <Text style={styles.warningText}>
              This report is powered by sensor-based classification and is not a medical diagnostic tool. 
              Consult a certified physician or ENT specialist for sleep disorder evaluation.
            </Text>
          </View>
        </View>
      )}

      {/* Sleep Tech Tip Footer */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <FontAwesome5 name="info-circle" size={12} color="#6366f1" style={styles.footerIcon} />
          <Text style={styles.footerText}>
            Keep your IoT Smart Pillow paired over BLE to collect ongoing sleep patterns and update daily scores.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(26, 27, 38, 0.75)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderLeftWidth: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  trendMessage: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  mainRecommendation: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  mainText: {
    fontSize: 13,
    color: '#e5e7eb',
    lineHeight: 18,
  },
  actionsContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  actionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  checkWrapper: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    marginRight: 10,
  },
  actionText: {
    flex: 1,
    fontSize: 13,
    color: '#d1d5db',
    lineHeight: 18,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(239, 68, 68, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    padding: 14,
    alignItems: 'flex-start',
    gap: 10,
  },
  warningIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 3,
  },
  warningText: {
    fontSize: 11,
    color: 'rgba(239, 68, 68, 0.8)',
    lineHeight: 16,
  },
  footer: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerIcon: {
    marginRight: 8,
  },
  footerText: {
    flex: 1,
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 15,
  },
});
