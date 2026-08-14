import 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { registerRootComponent } from 'expo';

if (Platform.OS === 'web') {
  enableScreens(false);
}

const App = require('./App').default;
registerRootComponent(App);
