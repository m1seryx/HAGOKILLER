import React from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { ActionFeedbackValue, RecommendationData } from '../types';
import { getSeverityColor } from '../utils/recommendations';
import { colors } from '../constants/theme';

interface RecommendationCardProps {
  data: RecommendationData;
  aiStatus?: 'idle' | 'loading' | 'ready' | 'error';
  aiEnabled?: boolean;
  aiError?: string;
  onRetryAi?: () => void;
  personalizedActionsOnly?: boolean;
  guideName?: string;
  guideImage?: ImageSourcePropType;
  actionFeedback?: Record<number, ActionFeedbackValue>;
  onActionFeedback?: (index: number, value: ActionFeedbackValue) => void;
  onRegenerateAction?: (index: number) => void;
  regeneratingActionIndex?: number | null;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  data,
  aiStatus = 'idle',
  aiEnabled = false,
  aiError,
  onRetryAi,
  personalizedActionsOnly = false,
  guideName,
  guideImage,
  actionFeedback = {},
  onActionFeedback,
  onRegenerateAction,
  regeneratingActionIndex = null,
}) => {
  const severityColor = getSeverityColor(data.severityLevel);
  const hasGeneratedActions = data.source === 'on_device' || data.source === 'ai';
  const showingImmediateActions = personalizedActionsOnly
    && (aiStatus === 'loading' || aiStatus === 'error')
    && data.actionItems.length > 0;
  const showActions = data.actionItems.length > 0 && (
    !personalizedActionsOnly
    || hasGeneratedActions
    || data.severityLevel === 'danger'
    || showingImmediateActions
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
        {!guideImage ? (
          <View style={[styles.headerIconContainer, { backgroundColor: severityColor + '20' }]}>
            <FontAwesome5 name={severityIcons[data.severityLevel]} size={20} color={severityColor} />
          </View>
        ) : null}
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: severityColor }]}>
            {guideName ? `${guideName}'s Sleep Guidance` : 'Sleep Health Assessment'}
          </Text>
          <Text style={styles.trendMessage}>{data.trendMessage}</Text>
        </View>
        {guideImage ? (
          <Image
            source={guideImage}
            style={styles.guideImage}
            resizeMode="contain"
            accessibilityLabel={`${guideName || 'Sleep guide'} presenting your wellness guidance`}
          />
        ) : null}
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
                    : data.source === 'rules'
                      ? 'Saved offline wellness guidance'
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
        {data.recommendationReasons?.length ? (
          <View style={styles.reasonPanel}>
            <View style={styles.reasonHeading}>
              <FontAwesome5 name="search" size={11} color={colors.accentDark} />
              <Text style={styles.reasonTitle}>Why Hagosaur suggested this</Text>
            </View>
            {data.recommendationReasons.slice(0, 4).map((reason) => (
              <View key={reason} style={styles.reasonRow}>
                <View style={styles.reasonDot} />
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={[styles.mainText, { marginTop: 8, fontStyle: 'italic', color: '#333333', fontSize: 11 }]}>
          If symptoms persist, consult your doctor.
        </Text>
      </View>

      {/* Action Items List */}
      {showActions && (
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>
            {data.severityLevel === 'danger'
              ? 'Safety actions'
              : guideName
                ? `${guideName}'s therapeutic wellness actions`
                : 'Therapeutic wellness actions'}
          </Text>
          {showingImmediateActions ? (
            <View style={styles.offlineNotice}>
              {aiStatus === 'loading' ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <FontAwesome5 name="shield-alt" size={12} color={colors.accent} />
              )}
              <Text style={styles.offlineNoticeText}>
                {aiStatus === 'loading'
                  ? 'Personalizing in the background. You can use these safe actions now.'
                  : aiError || 'Safe offline actions are shown while local AI is unavailable.'}
              </Text>
            </View>
          ) : null}
          {data.actionItems.map((item, index) => (
            <View key={index} style={styles.actionItem}>
              <View style={styles.checkWrapper}>
                <FontAwesome5 name="check" size={9} color="#0ea5e9" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionText}>{item}</Text>
                {data.actionExplanations?.[index] ? (
                  <Text style={styles.actionExplanation}>{data.actionExplanations[index]}</Text>
                ) : null}
                {onActionFeedback ? (
                  <View style={styles.feedbackRow}>
                    {([
                      ['helpful', 'Helpful', 'thumbs-up'],
                      ['not_helpful', 'Not helpful', 'thumbs-down'],
                      ['couldnt_do', 'Couldn’t do', 'times-circle'],
                    ] as const).map(([value, label, icon]) => {
                      const active = actionFeedback[index] === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.feedbackChip, active && styles.feedbackChipActive]}
                          onPress={() => onActionFeedback(index, value)}
                        >
                          <FontAwesome5 name={icon} size={9} color={active ? colors.onAccent : colors.textMuted} />
                          <Text style={[styles.feedbackChipText, active && styles.feedbackChipTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {onRegenerateAction ? (
                      <TouchableOpacity
                        style={styles.regenerateChip}
                        onPress={() => onRegenerateAction(index)}
                        disabled={regeneratingActionIndex !== null}
                      >
                        {regeneratingActionIndex === index ? (
                          <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                          <FontAwesome5 name="sync-alt" size={9} color={colors.accent} />
                        )}
                        <Text style={styles.regenerateChipText}>Replace</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
          {showingImmediateActions && aiStatus === 'error' && onRetryAi ? (
            <TouchableOpacity style={styles.retryButton} onPress={onRetryAi} activeOpacity={0.8}>
              <FontAwesome5 name="redo" size={11} color={colors.onAccent} />
              <Text style={styles.retryButtonText}>Try AI again</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {personalizedActionsOnly && !showActions && data.severityLevel !== 'danger' ? (
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>
            {guideName ? `${guideName}'s therapeutic wellness actions` : 'Therapeutic wellness actions'}
          </Text>
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
            <View style={styles.pendingActionsContent}>
              <Text style={styles.pendingActionsText}>
                {aiStatus === 'loading'
                  ? 'Generating personalized actions from your daily check-in...'
                  : aiStatus === 'error'
                    ? aiError || 'The on-device model could not generate actions.'
                    : `Download the on-device AI model ${guideName ? 'below' : 'above'} to generate personalized actions.`}
              </Text>
              {aiStatus === 'error' && onRetryAi ? (
                <TouchableOpacity style={styles.retryButton} onPress={onRetryAi} activeOpacity={0.8}>
                  <FontAwesome5 name="redo" size={11} color={colors.onAccent} />
                  <Text style={styles.retryButtonText}>Try again</Text>
                </TouchableOpacity>
              ) : null}
            </View>
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
  guideImage: {
    width: 76,
    height: 88,
    marginTop: -10,
    marginBottom: -10,
    marginLeft: 8,
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
  reasonPanel: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  reasonTitle: { color: colors.text, fontSize: 11, fontWeight: '800' },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 },
  reasonDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent, marginTop: 6, marginRight: 8 },
  reasonText: { flex: 1, color: colors.textMuted, fontSize: 10, lineHeight: 15 },
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
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    marginBottom: 12,
    borderRadius: 9,
    backgroundColor: colors.backgroundSoft,
  },
  offlineNoticeText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
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
  actionContent: { flex: 1 },
  actionExplanation: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  feedbackRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  feedbackChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.backgroundSoft, borderWidth: 1, borderColor: colors.border },
  feedbackChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  feedbackChipText: { color: colors.textMuted, fontSize: 8, fontWeight: '700', marginLeft: 4 },
  feedbackChipTextActive: { color: colors.onAccent },
  regenerateChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.accentSoft },
  regenerateChipText: { color: colors.accent, fontSize: 8, fontWeight: '800', marginLeft: 4 },
  pendingActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pendingActionsText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  pendingActionsContent: { flex: 1 },
  retryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  retryButtonText: { color: colors.onAccent, fontSize: 12, fontWeight: '700' },
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
