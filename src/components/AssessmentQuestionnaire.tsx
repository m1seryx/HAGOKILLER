import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import moment from 'moment';
import { ActivityId } from '../types';
import { ACTIVITY_OPTIONS } from '../constants/activityOptions';
import { describeMatchedActivities } from '../utils/checkInParsing';
import { colors } from '../constants/theme';

export interface ActivityCheckInPayload {
  activities: ActivityId[];
  otherActivityNote?: string;
}

interface AssessmentQuestionnaireProps {
  initialActivities?: ActivityId[];
  initialOtherNote?: string;
  savedForToday?: boolean;
  onSave: (payload: ActivityCheckInPayload) => void | Promise<void>;
}

const EMPTY_ACTIVITIES: ActivityId[] = [];
const QUICK_ACTIVITIES: ActivityId[] = ['alcohol', 'late_meal', 'exercise', 'stress', 'caffeine', 'screen_time'];
const COMPACT_LABELS: Record<ActivityId, string> = {
  alcohol: 'Alcohol',
  late_meal: 'Late meal',
  exercise: 'Exercise',
  stress: 'Stress',
  caffeine: 'Late caffeine',
  screen_time: 'Late screens',
  congested: 'Congestion',
  back_sleeper: 'Back sleeping',
  irregular_schedule: 'Irregular sleep',
  smoking: 'Smoking / vaping',
  dry_air: 'Dry air',
  mouth_breathing: 'Mouth breathing',
  medications: 'Sedating meds',
  dehydrated: 'Dehydrated',
};

export const AssessmentQuestionnaire: React.FC<AssessmentQuestionnaireProps> = ({
  initialActivities = EMPTY_ACTIVITIES,
  initialOtherNote = '',
  savedForToday = false,
  onSave,
}) => {
  const [text, setText] = useState(initialOtherNote);
  const [selected, setSelected] = useState<ActivityId[]>(initialActivities);
  const [editing, setEditing] = useState(!savedForToday);
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');
  const saveInProgress = useRef(false);
  // Compare saved content rather than array identity so rerenders preserve drafts.
  const savedActivitiesKey = JSON.stringify(initialActivities);

  useEffect(() => {
    setText(initialOtherNote);
    setSelected(JSON.parse(savedActivitiesKey) as ActivityId[]);
    setEditing(!savedForToday);
    setError('');
  }, [savedActivitiesKey, initialOtherNote, savedForToday]);

  const toggleActivity = (id: ActivityId) => {
    setSelected((current) => current.includes(id)
      ? current.filter((activity) => activity !== id)
      : [...current, id]);
    setError('');
  };

  const handleSave = async (skip = false) => {
    if (saveInProgress.current) return;
    saveInProgress.current = true;
    setSaving(true);
    setError('');
    const note = skip ? '' : text.trim();
    const activities = skip ? [] : selected;
    try {
      await onSave({ activities, ...(note ? { otherActivityNote: note } : {}) });
      setSelected(activities);
      setText(note);
      setEditing(false);
    } catch {
      setError('Could not save your check-in. Your answer is still here. Please try again.');
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  };

  const hasAnswer = selected.length > 0 || text.trim().length > 0;
  const compactOptions = ACTIVITY_OPTIONS.filter(
    (option) => QUICK_ACTIVITIES.includes(option.id) || selected.includes(option.id),
  );
  const visibleOptions = showAll ? ACTIVITY_OPTIONS : compactOptions;
  const hiddenCount = ACTIVITY_OPTIONS.length - compactOptions.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <FontAwesome5 name="clipboard-check" size={18} color={colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>DAILY CHECK-IN</Text>
          <Text style={styles.title}>What did you do today?</Text>
          <Text style={styles.subtitle}>{moment().format('dddd, MMM D')}</Text>
        </View>
      </View>

      {editing ? (
        <>
          <Text style={styles.helper}>Select what applies. You can choose more than one.</Text>
          <View style={styles.options}>
            {visibleOptions.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked, disabled: saving }}
                  disabled={saving}
                  style={[styles.option, checked && styles.optionSelected]}
                  onPress={() => toggleActivity(option.id)}
                  activeOpacity={0.8}
                >
                  <FontAwesome5 name={checked ? 'check-circle' : option.icon} size={14} color={checked ? colors.accentDark : colors.textMuted} />
                  <Text style={[styles.optionLabel, checked && styles.optionLabelSelected]}>{COMPACT_LABELS[option.id]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {hiddenCount > 0 || showAll ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: showAll, disabled: saving }}
              disabled={saving}
              style={styles.moreButton}
              onPress={() => setShowAll((current) => !current)}
            >
              <Text style={styles.editLink}>{showAll ? 'Show less' : 'More activities (' + hiddenCount + ')'}</Text>
              <FontAwesome5 name={showAll ? 'chevron-up' : 'chevron-down'} size={11} color={colors.accent} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.noteHeader}>
            <Text style={styles.noteLabel}>Anything else? <Text style={styles.optional}>(optional)</Text></Text>
            <Text style={styles.counter}>{text.length}/500</Text>
          </View>
          <TextInput
            accessibilityLabel="Additional notes about your day"
            style={styles.input}
            value={text}
            onChangeText={(value) => { setText(value); setError(''); }}
            placeholder="Add a little more about your day..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            editable={!saving}
            textAlignVertical="top"
          />
          <Text style={styles.hint}>Your selections and note personalize your on-device sleep tips.</Text>
          {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: saving || !hasAnswer, busy: saving }}
            disabled={saving || !hasAnswer}
            style={[styles.primaryButton, (saving || !hasAnswer) && styles.disabled]}
            onPress={() => handleSave()}
            activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator size="small" color={colors.onAccent} /> : <FontAwesome5 name="check" size={14} color={colors.onAccent} />}
            <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save check-in'}</Text>
          </TouchableOpacity>
          {!savedForToday ? (
            <TouchableOpacity accessibilityRole="button" disabled={saving} style={styles.secondaryButton} onPress={() => handleSave(true)}>
              <Text style={styles.secondaryButtonText}>Skip for today</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : (
        <View style={styles.summary}>
          <View style={styles.savedRow}>
            <FontAwesome5 name="check-circle" size={16} color={colors.accent} />
            <Text style={styles.savedLabel}>{hasAnswer ? 'Check-in saved' : 'Skipped for today'}</Text>
          </View>
          {selected.length > 0 ? (
            <View style={styles.summaryChips}>
              {describeMatchedActivities(selected).map((label) => (
                <View key={label} style={styles.summaryChip}><Text style={styles.summaryChipText}>{label}</Text></View>
              ))}
            </View>
          ) : null}
          {text.trim() ? <Text style={styles.answerText}>{text.trim()}</Text> : null}
          {!hasAnswer ? <Text style={styles.helper}>You can add your activities later. General tips are shown below.</Text> : null}
          <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={() => setEditing(true)}>
            <Text style={styles.editLink}>Edit check-in</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  headerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.accentDark, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  helper: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', flexGrow: 1, flexBasis: '46%', minWidth: 0, minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  moreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, marginBottom: 8 },
  optionSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  optionLabel: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  optionLabelSelected: { color: colors.accentDark, fontWeight: '600' },
  noteHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4, marginBottom: 8 },
  noteLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  optional: { color: colors.textMuted, fontWeight: '400' },
  counter: { fontSize: 12, color: colors.textMuted },
  input: { minHeight: 72, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, padding: 12, fontSize: 14, color: colors.text, lineHeight: 21, marginBottom: 8 },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: 16 },
  error: { color: '#b91c1c', fontSize: 13, lineHeight: 20, marginBottom: 12 },
  primaryButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48, backgroundColor: colors.accent, borderRadius: 12, padding: 12 },
  primaryButtonText: { color: colors.onAccent, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  secondaryButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', padding: 10, marginTop: 8 },
  secondaryButtonText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  summary: { gap: 12 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  summaryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryChip: { backgroundColor: colors.accentSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  summaryChipText: { color: colors.accentDark, fontSize: 12, fontWeight: '600' },
  answerText: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  editLink: { fontSize: 14, color: colors.accent, fontWeight: '700' },
});
