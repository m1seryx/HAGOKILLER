import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../constants/theme';

const TEAM = [
  { name: 'Mohammad Azeem S. Abdu', role: 'Lead Software Developer', icon: 'laptop-code' },
  { name: 'Denabhar B. Mamiala', role: 'Lead Hardware Engineer', icon: 'microchip' },
  { name: 'Stephanie G. Villamor', role: 'Lead Documentation', icon: 'file-alt' },
];

export const AboutScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <FontAwesome5 name="chevron-left" size={12} color={colors.textSecondary} />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.kicker}>HAGOKILLER</Text>
        <Text style={styles.title}>About</Text>

        <View style={styles.card}>
          <Text style={styles.body}>
            HAGOKILLER is a smart pillow that listens for snoring and raises the head with short bursts of air. The phone app pairs with the pillow over Bluetooth, shows a live snore trace, and keeps a history of snores and inflations.
          </Text>
          <Text style={styles.body}>
            The pillow stays raised after it pumps. Air is released only from the manual valve control. Settings let you change how many snores start a burst and how long each burst runs.
          </Text>
        </View>

        <Text style={styles.section}>Developers</Text>
        <View style={styles.card}>
          {TEAM.map((person, index) => (
            <View key={person.name}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.row}>
                <View style={styles.icon}>
                  <FontAwesome5 name={person.icon} size={13} color={colors.accentDark} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.name}>{person.name}</Text>
                  <Text style={styles.role}>{person.role}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7f9' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 36, maxWidth: 720, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 8 },
  backText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  kicker: { color: colors.accentDark, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.4, marginBottom: 16 },
  section: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 6,
    marginBottom: 16,
    shadowColor: '#142c43',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f7fb',
    marginRight: 12,
  },
  copy: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  role: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e7edf2', marginLeft: 60 },
});
