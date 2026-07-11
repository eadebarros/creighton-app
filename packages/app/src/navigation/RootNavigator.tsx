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
import { InvitePartnerScreen } from '../screens/partner/InvitePartnerScreen';
import { getDb } from '../db/client';
import { getActiveCycle } from '../db/cycleRepository';
import { hasEntryForDate } from '../db/entryRepository';
import { today } from '../domain/dateMath';
import { useSyncLifecycle } from '../sync/useSyncLifecycle';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** If today's entry already exists, skip straight to the chart instead of forcing the capture flow again. */
async function redirectToChartIfAlreadyRegisteredToday(): Promise<void> {
  const db = await getDb();
  const activeCycle = await getActiveCycle(db);
  if (!activeCycle) {
    return;
  }
  const already = await hasEntryForDate(db, activeCycle.id, today());
  if (already && navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: 'Chart' }] });
  }
}

export function RootNavigator() {
  useSyncLifecycle();

  return (
    <NavigationContainer ref={navigationRef} onReady={redirectToChartIfAlreadyRegisteredToday}>
      <CaptureFlowProvider>
        <Stack.Navigator initialRouteName="Bleeding" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Bleeding" component={BleedingScreen} />
          <Stack.Screen name="Sensation" component={SensationScreen} />
          <Stack.Screen name="MucusColor" component={MucusColorScreen} />
          <Stack.Screen name="MucusStretch" component={MucusStretchScreen} />
          <Stack.Screen name="Intercourse" component={IntercourseScreen} />
          <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
          <Stack.Screen name="Chart" component={ChartScreen} />
          <Stack.Screen name="InvitePartner" component={InvitePartnerScreen} />
        </Stack.Navigator>
      </CaptureFlowProvider>
    </NavigationContainer>
  );
}
