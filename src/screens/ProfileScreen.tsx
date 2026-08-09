import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment';
import { useUser } from '../context/UserContext';
import { GlassCard } from '../components/GlassCard';

export const ProfileScreen = () => {
  const navigation = useNavigation();
  const { userName, userProfile } = useUser();
  const initials = userName ? userName.trim().charAt(0).toUpperCase() : 'U';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <FontAwesome5 name="chevron-left" size={16} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.name}>{userName || 'Guest User'}</Text>
          <Text style={styles.brand}>HAGOKILLER Sleep Profile</Text>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Full name</Text>
            <Text style={styles.value}>{userProfile?.name || userName || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Birthdate</Text>
            <Text style={styles.value}>
              {userProfile?.birthdate
                ? moment(userProfile.birthdate).format('MMMM D, YYYY')
                : 'Not set'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Sleep goal</Text>
            <Text style={styles.value}>
              {userProfile?.sleepGoalHours ? `${userProfile.sleepGoalHours} hours` : 'Not set'}
            </Text>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.label}>Member since</Text>
            <Text style={styles.value}>
              {userProfile?.createdAt
                ? moment(userProfile.createdAt).format('MMM D, YYYY')
                : '—'}
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
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
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.45)',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(99, 102, 241, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 34, fontWeight: '800' },
  name: { color: '#ffffff', fontSize: 26, fontWeight: '800', marginBottom: 4 },
  brand: { color: '#94a3b8', fontSize: 13, fontWeight: '600', letterSpacing: 0.4 },
  card: { paddingHorizontal: 18 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowLast: { borderBottomWidth: 0 },
  label: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  value: { color: '#e5e7eb', fontSize: 14, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
});
