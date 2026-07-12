import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import { useFonts } from 'expo-font';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import { RoleGate } from './src/navigation/RoleGate';
import { AuthScreen } from './src/screens/auth/AuthScreen';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY — copy packages/app/.env.example to .env and fill it in.');
}

SplashScreen.preventAutoHideAsync();

// Required by expo-web-browser's OAuth redirect flow (Google/Apple sign-in
// via Clerk's useSSO) — no-op on native, needed so a pending auth session
// resolves correctly on web.
WebBrowser.maybeCompleteAuthSession();

// Daily registro reminder (SPEC 03 §3.3) — shows the banner/sound even if the
// notification fires while the app happens to be in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Must render inside <ClerkProvider> — useAuth() needs that context. */
function AuthGate() {
  const { isSignedIn } = useAuth();
  return isSignedIn ? <RoleGate /> : <AuthScreen />;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <ClerkLoaded>
            <AuthGate />
          </ClerkLoaded>
          <StatusBar style="auto" />
        </View>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
