import React from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { RecommendationData } from '../types';
import { getSeverityColor } from '../utils/recommendations';
import { colors } from '../constants/theme';

interface RecommendationCardProps {
  data: RecommendationData;
  aiStatus?: 'idle' | 'loading' | 'ready' | 'error';
  aiEnabled?: boolean;
  personalizedActionsOnly?: boolean;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  data,
  aiStatus = 'idle',
  aiEnabled = false,
  personalizedActionsOnly = false,
}) => {
  const severityColor = getSeverityColor(data.severityLevel);
  const hasGeneratedActions = data.source === 'on_device' || data.source === 'ai';
  const showActions = data.actionItems.length > 0 && (
    !personalizedActionsOnly || hasGeneratedActions || data.severityLevel === 'danger'
  );
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
        {aiEnabled ? (
          <View style={styles.aiStatusRow}>
            <FontAwesome5
              name={aiStatus === 'ready' ? 'magic' : aiStatus === 'error' ? 'exclamation-circle' : 'circle-notch'}
              size={11}
              color={aiStatus === 'error' ? colors.textMuted : colors.accent}
            />
            <Text style={styles.aiStatusText}>
              {aiStatus === 'loading'
                ? 'Personalizing guidance...'
                : aiStatus === 'ready'
                  ? data.source === 'on_device'
                    ? 'Private on-device AI guidance'
                    : 'AI-personalized wellness guidance'
                  : aiStatus === 'error'
                    ? 'Offline guidance shown'
                    : 'Personalized guidance available'}
            </Text>
          </View>
        ) : null}
        {data.dailyTip ? (
          <View style={styles.dailyTipBanner}>
            <FontAwesome5 name="lightbulb" size={12} color="#fbbf24" style={{ marginRight: 8 }} />
            <Text style={styles.dailyTipText}>Today's tip: {data.dailyTip}</Text>
          </View>
        ) : null}
        {data.progressMessage ? (
          <View style={styles.progressBanner}>
            <FontAwesome5 name="chart-line" size={12} color="#047857" style={{ marginRight: 8 }} />
            <Text style={styles.progressText}>{data.progressMessage}</Text>
          </View>
        ) : null}
        <Text style={styles.mainText}>{data.recommendation}</Text>
        <Text style={[styles.mainText, { marginTop: 8, fontStyle: 'italic', color: '#333333', fontSize: 11 }]}>
          If symptoms persist, consult your doctor.
        </Text>
      </View>

      {/* Action Items List */}
      {showActions && (
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>
            {data.severityLevel === 'danger' ? 'Safety actions' : 'Therapeutic wellness actions'}
          </Text>
          {data.actionItems.map((item, index) => (
            <View key={index} style={styles.actionItem}>
              <View style={styles.checkWrapper}>
                <FontAwesome5 name="check" size={9} color="#0ea5e9" />
              </View>
              <Text style={styles.actionText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {personalizedActionsOnly && !showActions && data.severityLevel !== 'danger' ? (
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Therapeutic wellness actions</Text>
          <View style={styles.pendingActions}>
            {aiStatus === 'loading' ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <FontAwesome5
                name={aiStatus === 'error' ? 'exclamation-circle' : 'microchip'}
                size={14}
                color={colors.textMuted}
              />
            )}
            <Text style={styles.pendingActionsText}>
              {aiStatus === 'loading'
                ? 'Generating personalized actions from your daily check-in...'
                : aiStatus === 'error'
                  ? 'The on-device model could not generate actions. Please try the assessment again.'
                  : 'Download the on-device AI model above to generate personalized actions.'}
            </Text>
          </View>
        </View>
      ) : null}

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
          <FontAwesome5 name="info-circle" size={12} color="#0ea5e9" style={styles.footerIcon} />
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderLeftWidth: 4,
    backgroundColor: colors.surfaceMuted,
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
    color: colors.textMuted,
    fontWeight: '500',
  },
  mainRecommendation: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  aiStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  aiStatusText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  dailyTipBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  dailyTipText: {
    flex: 1,
    fontSize: 12,
    color: '#b45309',
    lineHeight: 17,
  },
  progressBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  progressText: {
    flex: 1,
    color: '#047857',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  mainText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  actionsContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
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
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    marginRight: 10,
  },
  actionText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  pendingActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pendingActionsText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(239, 68, 68, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    backgroundColor: colors.backgroundSoft,
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
    color: colors.textMuted,
    lineHeight: 15,
  },
});
