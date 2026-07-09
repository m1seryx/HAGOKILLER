import React, { useEffect, useState, useRef } from 'react';
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
          Animated.timing(opacity, { toValue: 0.8, duration: 400, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -35, duration: 1000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
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
  const [statusText, setStatusText] = useState('Initializing sleep monitor...');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Dynamic loading sequence logs
    const timer1 = setTimeout(() => setStatusText('Scanning for BLE smart pillow...'), 800);
    const timer2 = setTimeout(() => setStatusText('Found SmartPillow-ESP32. Connecting...'), 1600);
    const timer3 = setTimeout(() => setStatusText('Syncing database & analytics...'), 2400);
    const timer4 = setTimeout(onLoadingComplete, 3200);

    // Glowing circle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onLoadingComplete]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        
        {/* Glow Ring bed icon wrapper */}
        <View style={styles.logoWrapper}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.iconCircle}>
            <FontAwesome5 name="bed" size={32} color="#6366f1" />
            <ZzzDot letter="z" delay={0}   baseX={40} />
            <ZzzDot letter="Z" delay={350} baseX={52} />
            <ZzzDot letter="Z" delay={700} baseX={64} />
          </View>
        </View>

        <View style={styles.brandContainer}>
          <Text style={styles.titlePrefix}>HAGO<Text style={styles.titleSuffix}>KILLER</Text></Text>
          <Text style={styles.subtitle}>SMART SLEEP SYSTEMS</Text>
        </View>

        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#6366f1" />
          <Text style={styles.loadingText}>{statusText}</Text>
        </View>
      </View>

      <View style={styles.footerContainer}>
        <FontAwesome5 name="shield-alt" size={12} color="#4b5563" style={{ marginRight: 6 }} />
        <Text style={styles.footer}>Ecosystem paired & encrypted</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    backgroundColor: '#0a0b10', // Space Midnight Black
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingBottom: 40,
  },
  content: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    width: '100%',
  },
  logoWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 140,
    height: 140,
    marginBottom: 32,
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    backgroundColor: 'rgba(99, 102, 241, 0.03)',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(26, 27, 38, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  zzz: {
    position: 'absolute',
    bottom: 50,
    color: '#818cf8',
    fontWeight: '800',
    fontSize: 14,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  titlePrefix: { 
    fontSize: 36, 
    fontWeight: '900', 
    color: '#ffffff', 
    letterSpacing: 2,
  },
  titleSuffix: { 
    color: '#6366f1',
  },
  subtitle: { 
    fontSize: 10, 
    color: '#9ca3af', 
    letterSpacing: 4, 
    marginTop: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  loaderContainer: { 
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
  loadingText: { 
    fontSize: 12, 
    color: '#6b7280', 
    marginTop: 16, 
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: { 
    fontSize: 11, 
    color: '#4b5563',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
