import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';

export const useFonts = async () => {
  try {
    await Font.loadAsync({
      // Add custom fonts here if needed
    });
  } catch (error) {
    console.warn('Error loading fonts:', error);
  }
};
