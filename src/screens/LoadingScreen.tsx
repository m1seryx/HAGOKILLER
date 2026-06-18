import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface LoadingScreenProps {
  onLoadingComplete: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoadingComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onLoadingComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onLoadingComplete]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <FontAwesome5 name="bed" size={64} color="#3b82f6" style={styles.logo} />
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
    flex: 1,
    backgroundColor: '#1a1a2e',
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
  logo: {
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 60,
  },
  loaderContainer: {
    marginVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 20,
    fontStyle: 'italic',
  },
  footer: {
    fontSize: 12,
    color: '#4b5563',
  },
});
