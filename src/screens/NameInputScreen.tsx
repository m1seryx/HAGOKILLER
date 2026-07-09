import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
<<<<<<< HEAD
  KeyboardAvoidingView, Platform, Animated
=======
  KeyboardAvoidingView, Platform, Animated, Modal,
>>>>>>> fbc19acd13655bc5980b18ad0e039e6e8d27ad05
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import moment from 'moment';
import { UserProfile } from '../types';

interface NameInputScreenProps {
  onProfileSubmit: (profile: UserProfile) => void;
}

export const NameInputScreen: React.FC<NameInputScreenProps> = ({ onProfileSubmit }) => {
  const [name, setName] = useState('');
<<<<<<< HEAD
  const [isFocused, setIsFocused] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };
=======
  const [birthdate, setBirthdate] = useState<string | null>(null);
  const [sleepGoal, setSleepGoal] = useState<number | 'other' | null>(8);
  const [otherGoal, setOtherGoal] = useState('');
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [birthPickerVisible, setBirthPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(moment().subtract(25, 'years').toDate());
>>>>>>> fbc19acd13655bc5980b18ad0e039e6e8d27ad05

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.iconRing}>
          <View style={styles.iconCircle}>
            <FontAwesome5 name="user-astronaut" size={32} color="#6366f1" />
          </View>
        </View>
<<<<<<< HEAD

        <View style={styles.textContainer}>
          <Text style={styles.title}>Welcome Aboard</Text>
          <Text style={styles.subtitle}>Personalize your sleep analytics profile</Text>
        </View>

        <View style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused
        ]}>
          <FontAwesome5 
            name="user" 
            size={14} 
            color={isFocused ? '#6366f1' : '#6b7280'} 
            style={styles.inputIcon} 
          />
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor="#6b7280"
            value={name}
            onChangeText={setName}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => name.trim() && onNameSubmit(name.trim())}
          />
        </View>

        <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%' }}>
          <TouchableOpacity
            style={[styles.button, !name.trim() && styles.buttonDisabled]}
            onPress={() => name.trim() && onNameSubmit(name.trim())}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={!name.trim()}
            activeOpacity={0.9}
          >
            <Text style={[styles.buttonText, !name.trim() && styles.buttonTextDisabled]}>
              Initialize Dashboard
            </Text>
            <FontAwesome5 
              name="arrow-right" 
              size={12} 
              color={!name.trim() ? '#6b7280' : '#ffffff'} 
              style={{ marginLeft: 8, marginTop: 2 }} 
            />
          </TouchableOpacity>
        </Animated.View>
=======
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
>>>>>>> fbc19acd13655bc5980b18ad0e039e6e8d27ad05
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
  container: { 
    flex: 1, 
    backgroundColor: '#0a0b10', 
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: { 
    backgroundColor: 'rgba(26, 27, 38, 0.75)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(26, 27, 38, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#ffffff', 
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: { 
    fontSize: 13, 
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%', 
    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
    borderRadius: 16,
    paddingHorizontal: 16, 
    borderWidth: 1.5, 
    borderColor: 'rgba(255, 255, 255, 0.08)', 
    marginBottom: 24,
  },
  inputContainerFocused: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16, 
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff', 
  },
  smallInput: {
    width: '100%', backgroundColor: '#2d2d44', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15,
    color: '#ffffff', borderWidth: 1, borderColor: '#3d3d5c', marginBottom: 12,
  },
  button: {
    flexDirection: 'row',
    width: '100%', 
    backgroundColor: '#6366f1', 
    borderRadius: 16,
    paddingVertical: 16, 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { 
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  buttonTextDisabled: {
    color: '#6b7280',
  },
<<<<<<< HEAD
=======
  buttonDisabled: { backgroundColor: '#2d2d44' },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 6 },
  weekdayText: { width: 32, textAlign: 'center', color: '#9ca3af', fontSize: 12 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, marginTop: 8 },
  dayCell: { width: 32, height: 36, justifyContent: 'center', alignItems: 'center', margin: 2, borderRadius: 6 },
  dayCellText: { color: '#e5e7eb' },
  dayCellSelected: { backgroundColor: '#3b82f6' },
>>>>>>> fbc19acd13655bc5980b18ad0e039e6e8d27ad05
});
