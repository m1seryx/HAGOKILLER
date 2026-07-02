import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { NameInputScreen } from './src/screens/NameInputScreen';
import { PairingPinScreen } from './src/screens/PairingPinScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { UserProfile } from './src/types';

try { SplashScreen.preventAutoHideAsync(); } catch (_) {}

type AppStep = 'loading' | 'name-input' | 'pairing-pin' | 'dashboard';

export default function App() {
  const [step, setStep] = useState<AppStep>('loading');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    try { SplashScreen.hideAsync(); } catch (_) {}
  }, []);

  return (
    <View style={styles.container}>
      {step === 'loading' && (
        <LoadingScreen onLoadingComplete={() => setStep('name-input')} />
      )}
      {step === 'name-input' && (
        <NameInputScreen onProfileSubmit={(profile) => { setUserProfile(profile); setStep('pairing-pin'); }} />
      )}
      {step === 'pairing-pin' && (
        <PairingPinScreen onPinSubmit={() => setStep('dashboard')} />
      )}
      {step === 'dashboard' && (
        <DashboardScreen userName={userProfile?.name || ''} userProfile={userProfile || undefined} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
});
