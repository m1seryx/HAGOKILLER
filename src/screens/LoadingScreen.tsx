import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

interface LoadingScreenProps {
  onLoadingComplete: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoadingComplete }) => {
  const [statusText, setStatusText] = useState('Initializing sleep monitor...');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer1 = setTimeout(() => setStatusText('Scanning for BLE smart pillow...'), 800);
    const timer2 = setTimeout(() => setStatusText('Found SmartPillow-ESP32. Connecting...'), 1600);
    const timer3 = setTimeout(() => setStatusText('Syncing database & analytics...'), 2400);
    const timer4 = setTimeout(onLoadingComplete, 3200);

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 1000, useNativeDriver: true }),
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
          <Image source={require('../../assets/icon.png')} style={styles.splashIcon} />
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
    </SafeAreaView>
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
    width: 168,
    height: 168,
    marginBottom: 32,
  },
  pulseRing: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.28)',
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
  },
  splashIcon: {
    width: 112,
    height: 112,
    borderRadius: 28,
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
