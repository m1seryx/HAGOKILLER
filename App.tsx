import React, { useState, useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { FontAwesome5 } from '@expo/vector-icons';

import { LoadingScreen } from './src/screens/LoadingScreen';
import { NameInputScreen } from './src/screens/NameInputScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LogsScreen } from './src/screens/LogsScreen';
import { AssessmentScreen } from './src/screens/AssessmentScreen';
import { WellnessPlanHistoryScreen } from './src/screens/WellnessPlanHistoryScreen';
import { NightDetailScreen } from './src/screens/NightDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { FaqScreen } from './src/screens/FaqScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { DownloadScreen } from './src/screens/DownloadScreen';
import { UserContext } from './src/context/UserContext';
import { DeviceProvider } from './src/context/DeviceContext';
import { UserProfile } from './src/types';
import { bleService } from './src/services/bleService';
import {
  hydrateNotificationPref,
  setupSnoreNotifications,
  notifySnoreDetected,
} from './src/services/snoreNotifications';
import { scheduleDailyAdviceNotifications } from './src/services/dailyAdviceNotifications';
import {
  ensureRiskAlarmCategory,
  ensureRiskAlarmResponseListener,
  playRiskAlarmSound,
} from './src/services/riskAlarmSound';
import { colors } from './src/constants/theme';
import {
  initDatabase,
  saveUserProfile,
  loadUserProfile,
  loadSleepEvents,
} from './src/services/userStorage';
import { calculateDailyStats, calculateMonthlyStats, calculateTrend } from './src/utils/statsCalculator';
import moment from 'moment';
import { playNightExitAnimation } from './src/services/nightTabTransition';

if (Platform.OS === 'web') {
  enableScreens(false);
}

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const DashboardTabScreen = () => {
  const { userName, userProfile } = React.useContext(UserContext);
  return <DashboardScreen userName={userName} userProfile={userProfile} />;
};

const LogsTabScreen = () => <LogsScreen />;

const AssessmentTabScreen = () => <AssessmentScreen />;

const NightDetailTabScreen = () => <NightDetailScreen />;

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

const CenterNightTabButton = (props: any) => {
  const focused = !!props.accessibilityState?.selected;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Night Detail"
      accessibilityState={props.accessibilityState}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      activeOpacity={0.88}
      style={styles.centerTabButton}
    >
      <View style={styles.centerTabCradle}>
        <View style={[styles.centerTabFab, focused && styles.centerTabFabActive]}>
          <FontAwesome5 name="moon" size={20} color={colors.onAccent} solid />
        </View>
        <Text style={[styles.centerTabLabel, focused && styles.centerTabLabelActive]}>Night</Text>
      </View>
    </TouchableOpacity>
  );
};

const MainTabs = () => {
  const insets = useSafeAreaInsets();
  const exitingNightRef = React.useRef(false);
  return (
  <Tab.Navigator
    screenListeners={({ navigation, route }) => ({
      tabPress: (event) => {
        const state = navigation.getState();
        const currentRoute = state.routes[state.index]?.name;
        if (currentRoute === 'NightDetailTab' && route.name !== 'NightDetailTab') {
          event.preventDefault();
          if (exitingNightRef.current) return;
          exitingNightRef.current = true;
          playNightExitAnimation()
            .then(() => navigation.navigate(route.name as never))
            .finally(() => {
              exitingNightRef.current = false;
            });
        }
      },
    })}
    screenOptions={{
      headerShown: false,
      lazy: true,
      tabBarShowLabel: true,
      tabBarLabelPosition: 'below-icon',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 3 },
      tabBarHideOnKeyboard: true,
      tabBarStyle: {
        backgroundColor: colors.tabBar,
        borderTopColor: colors.tabBarBorder,
        borderTopWidth: StyleSheet.hairlineWidth,
        height: 68 + insets.bottom,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 6,
        paddingHorizontal: 10,
        elevation: 0,
        shadowOpacity: 0,
        overflow: 'visible',
      },
      tabBarItemStyle: {
        paddingVertical: 6,
      },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textMuted,
    }}
  >
    <Tab.Screen
      name="DashboardTab"
      component={DashboardTabScreen}
      options={{
        title: "Overview",
        tabBarIcon: ({ color, focused }) => (
          <TabIcon name="chart-pie" color={color} focused={focused} />
        ),
      }}
    />
    <Tab.Screen
      name="LogsTab"
      component={LogsTabScreen}
      options={{
        title: "Logs",
        tabBarIcon: ({ color, focused }) => (
          <TabIcon name="clipboard-list" color={color} focused={focused} />
        ),
      }}
    />
    <Tab.Screen
      name="NightDetailTab"
      component={NightDetailTabScreen}
      options={{
        title: "Night",
        tabBarButton: (props) => <CenterNightTabButton {...props} />,
        tabBarIcon: () => null,
        tabBarLabel: () => null,
        tabBarActiveTintColor: '#7dd3fc',
        tabBarInactiveTintColor: '#a9bfdf',
        tabBarStyle: {
          backgroundColor: '#071126',
          borderTopColor: '#294a78',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 68 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
          paddingHorizontal: 10,
          elevation: 0,
          shadowOpacity: 0,
          overflow: 'visible',
        },
      }}
    />
    <Tab.Screen
      name="AssessmentTab"
      component={AssessmentTabScreen}
      options={{
        title: "Assessment",
        tabBarIcon: ({ color, focused }) => (
          <TabIcon name="stethoscope" color={color} focused={focused} />
        ),
      }}
    />
    <Tab.Screen
      name="SettingsTab"
      component={SettingsTabScreen}
      options={{
        title: "Settings",
        tabBarIcon: ({ color, focused }) => (
          <TabIcon name="cog" color={color} focused={focused} />
        ),
      }}
    />
  </Tab.Navigator>
  );
};

const SnoreAlertHost = () => {
  useEffect(() => {
    const boot = async () => {
      const enabled = await hydrateNotificationPref();
      if (!enabled) return;
      await setupSnoreNotifications();

      try {
        const events = await loadSleepEvents();
        const today = moment().format('YYYY-MM-DD');
        const month = moment().format('YYYY-MM');
        const todayStats = calculateDailyStats(events, today);
        const thisMonth = calculateMonthlyStats(events, month);
        const prevMonth = calculateMonthlyStats(
          events,
          moment().subtract(1, 'month').format('YYYY-MM'),
        );
        const trend = calculateTrend([prevMonth, thisMonth]);
        await scheduleDailyAdviceNotifications(todayStats.severity, trend);
      } catch {
        await scheduleDailyAdviceNotifications('normal', 'stable');
      }
    };

    boot().catch(() => undefined);
    void ensureRiskAlarmCategory().catch(() => undefined);
    const unsubAlarm = ensureRiskAlarmResponseListener();

    return () => {
      unsubAlarm();
    };
  }, []);

  useEffect(() => {
    return bleService.subscribeEvents((event) => {
      if (event.maxElevationHold) {
        playRiskAlarmSound().catch(() => undefined);
      }
      notifySnoreDetected(event).catch(() => undefined);
    });
  }, []);
  return null;
};

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('HAGOKILLER screen error', error, info.componentStack);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.crash}>
          <View style={styles.crashIcon}>
            <FontAwesome5 name="moon" size={22} color={colors.onAccent} solid />
          </View>
          <Text style={styles.crashEyebrow}>HAGOKILLER RECOVERY</Text>
          <Text style={styles.crashTitle}>The screen needs a quick refresh</Text>
          <Text style={styles.crashBody}>
            Your saved sleep data is safe. Try reopening the screen without closing the app.
          </Text>
          <TouchableOpacity accessibilityRole="button" style={styles.crashButton} onPress={this.retry}>
            <FontAwesome5 name="redo-alt" size={13} color={colors.onAccent} />
            <Text style={styles.crashButtonText}>Reload app screen</Text>
          </TouchableOpacity>
          {__DEV__ ? <Text style={styles.crashDebug}>{this.state.error.message}</Text> : null}
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
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
      background: colors.background,
    },
  };

  const handleLoadingComplete = async (navigation: { replace: (route: string) => void }) => {
    try {
      await initDatabase();
      const profile = await loadUserProfile();

      if (profile) {
        setUserName(profile.name);
        setUserProfile(profile);
        navigation.replace('Main');
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
      await initDatabase();
      await saveUserProfile(profile);
    } catch (_) {
      // Continue even if local save fails
    }
    navigation.replace('Main');
  };

  const isDownloadRoute = Platform.OS === 'web'
    && typeof window !== 'undefined'
    && (window.location.pathname.replace(/\/$/, '') === '/download'
      || new URLSearchParams(window.location.search).has('download'));

  if (isDownloadRoute) {
    return (
      <AppErrorBoundary>
        <SafeAreaProvider>
          <DownloadScreen />
        </SafeAreaProvider>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
    <SafeAreaProvider style={styles.container}>
      <DeviceProvider>
      <SnoreAlertHost />
      <UserContext.Provider value={userValue}>
        <View style={[styles.container, styles.appFrame]}>
          <NavigationContainer theme={MyTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'fade' }}>

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

              <Stack.Screen name="Main" component={MainTabs} />

              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="Faq"
                component={FaqScreen}
                options={{ animation: 'slide_from_right', headerShown: false }}
              />
              <Stack.Screen
                name="About"
                component={AboutScreen}
                options={{ animation: 'slide_from_right', headerShown: false }}
              />

              <Stack.Screen
                name="WellnessPlanHistory"
                component={WellnessPlanHistoryScreen}
                options={{ animation: 'slide_from_right' }}
              />

            </Stack.Navigator>
          </NavigationContainer>
        </View>
      </UserContext.Provider>
      </DeviceProvider>
    </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...Platform.select({
      web: {
        height: '100%',
        minHeight: '100vh' as unknown as number,
      },
      default: {},
    }),
  },
  appFrame: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  crash: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
    alignItems: 'center',
  },
  crashIcon: {
    width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, marginBottom: 16,
  },
  crashEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginBottom: 7 },
  crashTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  crashBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 420 },
  crashButton: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.accent, marginTop: 20,
  },
  crashButtonText: { color: colors.onAccent, fontSize: 13, fontWeight: '800', marginLeft: 8 },
  crashDebug: { color: '#fca5a5', fontSize: 10, lineHeight: 15, marginTop: 16, textAlign: 'center' },
  tabIconWell: {
    width: 44,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWellActive: {
    backgroundColor: colors.accentSoft,
  },
  centerTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  centerTabCradle: {
    width: 76,
    height: 84,
    marginTop: -27,
    alignItems: 'center',
    paddingTop: 8,
  },
  centerTabFab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentDark,
    borderWidth: 4,
    borderColor: colors.surface,
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
  },
  centerTabFabActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#102442',
  },
  centerTabLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  centerTabLabelActive: { color: '#bae6fd' },
});
