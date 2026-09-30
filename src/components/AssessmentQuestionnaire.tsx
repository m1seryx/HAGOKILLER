import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import moment from 'moment';
import { ActivityId } from '../types';
import { parseCheckInText } from '../utils/checkInParsing';
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

export const AssessmentQuestionnaire: React.FC<AssessmentQuestionnaireProps> = ({
  initialActivities = EMPTY_ACTIVITIES,
  initialOtherNote = '',
  savedForToday = false,
  onSave,
}) => {
  const [text, setText] = useState(initialOtherNote);
  const [editing, setEditing] = useState(!savedForToday);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const saveInProgress = useRef(false);

  useEffect(() => {
    setText(initialOtherNote);
    setEditing(!savedForToday);
    setError('');
  }, [initialOtherNote, savedForToday]);

  const handleSave = async (skip = false) => {
    if (saveInProgress.current) return;
    saveInProgress.current = true;
    setSaving(true);
    setError('');
    const note = skip ? '' : text.trim();
    const activities = skip ? [] : parseCheckInText(note).activities;
    try {
      await onSave({ activities, ...(note ? { otherActivityNote: note } : {}) });
      setText(note);
      setEditing(false);
    } catch {
      setError('Could not save your check-in. Your answer is still here. Please try again.');
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  };

  const hasAnswer = text.trim().length > 0;
  const hadLegacySelections = initialActivities.length > 0;

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
          <View style={styles.noteHeader}>
            <Text style={styles.noteLabel}>Tell Hagosaur about your day</Text>
            <Text style={styles.counter}>{text.length}/500</Text>
          </View>
          <TextInput
            accessibilityLabel="Additional notes about your day"
            style={styles.input}
            value={text}
            onChangeText={(value) => { setText(value); setError(''); }}
            placeholder="For example: I exercised after lunch, felt stressed at work, and had coffee in the evening..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            editable={!saving}
            textAlignVertical="top"
          />
          <Text style={styles.hint}>Your answer privately personalizes Hagosaur's wellness guidance.</Text>
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
            <Text style={styles.savedLabel}>{hasAnswer || hadLegacySelections ? 'Check-in saved' : 'Skipped for today'}</Text>
          </View>
          {text.trim() ? <Text style={styles.answerText}>{text.trim()}</Text> : null}
          {!hasAnswer ? <Text style={styles.helper}>You can write your answer later. General guidance is shown below.</Text> : null}
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
  noteHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4, marginBottom: 8 },
  noteLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  counter: { fontSize: 12, color: colors.textMuted },
  input: { minHeight: 120, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, padding: 12, fontSize: 14, color: colors.text, lineHeight: 21, marginBottom: 8 },
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
  answerText: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  editLink: { fontSize: 14, color: colors.accent, fontWeight: '700' },
});
