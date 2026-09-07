import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import moment from 'moment';
import { ActivityId } from '../types';
import { describeMatchedActivities, parseCheckInText } from '../utils/checkInParsing';
import { colors } from '../constants/theme';

export interface ActivityCheckInPayload {
  activities: ActivityId[];
  otherActivityNote?: string;
}

interface AssessmentQuestionnaireProps {
  initialActivities?: ActivityId[];
  initialOtherNote?: string;
  savedForToday?: boolean;
  onSave: (payload: ActivityCheckInPayload) => void;
}

export const AssessmentQuestionnaire: React.FC<AssessmentQuestionnaireProps> = ({
  initialActivities = [],
  initialOtherNote = '',
  savedForToday = false,
  onSave,
}) => {
  const [text, setText] = useState(initialOtherNote);
  const [editing, setEditing] = useState(!savedForToday);
  const [matched, setMatched] = useState<ActivityId[]>(initialActivities);

  useEffect(() => {
    setText(initialOtherNote);
    setMatched(initialActivities);
    setEditing(!savedForToday);
  }, [initialActivities, initialOtherNote, savedForToday]);

  const handleSave = () => {
    const parsed = parseCheckInText(text);
    setMatched(parsed.activities);
    onSave({
      activities: parsed.activities,
      ...(parsed.freeText ? { otherActivityNote: parsed.freeText } : {}),
    });
    setEditing(false);
  };

  const handleClear = () => {
    setText('');
    setMatched([]);
    onSave({ activities: [] });
    setEditing(false);
  };

  const preview = editing ? parseCheckInText(text) : null;
  const summaryLabels = describeMatchedActivities(matched);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <FontAwesome5 name="comment-dots" size={16} color={colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>What did you do today?</Text>
          <Text style={styles.subtitle}>
            {moment().format('dddd, MMM D')} — write freely; we match keywords for tips
          </Text>
        </View>
      </View>

      {editing ? (
        <>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="e.g. I had coffee late, ate dinner at 10pm, and scrolled on my phone in bed..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          {preview && preview.activities.length > 0 ? (
            <Text style={styles.preview}>
              Detected: {describeMatchedActivities(preview.activities).join(', ')}
            </Text>
          ) : (
            <Text style={styles.hint}>
              Tips stay general until keywords match (coffee, alcohol, stress, workout, etc.).
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleClear} activeOpacity={0.8}>
              <Text style={styles.secondaryButtonText}>Skip today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSave} activeOpacity={0.8}>
              <FontAwesome5 name="check" size={12} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.primaryButtonText}>Save & update advice</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.summary}>
          {text.trim() ? (
            <Text style={styles.answerText}>"{text.trim()}"</Text>
          ) : (
            <Text style={styles.summaryText}>No answer saved — showing general tips.</Text>
          )}
          <Text style={styles.summaryText}>
            {summaryLabels.length === 0
              ? 'No keyword matches from your answer.'
              : `Matched: ${summaryLabels.join(', ')}`}
          </Text>
          <TouchableOpacity onPress={() => setEditing(true)} activeOpacity={0.8}>
            <Text style={styles.editLink}>Update answer</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  input: {
    minHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundMuted,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 10,
  },
  hint: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 16,
  },
  preview: {
    fontSize: 12,
    color: colors.accentDark,
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  summary: { gap: 8 },
  answerText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  summaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  editLink: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '700',
  },
});
