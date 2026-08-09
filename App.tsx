import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

import { LoadingScreen } from './src/screens/LoadingScreen';
import { NameInputScreen } from './src/screens/NameInputScreen';
import { PairingPinScreen } from './src/screens/PairingPinScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LogsScreen } from './src/screens/LogsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AnimatedTabScene } from './src/components/AnimatedTabScene';
import { UserContext } from './src/context/UserContext';
import { UserProfile } from './src/types';
import {
  saveUserProfile,
  loadUserProfile,
  setDevicePaired,
  isDevicePaired,
} from './src/services/userStorage';

try { SplashScreen.preventAutoHideAsync(); } catch (_) {}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const DashboardTabScreen = () => {
  const { userName, userProfile } = React.useContext(UserContext);
  return (
    <AnimatedTabScene>
      <DashboardScreen userName={userName} userProfile={userProfile} />
    </AnimatedTabScene>
  );
};

const LogsTabScreen = () => (
  <AnimatedTabScene>
    <LogsScreen />
  </AnimatedTabScene>
);

const SettingsTabScreen = () => (
  <AnimatedTabScene>
    <SettingsScreen />
  </AnimatedTabScene>
);

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      lazy: true,
      tabBarStyle: {
        backgroundColor: 'rgba(17, 18, 25, 0.96)',
        borderTopColor: 'rgba(255,255,255,0.08)',
        borderTopWidth: 1,
        paddingBottom: 6,
        paddingTop: 6,
        height: 64,
      },
      tabBarActiveTintColor: '#6366f1',
      tabBarInactiveTintColor: '#6b7280',
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
      },
    }}
  >
    <Tab.Screen
      name="DashboardTab"
      component={DashboardTabScreen}
      options={{
        tabBarLabel: 'Dashboard',
        tabBarIcon: ({ color, size }) => (
          <FontAwesome5 name="chart-pie" color={color} size={size - 4} />
        ),
      }}
    />
    <Tab.Screen
      name="LogsTab"
      component={LogsTabScreen}
      options={{
        tabBarLabel: 'Logs',
        tabBarIcon: ({ color, size }) => (
          <FontAwesome5 name="terminal" color={color} size={size - 4} />
        ),
      }}
    />
    <Tab.Screen
      name="SettingsTab"
      component={SettingsTabScreen}
      options={{
        tabBarLabel: 'Settings',
        tabBarIcon: ({ color, size }) => (
          <FontAwesome5 name="cog" color={color} size={size - 4} />
        ),
      }}
    />
  </Tab.Navigator>
);

export default function App() {
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    try { SplashScreen.hideAsync(); } catch (_) {}
  }, []);

  const userValue = useMemo(
    () => ({
      userName,
      userProfile: userProfile || undefined,
      setUserProfile: (profile: UserProfile) => {
        setUserName(profile.name);
        setUserProfile(profile);
      },
    }),
    [userName, userProfile],
  );

  const MyTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#0a0b10',
    },
  };

  const handleLoadingComplete = async (navigation: { replace: (route: string) => void }) => {
    try {
      const [profile, paired] = await Promise.all([loadUserProfile(), isDevicePaired()]);

      if (profile) {
        setUserName(profile.name);
        setUserProfile(profile);
        navigation.replace(paired ? 'Main' : 'PairingPin');
        return;
      }

      navigation.replace('NameInput');
    } catch (_) {
      navigation.replace('NameInput');
    }
  };

  const handleProfileSubmit = async (
    profile: UserProfile,
    navigation: { replace: (route: string) => void },
  ) => {
    setUserName(profile.name);
    setUserProfile(profile);
    try {
      await saveUserProfile(profile);
    } catch (_) {
      // Continue onboarding even if local save fails
    }
    navigation.replace('PairingPin');
  };

  const handlePairingComplete = async (navigation: { replace: (route: string) => void }) => {
    try {
      await setDevicePaired(true);
    } catch (_) {
      // Still allow demo access if storage write fails
    }
    navigation.replace('Main');
  };

  return (
    <SafeAreaProvider>
      <UserContext.Provider value={userValue}>
        <View style={styles.container}>
          <NavigationContainer theme={MyTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>

              <Stack.Screen name="Loading">
                {(props) => (
                  <LoadingScreen
                    onLoadingComplete={() => handleLoadingComplete(props.navigation)}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="NameInput">
                {(props) => (
                  <NameInputScreen
                    onProfileSubmit={(profile) => handleProfileSubmit(profile, props.navigation)}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="PairingPin">
                {(props) => (
                  <PairingPinScreen
                    onPinSubmit={() => handlePairingComplete(props.navigation)}
                    onSkipDemo={() => handlePairingComplete(props.navigation)}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="Main" component={MainTabs} />

              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ animation: 'slide_from_right' }}
              />

            </Stack.Navigator>
          </NavigationContainer>
        </View>
      </UserContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0b10' },
});
