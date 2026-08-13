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
import { UserContext } from './src/context/UserContext';
import { DeviceProvider } from './src/context/DeviceContext';
import { UserProfile } from './src/types';
import { bleService } from './src/services/mockBLEService';
import {
  hydrateNotificationPref,
  setupSnoreNotifications,
  notifySnoreDetected,
} from './src/services/snoreNotifications';
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
  return <DashboardScreen userName={userName} userProfile={userProfile} />;
};

const LogsTabScreen = () => <LogsScreen />;

const SettingsTabScreen = () => <SettingsScreen />;

const TabIcon = ({
  name,
  color,
  focused,
}: {
  name: React.ComponentProps<typeof FontAwesome5>['name'];
  color: string;
  focused: boolean;
}) => (
  <View style={[styles.tabIconWell, focused && styles.tabIconWellActive]}>
    <FontAwesome5 name={name} color={color} size={16} solid />
  </View>
);

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      lazy: true,
      tabBarShowLabel: false,
      tabBarHideOnKeyboard: true,
      tabBarStyle: {
        backgroundColor: 'rgba(12, 13, 20, 0.98)',
        borderTopColor: 'rgba(255,255,255,0.08)',
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: 8,
        paddingHorizontal: 10,
        elevation: 0,
        shadowOpacity: 0,
      },
      tabBarItemStyle: {
        paddingVertical: 6,
      },
      tabBarActiveTintColor: '#a5b4fc',
      tabBarInactiveTintColor: '#6b7280',
    }}
  >
    <Tab.Screen
      name="DashboardTab"
      component={DashboardTabScreen}
      options={{
        tabBarIcon: ({ color, focused }) => (
          <TabIcon name="chart-pie" color={color} focused={focused} />
        ),
      }}
    />
    <Tab.Screen
      name="LogsTab"
      component={LogsTabScreen}
      options={{
        tabBarIcon: ({ color, focused }) => (
          <TabIcon name="clipboard-list" color={color} focused={focused} />
        ),
      }}
    />
    <Tab.Screen
      name="SettingsTab"
      component={SettingsTabScreen}
      options={{
        tabBarIcon: ({ color, focused }) => (
          <TabIcon name="cog" color={color} focused={focused} />
        ),
      }}
    />
  </Tab.Navigator>
);

const SnoreAlertHost = () => {
  useEffect(() => {
    hydrateNotificationPref()
      .then((enabled) => {
        if (enabled) return setupSnoreNotifications();
      })
      .catch(() => undefined);

    return bleService.subscribeEvents((event) => {
      notifySnoreDetected(event).catch(() => undefined);
    });
  }, []);
  return null;
};

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
      <DeviceProvider>
      <SnoreAlertHost />
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
      </DeviceProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0b10' },
  tabIconWell: {
    width: 44,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWellActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
  },
});
