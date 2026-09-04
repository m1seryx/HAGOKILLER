import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import moment from 'moment';
import { ActivityId } from '../types';
import { ACTIVITY_OPTIONS } from '../constants/activityOptions';
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

const formatSummary = (activities: ActivityId[], otherNote?: string) => {
  const labels = activities
    .map((id) => ACTIVITY_OPTIONS.find((opt) => opt.id === id)?.label)
    .filter(Boolean) as string[];
  const trimmedNote = otherNote?.trim();
  if (trimmedNote) labels.push(`Other: ${trimmedNote}`);
  return labels;
};

export const AssessmentQuestionnaire: React.FC<AssessmentQuestionnaireProps> = ({
  initialActivities = [],
  initialOtherNote = '',
  savedForToday = false,
  onSave,
}) => {
  const [selected, setSelected] = useState<ActivityId[]>(initialActivities);
  const [otherNote, setOtherNote] = useState(initialOtherNote);
  const [editing, setEditing] = useState(!savedForToday);

  useEffect(() => {
    setSelected(initialActivities);
    setOtherNote(initialOtherNote);
    setEditing(!savedForToday);
  }, [initialActivities, initialOtherNote, savedForToday]);

  const toggleActivity = (id: ActivityId) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const buildPayload = (): ActivityCheckInPayload => {
    const trimmed = otherNote.trim();
    return {
      activities: selected,
      ...(trimmed ? { otherActivityNote: trimmed } : {}),
    };
  };

  const handleSave = () => {
    onSave(buildPayload());
    setEditing(false);
  };

  const handleClear = () => {
    setSelected([]);
    setOtherNote('');
    onSave({ activities: [] });
    setEditing(false);
  };

  const summaryItems = formatSummary(selected, otherNote);
  const hasInput = selected.length > 0 || otherNote.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <FontAwesome5 name="clipboard-check" size={16} color="#6366f1" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Today's sleep check-in</Text>
          <Text style={styles.subtitle}>
            {moment().format('dddd, MMM D')} — select what applies for personalized advice
          </Text>
        </View>
      </View>

      {editing ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {ACTIVITY_OPTIONS.map((option) => {
              const active = selected.includes(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleActivity(option.id)}
                  activeOpacity={0.8}
                >
                  <FontAwesome5
                    name={option.icon}
                    size={12}
                    color={active ? colors.onAccent : colors.textMuted}
                    style={styles.chipIcon}
                  />
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.otherSection}>
            <Text style={styles.otherLabel}>Other activities (specify)</Text>
            <TextInput
              style={styles.otherInput}
              value={otherNote}
              onChangeText={setOtherNote}
              placeholder="e.g. allergy medicine, late screen time, travel..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />
          </View>

          <Text style={styles.hint}>
            {!hasInput
              ? 'No selections? Save anyway for general daily tips.'
              : `${summaryItems.length} item${summaryItems.length === 1 ? '' : 's'} noted — advice will match your check-in.`}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleClear} activeOpacity={0.8}>
              <Text style={styles.secondaryButtonText}>None apply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSave} activeOpacity={0.8}>
              <FontAwesome5 name="check" size={12} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.primaryButtonText}>Save & update advice</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {summaryItems.length === 0
              ? 'Check-in saved — showing general tips for today.'
              : `Check-in saved: ${summaryItems.join(', ')}`}
          </Text>
          <TouchableOpacity onPress={() => setEditing(true)} activeOpacity={0.8}>
            <Text style={styles.editLink}>Update answers</Text>
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
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  chipRow: {
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  chipIcon: {
    marginRight: 6,
  },
  chipLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: colors.onAccent,
  },
  otherSection: {
    marginTop: 12,
    marginBottom: 4,
  },
  otherLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  otherInput: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  hint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 10,
    marginBottom: 12,
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
    backgroundColor: '#6366f1',
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
  summary: {
    gap: 8,
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
