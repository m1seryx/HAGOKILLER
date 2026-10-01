import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import { NightDetailCard } from '../components/NightDetailCard';
import { bleService } from '../services/bleService';
import { SleepEvent } from '../types';
import { calculateNightDetail, getNightKey, listRecentNightKeys } from '../utils/statsCalculator';
import { colors } from '../constants/theme';
import { registerNightExitAnimation } from '../services/nightTabTransition';

const STARS = [
  { left: '8%', top: 32, size: 2 },
  { left: '18%', top: 92, size: 3 },
  { left: '31%', top: 48, size: 2 },
  { left: '46%', top: 112, size: 2 },
  { left: '58%', top: 42, size: 3 },
  { left: '71%', top: 88, size: 2 },
  { left: '84%', top: 28, size: 2 },
  { left: '92%', top: 138, size: 3 },
  { left: '12%', top: 248, size: 2 },
  { left: '78%', top: 292, size: 2 },
] as const;

const NightSky = () => {
  const { width } = useWindowDimensions();
  const twinkle = React.useRef(new Animated.Value(0.35)).current;
  const comet = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const twinkleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0.35, duration: 1400, useNativeDriver: true }),
      ]),
    );
    const cometAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(comet, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2200),
        Animated.timing(comet, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    twinkleAnimation.start();
    cometAnimation.start();
    return () => {
      twinkleAnimation.stop();
      cometAnimation.stop();
    };
  }, [comet, twinkle]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {STARS.map((star, index) => (
        <Animated.View
          key={`${star.left}-${star.top}`}
          style={[
            styles.star,
            {
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              opacity: index % 2 === 0 ? twinkle : 0.65,
            },
          ]}
        />
      ))}
      <Animated.View
        style={[
          styles.comet,
          {
            transform: [
              { translateX: comet.interpolate({ inputRange: [0, 1], outputRange: [-90, width + 90] }) },
              { translateY: comet.interpolate({ inputRange: [0, 1], outputRange: [70, 230] }) },
              { rotate: '18deg' },
            ],
          },
        ]}
      >
        <View style={styles.cometTail} />
        <View style={styles.cometHead} />
      </Animated.View>
    </View>
  );
};

const SleepingDinosaurAnimation = () => {
  const motion = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(motion, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [motion]);

  return (
    <View style={styles.dinosaurStage}>
      <View style={styles.moonGlow} />
      <Animated.View
        style={{
          transform: [
            {
              translateY: motion.interpolate({
                inputRange: [0, 1],
                outputRange: [3, -4],
              }),
            },
            {
              scale: motion.interpolate({
                inputRange: [0, 1],
                outputRange: [0.985, 1.015],
              }),
            },
          ],
        }}
      >
        <Image
          source={require('../../assets/sleeping-dinosaur.png')}
          style={styles.dinosaurImage}
          resizeMode="contain"
          accessibilityLabel="Hagosaur sleeping on a moon pillow"
        />
      </Animated.View>
    </View>
  );
};

export const NightDetailScreen = () => {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const sceneProgress = React.useRef(new Animated.Value(0)).current;
  const [events, setEvents] = useState<SleepEvent[]>([]);
  const [selectedNightKey, setSelectedNightKey] = useState(moment().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(
    useCallback(() => {
      sceneProgress.setValue(0);
      const entrance = Animated.timing(sceneProgress, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      entrance.start();
      return () => entrance.stop();
    }, [sceneProgress]),
  );

  useEffect(() => registerNightExitAnimation(() => new Promise<void>((resolve) => {
    Animated.timing(sceneProgress, {
      toValue: 0,
      duration: 280,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => resolve());
  })), [sceneProgress]);

  const load = useCallback(async () => {
    const nextEvents = await bleService.fetchSleepEvents();
    setEvents(nextEvents);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load()
        .catch(() => {
          if (active) setEvents([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => { active = false; };
    }, [load]),
  );

  useEffect(() => bleService.subscribeEvents((event) => {
    setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)]);
  }), []);

  const nightKeys = useMemo(() => listRecentNightKeys(events, 7), [events]);
  const activeNightKey = nightKeys.includes(selectedNightKey) ? selectedNightKey : nightKeys[0];
  const nightDetail = useMemo(
    () => calculateNightDetail(events, activeNightKey),
    [events, activeNightKey],
  );
  const activeNightEvents = useMemo(
    () => events.filter((event) => getNightKey(event.timestamp) === activeNightKey),
    [events, activeNightKey],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading} edges={['top', 'left', 'right']}>
        <NightSky />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading night details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Animated.View
        style={[
          styles.animatedScene,
          {
            opacity: sceneProgress,
            transform: [
              {
                translateY: sceneProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [42, 0],
                }),
              },
              {
                scale: sceneProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.035, 1],
                }),
              },
            ],
          },
        ]}
      >
        <NightSky />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, compact && styles.contentCompact]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.pageColumn, styles.heading, compact && styles.headingCompact]}>
            <Text style={styles.eyebrow}>SLEEP ANALYTICS</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>Night Detail</Text>
            <Text style={styles.subtitle}>
              Review hourly snoring, peak periods, and smart-pillow interventions for each night.
            </Text>
          </View>
          <View style={[styles.pageColumn, styles.companionCard]}>
            <View style={compact && styles.dinosaurStageCompact}>
              <SleepingDinosaurAnimation />
            </View>
            <View style={styles.companionCaption}>
              <Text style={styles.companionEyebrow}>YOUR NIGHTTIME COMPANION</Text>
              <Text style={styles.companionTitle}>Hagosaur</Text>
              <Text style={styles.companionText}>
                Hagosaur keeps watch while your smart pillow builds your nightly sleep summary.
              </Text>
            </View>
          </View>
          <View style={styles.pageColumn}>
            <NightDetailCard
              night={nightDetail}
              nightKeys={nightKeys}
              selectedKey={activeNightKey}
              onSelectNight={setSelectedNightKey}
              events={activeNightEvents}
            />
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071126', overflow: 'hidden' },
  animatedScene: { flex: 1 },
  scroll: { zIndex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },
  contentCompact: { paddingHorizontal: 12, paddingTop: 12 },
  pageColumn: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#071126',
  },
  loadingText: { color: '#b9cbea', fontSize: 13, fontWeight: '600', marginTop: 12, zIndex: 1 },
  heading: { paddingHorizontal: 4, marginBottom: 10 },
  headingCompact: { marginBottom: 4 },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: { color: '#f0f7ff', fontSize: 28, fontWeight: '800', marginBottom: 6 },
  titleCompact: { fontSize: 24 },
  subtitle: { color: '#b9cbea', fontSize: 13, lineHeight: 19 },
  companionCard: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    marginBottom: 14,
  },
  dinosaurStage: {
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dinosaurStageCompact: { height: 166, overflow: 'hidden' },
  dinosaurImage: { width: 330, height: 205 },
  moonGlow: {
    position: 'absolute',
    width: 250,
    height: 120,
    borderRadius: 125,
    backgroundColor: 'rgba(56, 189, 248, 0.09)',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.5,
    shadowRadius: 34,
    elevation: 2,
  },
  companionCaption: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#38bdf8',
  },
  companionEyebrow: {
    color: '#7dd3fc',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  companionTitle: { color: '#eef7ff', fontSize: 20, fontWeight: '800', marginBottom: 2 },
  companionText: { color: '#a9bfdf', fontSize: 12, lineHeight: 17 },
  star: {
    position: 'absolute',
    backgroundColor: '#dff4ff',
    shadowColor: '#7dd3fc',
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  comet: { position: 'absolute', top: 0, left: 0, flexDirection: 'row', alignItems: 'center' },
  cometTail: {
    width: 72,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(125, 211, 252, 0.42)',
  },
  cometHead: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    shadowColor: '#7dd3fc',
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
});
