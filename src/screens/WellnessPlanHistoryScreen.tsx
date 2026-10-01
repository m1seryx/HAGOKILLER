import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import moment from 'moment';
import { loadWellnessPlans } from '../services/userStorage';
import { WellnessPlanRecord } from '../types';
import { colors } from '../constants/theme';
import { getSeverityColor } from '../utils/recommendations';

export const WellnessPlanHistoryScreen = () => {
  const navigation = useNavigation<any>();
  const [plans, setPlans] = useState<WellnessPlanRecord[]>([]);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadWellnessPlans()
      .then((records) => { if (active) setPlans(records); })
      .catch(() => { if (active) setPlans([]); });
    return () => { active = false; };
  }, []));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <FontAwesome5 name="chevron-left" size={13} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>HAGOSAUR WELLNESS</Text>
          <Text style={styles.title}>Plan history</Text>
        </View>
        <Image source={require('../../assets/hagosaur-face-curious.png')} style={styles.headerArt} resizeMode="contain" />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {plans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Image source={require('../../assets/hagosaur-face-sleepy.png')} style={styles.emptyArt} resizeMode="contain" />
            <Text style={styles.emptyTitle}>No saved plans yet</Text>
            <Text style={styles.emptyText}>Complete today’s assessment and Hagosaur will keep the plan here.</Text>
          </View>
        ) : plans.map((plan) => {
          const color = getSeverityColor(plan.recommendation.severityLevel);
          return (
            <View key={plan.date} style={styles.planCard}>
              <View style={styles.planTopRow}>
                <View>
                  <Text style={styles.planDate}>{moment(plan.date).format('dddd, MMM D')}</Text>
                  <Text style={styles.planSource}>
                    {plan.recommendation.source === 'on_device'
                      ? 'Private on-device plan'
                      : plan.recommendation.source === 'ai' ? 'Personalized wellness plan' : 'Safe offline plan'}
                  </Text>
                </View>
                <View style={[styles.severityBadge, { backgroundColor: `${color}18` }]}>
                  <View style={[styles.severityDot, { backgroundColor: color }]} />
                  <Text style={[styles.severityText, { color }]}>{plan.recommendation.severityLevel}</Text>
                </View>
              </View>
              <Text style={styles.planRecommendation}>{plan.recommendation.recommendation}</Text>
              {plan.recommendation.actionItems.slice(0, 3).map((action) => (
                <View key={action} style={styles.actionRow}>
                  <FontAwesome5 name="check-circle" size={11} color={colors.accent} />
                  <Text style={styles.actionText}>{action}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 92, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', paddingHorizontal: 16,
    backgroundColor: colors.backgroundSoft, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  headerCopy: { flex: 1, marginLeft: 12, zIndex: 1 },
  eyebrow: { color: colors.accentDark, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 23, fontWeight: '900', marginTop: 3 },
  headerArt: { width: 92, height: 92, marginRight: -10 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16, paddingBottom: 40 },
  emptyCard: { alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyArt: { width: 150, height: 130 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 4 },
  emptyText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  planCard: { padding: 16, marginBottom: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  planTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  planDate: { color: colors.text, fontSize: 15, fontWeight: '800' },
  planSource: { color: colors.textMuted, fontSize: 9, marginTop: 3 },
  severityBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  severityDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  severityText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  planRecommendation: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  actionText: { flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 16, marginLeft: 8 },
});
