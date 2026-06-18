import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { NameInputScreen } from './src/screens/NameInputScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';

try { SplashScreen.preventAutoHideAsync(); } catch (_) {}

type AppStep = 'loading' | 'name-input' | 'dashboard';

export default function App() {
  const [step, setStep] = useState<AppStep>('loading');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    try { SplashScreen.hideAsync(); } catch (_) {}
  }, []);

  return (
    <View style={styles.container}>
      {step === 'loading' && (
        <LoadingScreen onLoadingComplete={() => setStep('name-input')} />
      )}
      {step === 'name-input' && (
        <NameInputScreen onNameSubmit={(name) => { setUserName(name); setStep('dashboard'); }} />
      )}
      {step === 'dashboard' && (
        <DashboardScreen userName={userName} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
});
