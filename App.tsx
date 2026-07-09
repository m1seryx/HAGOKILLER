import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome5 } from '@expo/vector-icons';

import { LoadingScreen } from './src/screens/LoadingScreen';
import { NameInputScreen } from './src/screens/NameInputScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { NightDetailScreen } from './src/screens/NightDetailScreen';
import { LogsScreen } from './src/screens/LogsScreen';
import { MockBLEService } from './src/services/mockBLEService';
import { SleepEvent } from './src/types';

try { SplashScreen.preventAutoHideAsync(); } catch (_) {}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = ({ userName, events }: { userName: string; events: SleepEvent[] }) => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#111219',
        borderTopColor: 'rgba(255,255,255,0.06)',
        borderTopWidth: 1,
        paddingBottom: 6,
        paddingTop: 6,
        height: 60,
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
      children={() => <DashboardScreen userName={userName} />}
      options={{
        tabBarLabel: 'Dashboard',
        tabBarIcon: ({ color, size }) => (
          <FontAwesome5 name="chart-pie" color={color} size={size - 4} />
        ),
      }}
    />
    <Tab.Screen
      name="LogsTab"
      children={() => <LogsScreen />}
      initialParams={{ events }}
      options={{
        tabBarLabel: 'Logs',
        tabBarIcon: ({ color, size }) => (
          <FontAwesome5 name="terminal" color={color} size={size - 4} />
        ),
      }}
    />
  </Tab.Navigator>
);

export default function App() {
  const [userName, setUserName] = useState('');
  const [events, setEvents] = useState<SleepEvent[]>([]);
  const bleService = useRef(new MockBLEService()).current;

  useEffect(() => {
    try { SplashScreen.hideAsync(); } catch (_) {}
    // Pre-load events so the Logs tab has data immediately
    bleService.fetchSleepEvents().then(setEvents);
  }, []);

  const MyTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#0a0b10',
    },
  };

  return (
    <View style={styles.container}>
      <NavigationContainer theme={MyTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>

          <Stack.Screen name="Loading">
            {(props) => (
              <LoadingScreen
                onLoadingComplete={() => props.navigation.replace('NameInput')}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="NameInput">
            {(props) => (
              <NameInputScreen
                onNameSubmit={(name) => {
                  setUserName(name);
                  props.navigation.replace('Main');
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Main">
            {() => <MainTabs userName={userName} events={events} />}
          </Stack.Screen>

          {/* Overlay Screens (hides tab bar) */}
          <Stack.Screen
            name="NightDetail"
            component={NightDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />

        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0b10' },
});
