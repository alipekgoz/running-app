import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DebugScreen } from '../screens/DebugScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MapScreen } from '../screens/MapScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

export type RootStackParamList = {
  Home: undefined;
  Map: undefined;
  Profile: undefined;
  Debug: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Map">
        <Stack.Screen component={HomeScreen} name="Home" />
        <Stack.Screen component={MapScreen} name="Map" />
        <Stack.Screen component={ProfileScreen} name="Profile" />
        <Stack.Screen component={DebugScreen} name="Debug" />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
