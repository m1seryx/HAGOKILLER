import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

interface LoadingScreenProps {
  onLoadingComplete: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoadingComplete }) => {
  const [statusText, setStatusText] = useState('Waking Hagosaur...');
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer1 = setTimeout(() => setStatusText('Opening local sleep database...'), 550);
    const timer2 = setTimeout(() => setStatusText('Loading your profile...'), 1100);
    const timer3 = setTimeout(() => setStatusText('Preparing your sleep dashboard...'), 1650);
    const timer4 = setTimeout(onLoadingComplete, 2200);

    const progressAnimation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2100,
      useNativeDriver: false,
    });
    progressAnimation.start();

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      progressAnimation.stop();
    };
  }, [onLoadingComplete, progressAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <Image
            source={require('../../assets/splash-hagosaur.png')}
            style={styles.splashArt}
            resizeMode="contain"
          />
        </View>

        <View style={styles.brandContainer}>
          <Text style={styles.titlePrefix}>HAGO<Text style={styles.titleSuffix}>KILLER</Text></Text>
          <Text style={styles.subtitle}>SMART SLEEP SYSTEMS</Text>
        </View>

        <View style={styles.loaderContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>SETTING UP YOUR NIGHT</Text>
            <FontAwesome5 name="moon" size={10} color="#7dd3fc" solid />
          </View>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['4%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.loadingText}>{statusText}</Text>
        </View>
      </View>

      <View style={styles.footerContainer}>
        <FontAwesome5 name="shield-alt" size={12} color="#6f8fb4" style={{ marginRight: 6 }} />
        <Text style={styles.footer}>Stored locally on this device</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    backgroundColor: '#071126',
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
    width: 270,
    height: 230,
    marginBottom: 22,
  },
  splashArt: {
    width: '100%',
    height: '100%',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  titlePrefix: { 
    fontSize: 36, 
    fontWeight: '900', 
    color: '#f8fbff',
    letterSpacing: 2,
  },
  titleSuffix: { 
    color: '#0ea5e9',
  },
  subtitle: { 
    fontSize: 10, 
    color: '#8fb2d8',
    letterSpacing: 4, 
    marginTop: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  loaderContainer: { 
    width: 240,
    minHeight: 72,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  progressLabel: {
    color: '#7dd3fc',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  progressTrack: {
    height: 5,
    overflow: 'hidden',
    borderRadius: 5,
    backgroundColor: '#173158',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#38bdf8',
  },
  loadingText: { 
    fontSize: 12, 
    color: '#a9bfdf',
    marginTop: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: { 
    fontSize: 11, 
    color: '#6f8fb4',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
