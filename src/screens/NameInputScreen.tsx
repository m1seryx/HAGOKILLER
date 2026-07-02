import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Modal,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import moment from 'moment';
import { UserProfile } from '../types';

const ZzzDot: React.FC<{ letter: string; delay: number; baseX: number }> = ({ letter, delay, baseX }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -30, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(600 - delay),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.Text style={[styles.zzz, { left: baseX, opacity, transform: [{ translateY }, { scale }] }]}>
      {letter}
    </Animated.Text>
  );
};

interface NameInputScreenProps {
  onProfileSubmit: (profile: UserProfile) => void;
}

export const NameInputScreen: React.FC<NameInputScreenProps> = ({ onProfileSubmit }) => {
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState<string | null>(null);
  const [sleepGoal, setSleepGoal] = useState<number | 'other' | null>(8);
  const [otherGoal, setOtherGoal] = useState('');
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [birthPickerVisible, setBirthPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(moment().subtract(25, 'years').toDate());

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <FontAwesome5 name="bed" size={64} color="#3b82f6" />
          <ZzzDot letter="z" delay={0}   baseX={52} />
          <ZzzDot letter="Z" delay={350} baseX={66} />
          <ZzzDot letter="Z" delay={700} baseX={80} />
        </View>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>Tell us about you</Text>
        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="#6b7280"
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="next"
        />

        <TouchableOpacity style={styles.smallInput} onPress={() => { setPickerDate(birthdate ? moment(birthdate).toDate() : moment().subtract(25, 'years').toDate()); setBirthPickerVisible(true); }}>
          <Text style={{ color: birthdate ? '#fff' : '#9ca3af', fontSize: 15 }}>{birthdate ? moment(birthdate).format('MMMM D, YYYY') : 'Birthdate (optional)'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.smallInput} onPress={() => setGoalModalVisible(true)}>
          <Text style={{ color: '#ffffff', fontSize: 15 }}>
            Sleep goal: {sleepGoal === 'other' ? (otherGoal || 'Other') : sleepGoal ? `${sleepGoal} hrs` : 'Select'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !name.trim() && styles.buttonDisabled]}
          onPress={() => {
            if (!name.trim()) return;
            const profile: UserProfile = {
              name: name.trim(),
              birthdate: birthdate ?? null,
              sleepGoalHours: sleepGoal === 'other' ? (otherGoal ? parseFloat(otherGoal) : undefined) : (sleepGoal || undefined),
            };
            onProfileSubmit(profile);
          }}
          disabled={!name.trim()}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>

        <Modal transparent visible={goalModalVisible} animationType="fade" onRequestClose={() => setGoalModalVisible(false)}>
          <TouchableOpacity style={modalStyles.overlay} onPress={() => setGoalModalVisible(false)}>
            <View style={modalStyles.menu}>
              {[6,7,8,9,10].map((g) => (
                <TouchableOpacity key={g} style={modalStyles.option} onPress={() => { setSleepGoal(g); setOtherGoal(''); setGoalModalVisible(false); }}>
                  <Text style={modalStyles.optionText}>{g} hours</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={modalStyles.option} onPress={() => { setSleepGoal('other'); setGoalModalVisible(false); }}>
                <Text style={modalStyles.optionText}>Other</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {sleepGoal === 'other' && (
          <TextInput
            style={[styles.smallInput, { marginTop: 8 }]}
            placeholder="Enter custom hours"
            placeholderTextColor="#6b7280"
            value={otherGoal}
            onChangeText={(v) => setOtherGoal(v.replace(/[^0-9\.]/g, ''))}
            keyboardType="decimal-pad"
          />
        )}
        <Modal transparent visible={birthPickerVisible} animationType="fade" onRequestClose={() => setBirthPickerVisible(false)}>
          <TouchableOpacity style={modalStyles.overlay} onPress={() => setBirthPickerVisible(false)}>
            <View style={modalStyles.menu}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={() => setPickerDate(moment(pickerDate).subtract(1, 'month').toDate())}>
                  <Text style={modalStyles.optionText}>◀</Text>
                </TouchableOpacity>
                <Text style={modalStyles.optionText}>{moment(pickerDate).format('MMMM YYYY')}</Text>
                <TouchableOpacity onPress={() => setPickerDate(moment(pickerDate).add(1, 'month').toDate())}>
                  <Text style={modalStyles.optionText}>▶</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.weekdayRow}>
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                  <Text key={d} style={styles.weekdayText}>{d}</Text>
                ))}
              </View>
              <View style={styles.dayGrid}>
                {(() => {
                  const start = moment(pickerDate).startOf('month');
                  const daysInMonth = moment(pickerDate).daysInMonth();
                  const startWeek = start.day();
                  const cells: React.ReactNode[] = [];
                  for (let i = 0; i < startWeek; i++) cells.push(<View key={`b-${i}`} style={styles.dayCell} />);
                  for (let d = 1; d <= daysInMonth; d++) {
                    const date = moment(start).date(d);
                    const isSelected = birthdate ? date.isSame(moment(birthdate), 'day') : false;
                    cells.push(
                      <TouchableOpacity
                        key={`d-${d}`}
                        style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                        onPress={() => { setPickerDate(date.toDate()); setBirthdate(date.format('YYYY-MM-DD')); setBirthPickerVisible(false); }}
                      >
                        <Text style={[styles.dayCellText, isSelected && { color: '#fff', fontWeight: '800' }]}>{d}</Text>
                      </TouchableOpacity>
                    );
                  }
                  return cells;
                })()}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
};

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', paddingHorizontal: 32 },
  menu: { backgroundColor: '#2d2d44', borderRadius: 12, padding: 12 },
  option: { paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#3d3d5c' },
  optionText: { color: '#e5e7eb', fontSize: 16, fontWeight: '600' },
});

// calendar styles will be merged into `styles` below

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 32 },
  iconWrapper: { marginBottom: 24, width: 120, height: 80, justifyContent: 'flex-end', alignItems: 'flex-start' },
  zzz: { position: 'absolute', bottom: 60, color: '#93c5fd', fontWeight: '800', fontSize: 18 },
  logo: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#9ca3af', marginBottom: 40 },
  input: {
    width: '100%', backgroundColor: '#2d2d44', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    color: '#ffffff', borderWidth: 1, borderColor: '#3d3d5c', marginBottom: 16,
  },
  smallInput: {
    width: '100%', backgroundColor: '#2d2d44', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15,
    color: '#ffffff', borderWidth: 1, borderColor: '#3d3d5c', marginBottom: 12,
  },
  button: {
    width: '100%', backgroundColor: '#3b82f6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#2d2d44' },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 6 },
  weekdayText: { width: 32, textAlign: 'center', color: '#9ca3af', fontSize: 12 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, marginTop: 8 },
  dayCell: { width: 32, height: 36, justifyContent: 'center', alignItems: 'center', margin: 2, borderRadius: 6 },
  dayCellText: { color: '#e5e7eb' },
  dayCellSelected: { backgroundColor: '#3b82f6' },
});
