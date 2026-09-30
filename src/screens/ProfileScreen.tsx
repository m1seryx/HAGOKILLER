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
import moment from 'moment';
import { useUser } from '../context/UserContext';
import { GlassCard } from '../components/GlassCard';
import { HAGOSAUR_AVATAR_PRESETS, ProfileAvatar } from '../components/ProfileAvatar';
import { saveUserProfile } from '../services/userStorage';
import { UserProfile } from '../types';
import { colors } from '../constants/theme';

const MONTHS = moment.months();
const GOALS = [6, 7, 8, 9, 10];
type BirthField = 'month' | 'day' | 'year';

export const ProfileScreen = () => {
  const navigation = useNavigation();
  const { userName, userProfile, setUserProfile } = useUser();
  const [editing, setEditing] = useState(true);
  const [name, setName] = useState(userProfile?.name || userName || '');
  const [photoUri, setPhotoUri] = useState<string | null>(userProfile?.photoUri ?? 'hagosaur:happy');
  const [sleepGoal, setSleepGoal] = useState<number | null>(userProfile?.sleepGoalHours ?? 8);
  const [goalOpen, setGoalOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
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
          <FontAwesome5 name="chevron-left" size={14} color="#7dd3fc" />
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
          <TouchableOpacity onPress={() => setAvatarPickerOpen(true)} activeOpacity={0.85} style={styles.avatarWrap}>
            <ProfileAvatar name={name || displayName} photoUri={photoUri} size={82} radius={22} />
            <View style={styles.cameraBadge}>
              <FontAwesome5 name="camera" size={11} color="#ffffff" />
            </View>
          </TouchableOpacity>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>YOUR SLEEP PROFILE</Text>
            <Text style={styles.name} numberOfLines={1}>{editing ? name || displayName : displayName}</Text>
            <Text style={styles.brand}>Choose your Hagosaur face</Text>
          </View>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderIcon}>
              <FontAwesome5 name="user-cog" size={14} color="#7dd3fc" />
            </View>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle}>Personal details</Text>
              <Text style={styles.cardSubtitle}>Keep your sleep profile accurate</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Full name</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#7f9abd"
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
              <View style={styles.selectRow}>
                <Text style={styles.valueInline}>
                  {sleepGoal ? `${sleepGoal} hours` : 'Select'}
                </Text>
                <FontAwesome5 name="chevron-down" size={11} color="#7dd3fc" />
              </View>
            </TouchableOpacity>
          ) : (
            <Text style={styles.value}>
              {userProfile?.sleepGoalHours ? `${userProfile.sleepGoalHours} hours` : 'Not set'}
            </Text>
          )}

          <View style={styles.memberRow}>
            <View style={styles.memberIcon}>
              <FontAwesome5 name="moon" size={12} color="#7dd3fc" solid />
            </View>
            <View>
              <Text style={styles.memberLabel}>MEMBER SINCE</Text>
              <Text style={styles.value}>
                {userProfile?.createdAt ? moment(userProfile.createdAt).format('MMM D, YYYY') : '—'}
              </Text>
            </View>
          </View>
        </GlassCard>
      </ScrollView>

      <Modal
        transparent
        visible={avatarPickerOpen}
        animationType="fade"
        onRequestClose={() => setAvatarPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setAvatarPickerOpen(false)}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.avatarMenu}>
            <Text style={styles.menuTitle}>Choose your Hagosaur</Text>
            <Text style={styles.avatarMenuHint}>Pick a face for your sleep profile.</Text>
            <View style={styles.avatarGrid}>
              {HAGOSAUR_AVATAR_PRESETS.map((preset) => {
                const selected = photoUri === preset.id;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[styles.avatarOption, selected && styles.avatarOptionSelected]}
                    onPress={() => {
                      setPhotoUri(preset.id);
                      if (!editing) setEditing(true);
                      setAvatarPickerOpen(false);
                    }}
                    activeOpacity={0.82}
                  >
                    <ProfileAvatar photoUri={preset.id} size={66} radius={20} />
                    <Text style={[styles.avatarOptionLabel, selected && styles.avatarOptionLabelSelected]}>
                      {preset.label}
                    </Text>
                    {selected ? (
                      <View style={styles.avatarCheck}>
                        <FontAwesome5 name="check" size={9} color="#ffffff" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

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
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cfe0ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { color: '#142c43', fontSize: 17, fontWeight: '800' },
  editButton: {
    minWidth: 58,
    height: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#0ea5e9',
    borderWidth: 1,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 16, paddingBottom: 40 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce7ef',
  },
  avatarWrap: { marginRight: 16 },
  cameraBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroEyebrow: { color: '#7dd3fc', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  name: { color: '#142c43', fontSize: 22, fontWeight: '900', marginBottom: 4 },
  brand: { color: '#52677b', fontSize: 12, fontWeight: '600' },
  card: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderColor: '#dce7ef',
    shadowColor: '#164e73',
    shadowOpacity: 0.08,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    backgroundColor: '#e0f2fe',
  },
  cardHeaderCopy: { flex: 1 },
  cardTitle: { color: '#142c43', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  cardSubtitle: { color: '#6b8298', fontSize: 11, fontWeight: '600' },
  fieldLabel: {
    color: '#52677b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  fieldSpacer: { marginTop: 18 },
  value: { color: '#142c43', fontSize: 15, fontWeight: '700' },
  valueInline: { color: '#142c43', fontSize: 15, fontWeight: '700' },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    backgroundColor: '#f8fbff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cfe0ee',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#142c43',
    fontSize: 15,
    fontWeight: '600',
  },
  birthRow: { flexDirection: 'row', gap: 8 },
  birthSelect: {
    flex: 1,
    backgroundColor: '#f8fbff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cfe0ee',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  birthHint: { color: '#7f9abd', fontSize: 10, marginBottom: 4 },
  birthValue: { color: '#142c43', fontSize: 13, fontWeight: '700' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  memberIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#eaf6fd',
  },
  memberLabel: { color: '#7f9abd', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 3 },
  modalOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#071126aa' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  menu: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#cfe0ee',
    maxHeight: '70%',
  },
  avatarMenu: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#cfe0ee',
  },
  avatarMenuHint: { color: '#6b8298', fontSize: 12, marginTop: -2, marginBottom: 16 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarOption: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dce7ef',
    backgroundColor: '#f8fbff',
  },
  avatarOptionSelected: { borderColor: '#0ea5e9', backgroundColor: '#e0f2fe' },
  avatarOptionLabel: { color: '#52677b', fontSize: 11, fontWeight: '700', marginTop: 6 },
  avatarOptionLabelSelected: { color: '#027caf' },
  avatarCheck: {
    position: 'absolute',
    right: 7,
    top: 7,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
  },
  menuTitle: { color: '#142c43', fontWeight: '800', fontSize: 16, marginBottom: 8 },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { color: '#142c43', fontSize: 16, fontWeight: '600' },
});
