import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Animated } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface LoadingScreenProps {
  onLoadingComplete: () => void;
}

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
    <Animated.Text
      style={[
        styles.zzz,
        {
          left: baseX,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {letter}
    </Animated.Text>
  );
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoadingComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onLoadingComplete, 3000);
    return () => clearTimeout(timer);
  }, [onLoadingComplete]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>

        {/* Bed icon + ZZZ wrapper */}
        <View style={styles.iconWrapper}>
          <FontAwesome5 name="bed" size={64} color="#3b82f6" />
          <ZzzDot letter="z" delay={0}   baseX={52} />
          <ZzzDot letter="Z" delay={350} baseX={66} />
          <ZzzDot letter="Z" delay={700} baseX={80} />
        </View>

        <Text style={styles.title}>Smart Pillow</Text>
        <Text style={styles.subtitle}>Sleep Analytics Dashboard</Text>

        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>

        <Text style={styles.loadingText}>Connecting to device...</Text>
      </View>

      <Text style={styles.footer}>Monitoring your sleep health</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#1a1a2e',
    justifyContent: 'space-between', alignItems: 'center', paddingBottom: 40,
  },
  content: {
    flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%',
  },
  iconWrapper: {
    marginBottom: 24,
    width: 120,
    height: 80,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  zzz: {
    position: 'absolute',
    bottom: 60,
    color: '#93c5fd',
    fontWeight: '800',
    fontSize: 18,
  },
  title: { fontSize: 32, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#9ca3af', marginBottom: 60 },
  loaderContainer: { marginVertical: 40 },
  loadingText: { fontSize: 14, color: '#6b7280', marginTop: 20, fontStyle: 'italic' },
  footer: { fontSize: 12, color: '#4b5563' },
});
