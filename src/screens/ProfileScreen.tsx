import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import moment from 'moment';
import { useUser } from '../context/UserContext';
import { GlassCard } from '../components/GlassCard';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { saveUserProfile } from '../services/userStorage';
import { UserProfile } from '../types';

const MONTHS = moment.months();
const GOALS = [6, 7, 8, 9, 10];
type BirthField = 'month' | 'day' | 'year';

export const ProfileScreen = () => {
  const navigation = useNavigation();
  const { userName, userProfile, setUserProfile } = useUser();
  const [editing, setEditing] = useState(true);
  const [name, setName] = useState(userProfile?.name || userName || '');
  const [photoUri, setPhotoUri] = useState<string | null>(userProfile?.photoUri ?? null);
  const [sleepGoal, setSleepGoal] = useState<number | null>(userProfile?.sleepGoalHours ?? 8);
  const [goalOpen, setGoalOpen] = useState(false);
  const [birthField, setBirthField] = useState<BirthField | null>(null);
  const [saving, setSaving] = useState(false);

  const initial = userProfile?.birthdate ? moment(userProfile.birthdate) : null;
  const [birthMonth, setBirthMonth] = useState<number | null>(initial ? initial.month() : null);
  const [birthDay, setBirthDay] = useState<number | null>(initial ? initial.date() : null);
  const [birthYear, setBirthYear] = useState<number | null>(initial ? initial.year() : null);

  const today = moment();
  const minYear = today.year() - 80;
  const maxYear = today.year() - 5;
  const yearOptions = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i),
    [maxYear, minYear],
  );
  const daysInMonth =
    birthMonth !== null && birthYear !== null
      ? moment({ year: birthYear, month: birthMonth }).daysInMonth()
      : 31;
  const dayOptions = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth],
  );

  const pickerItems =
    birthField === 'month'
      ? MONTHS.map((label, index) => ({ label, value: index }))
      : birthField === 'day'
        ? dayOptions.map((day) => ({ label: String(day), value: day }))
        : yearOptions.map((year) => ({ label: String(year), value: year }));

  const birthdate =
    birthMonth !== null && birthDay !== null && birthYear !== null
      ? moment({ year: birthYear, month: birthMonth, day: birthDay }).format('YYYY-MM-DD')
      : null;

  const selectBirthValue = (value: number) => {
    if (birthField === 'month') {
      setBirthMonth(value);
      if (birthDay && birthYear) {
        const maxDay = moment({ year: birthYear, month: value }).daysInMonth();
        if (birthDay > maxDay) setBirthDay(maxDay);
      }
    } else if (birthField === 'day') {
      setBirthDay(value);
    } else if (birthField === 'year') {
      setBirthYear(value);
      if (birthDay && birthMonth !== null) {
        const maxDay = moment({ year: value, month: birthMonth }).daysInMonth();
        if (birthDay > maxDay) setBirthDay(maxDay);
      }
    }
    setBirthField(null);
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
      if (!editing) setEditing(true);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }

    const next: UserProfile = {
      ...userProfile,
      name: name.trim(),
      birthdate,
      sleepGoalHours: sleepGoal,
      photoUri,
      createdAt: userProfile?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };

    setSaving(true);
    try {
      await saveUserProfile(next);
      setUserProfile?.(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const displayName = userProfile?.name || userName || 'Guest User';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <FontAwesome5 name="chevron-left" size={16} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => (editing ? handleSave() : setEditing(true))}
          disabled={saving}
        >
          <Text style={styles.editButtonText}>{editing ? (saving ? 'Saving' : 'Save') : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85} style={styles.avatarWrap}>
            <ProfileAvatar name={name || displayName} photoUri={photoUri} size={96} radius={22} />
            <View style={styles.cameraBadge}>
              <FontAwesome5 name="camera" size={11} color="#ffffff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{editing ? name || displayName : displayName}</Text>
          <Text style={styles.brand}>Tap the photo to change your picture</Text>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.fieldLabel}>Full name</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#6b7280"
            />
          ) : (
            <Text style={styles.value}>{displayName}</Text>
          )}

          <Text style={[styles.fieldLabel, styles.fieldSpacer]}>Birthdate</Text>
          {editing ? (
            <View style={styles.birthRow}>
              <TouchableOpacity style={styles.birthSelect} onPress={() => setBirthField('month')}>
                <Text style={styles.birthHint}>Month</Text>
                <Text style={styles.birthValue}>
                  {birthMonth !== null ? MONTHS[birthMonth].slice(0, 3) : '—'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.birthSelect} onPress={() => setBirthField('day')}>
                <Text style={styles.birthHint}>Day</Text>
                <Text style={styles.birthValue}>{birthDay ?? '—'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.birthSelect} onPress={() => setBirthField('year')}>
                <Text style={styles.birthHint}>Year</Text>
                <Text style={styles.birthValue}>{birthYear ?? '—'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.value}>
              {userProfile?.birthdate
                ? moment(userProfile.birthdate).format('MMMM D, YYYY')
                : 'Not set'}
            </Text>
          )}

          <Text style={[styles.fieldLabel, styles.fieldSpacer]}>Sleep goal</Text>
          {editing ? (
            <TouchableOpacity style={styles.input} onPress={() => setGoalOpen(true)}>
              <Text style={styles.valueInline}>
                {sleepGoal ? `${sleepGoal} hours` : 'Select'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.value}>
              {userProfile?.sleepGoalHours ? `${userProfile.sleepGoalHours} hours` : 'Not set'}
            </Text>
          )}

          <Text style={[styles.fieldLabel, styles.fieldSpacer]}>Member since</Text>
          <Text style={styles.value}>
            {userProfile?.createdAt ? moment(userProfile.createdAt).format('MMM D, YYYY') : '—'}
          </Text>
        </GlassCard>
      </ScrollView>

      <Modal transparent visible={goalOpen} animationType="fade" onRequestClose={() => setGoalOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setGoalOpen(false)}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.menu}>
            {GOALS.map((goal) => (
              <TouchableOpacity
                key={goal}
                style={styles.option}
                onPress={() => {
                  setSleepGoal(goal);
                  setGoalOpen(false);
                }}
              >
                <Text style={styles.optionText}>{goal} hours</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal transparent visible={birthField !== null} animationType="fade" onRequestClose={() => setBirthField(null)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setBirthField(null)}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>
              {birthField === 'month' ? 'Select month' : birthField === 'day' ? 'Select day' : 'Select year'}
            </Text>
            <FlatList
              data={pickerItems}
              keyExtractor={(item) => String(item.value)}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.option} onPress={() => selectBirthValue(item.value)}>
                  <Text style={styles.optionText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0b10' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  editButton: {
    minWidth: 40,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(99,102,241,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(165,180,252,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: { color: '#c7d2fe', fontWeight: '800', fontSize: 13 },
  content: { padding: 20, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  avatarWrap: { marginBottom: 16 },
  cameraBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0a0b10',
  },
  name: { color: '#ffffff', fontSize: 26, fontWeight: '800', marginBottom: 4 },
  brand: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  card: { padding: 18 },
  fieldLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  fieldSpacer: { marginTop: 18 },
  value: { color: '#e5e7eb', fontSize: 15, fontWeight: '700' },
  valueInline: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  birthRow: { flexDirection: 'row', gap: 8 },
  birthSelect: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  birthHint: { color: '#94a3b8', fontSize: 11, marginBottom: 4 },
  birthValue: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#00000099' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  menu: {
    backgroundColor: '#171a2a',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '70%',
  },
  menuTitle: { color: '#ffffff', fontWeight: '800', fontSize: 16, marginBottom: 8 },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  optionText: { color: '#e5e7eb', fontSize: 16, fontWeight: '600' },
});
