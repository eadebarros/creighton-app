import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CaptureFlowProvider } from '../screens/capture/CaptureFlowContext';
import { BleedingScreen } from '../screens/capture/BleedingScreen';
import { SensationScreen } from '../screens/capture/SensationScreen';
import { MucusColorScreen } from '../screens/capture/MucusColorScreen';
import { MucusStretchScreen } from '../screens/capture/MucusStretchScreen';
import { IntercourseScreen } from '../screens/capture/IntercourseScreen';
import { ConfirmationScreen } from '../screens/capture/ConfirmationScreen';
import { ChartScreen } from '../screens/chart/ChartScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <CaptureFlowProvider>
        <Stack.Navigator initialRouteName="Bleeding" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Bleeding" component={BleedingScreen} />
          <Stack.Screen name="Sensation" component={SensationScreen} />
          <Stack.Screen name="MucusColor" component={MucusColorScreen} />
          <Stack.Screen name="MucusStretch" component={MucusStretchScreen} />
          <Stack.Screen name="Intercourse" component={IntercourseScreen} />
          <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
          <Stack.Screen name="Chart" component={ChartScreen} />
        </Stack.Navigator>
      </CaptureFlowProvider>
    </NavigationContainer>
  );
}
