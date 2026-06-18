import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';

try { SplashScreen.preventAutoHideAsync(); } catch (_) {}

export default function App() {
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    try { SplashScreen.hideAsync(); } catch (_) {}
  }, []);

  return (
    <View style={styles.container}>
      {!showDashboard ? (
        <LoadingScreen onLoadingComplete={() => setShowDashboard(true)} />
      ) : (
        <DashboardScreen />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
});
