// template
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { devSkip } from "@/lib/devSkip";
import { supabase } from "@/lib/supabase";
import { NutritionProvider, useNutrition } from "@/contexts/NutritionContext";
import { MealDraftProvider } from "@/contexts/MealDraftContext";
import { ExerciseProvider } from "@/contexts/ExerciseContext";
import { CommunityProvider } from "@/contexts/CommunityContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider, useNotifications } from "@/contexts/NotificationContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { trpc, trpcClient } from "@/lib/trpc";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function SplashController() {
  const { authInitialized } = useNutrition();

  useEffect(() => {
    if (authInitialized) {
      SplashScreen.hideAsync();
    }
  }, [authInitialized]);

  return null;
}

/** Keeps Expo push token in sync with the signed-in user. */
function PushTokenSync() {
  const { authState } = useNutrition();
  const { syncPushTokenForUser, settings } = useNotifications();
  const userId = authState.userId ?? null;

  useEffect(() => {
    if (!userId || !settings.enabled || !settings.permissionGranted) return;
    void syncPushTokenForUser(userId);
  }, [userId, settings.enabled, settings.permissionGranted, syncPushTokenForUser]);

  return null;
}

/** Open camera or community tab when the user taps a notification. */
function NotificationResponseHandler() {
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    // expo-notifications response APIs are native-only; skip on web preview.
    if (Platform.OS === 'web') return;

    const handleResponse = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handled.current === id) return;
      handled.current = id;

      const data = response.notification.request.content.data as
        | { type?: string }
        | undefined;

      if (data?.type === 'community_scan') {
        router.push('/(tabs)/community');
        return;
      }
      if (data?.type === 'meal_reminder') {
        router.push('/camera-scan');
      }
    };

    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });

    return () => sub.remove();
  }, [router]);

  return null;
}

/**
 * DEV-ONLY (web): press the backtick key (`) 3x within 1s to sign in as the local
 * dev admin account (see EXPO_PUBLIC_DEV_ADMIN_EMAIL/PASSWORD in .env) and jump
 * straight to the main tabs. Never active in production or native builds.
 */
function DevSkipShortcut() {
  const router = useRouter();
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== 'web' || typeof window === 'undefined') return;
    let presses: number[] = [];
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        return;
      }
      if (e.key !== '`') return;
      const now = Date.now();
      presses = presses.filter((t) => now - t < 1000);
      presses.push(now);
      if (presses.length >= 3) {
        presses = [];
        const email = process.env.EXPO_PUBLIC_DEV_ADMIN_EMAIL;
        const password = process.env.EXPO_PUBLIC_DEV_ADMIN_PASSWORD;
        if (!email || !password) {
          console.warn('[dev] shortcut: set EXPO_PUBLIC_DEV_ADMIN_EMAIL/PASSWORD in .env first');
          return;
        }
        devSkip.active = true; // suppress the onboarding auth-guard redirect while sign-in resolves
        console.log('[dev] secret shortcut → signing in as dev admin');
        supabase.auth.signInWithPassword({ email, password }).then(({ error }) => {
          if (error) {
            console.error('[dev] shortcut sign-in failed:', error.message);
            devSkip.active = false;
            return;
          }
          router.replace('/(tabs)');
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="food-search" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="meal-builder" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="manual-food-detail" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="pending-food-detail" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="log-exercise" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="setup-community-profile" options={{ presentation: 'card' }} />
      <Stack.Screen name="create-post" options={{ presentation: 'card' }} />
      <Stack.Screen name="post-detail" options={{ presentation: 'card' }} />
      <Stack.Screen name="create-group" options={{ presentation: 'card' }} />
      <Stack.Screen name="browse-groups" options={{ presentation: 'card' }} />
      <Stack.Screen name="group-settings" options={{ presentation: 'card' }} />
      <Stack.Screen name="story-share" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="camera-scan" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="language-picker" options={{ presentation: 'card' }} />
      <Stack.Screen name="edit-profile" options={{ presentation: 'card' }} />
      <Stack.Screen name="referral-share" options={{ presentation: 'card' }} />
      <Stack.Screen name="legal-terms" options={{ presentation: 'card' }} />
      <Stack.Screen name="legal-privacy" options={{ presentation: 'card' }} />
      <Stack.Screen name="legal-restore-purchase" options={{ presentation: 'card' }} />
      <Stack.Screen name="onboarding-subscription" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <ThemeProvider>
            <NotificationProvider>
              <NutritionProvider>
                <SplashController />
                <PushTokenSync />
                <NotificationResponseHandler />
                <DevSkipShortcut />
                <MealDraftProvider>
                  <SubscriptionProvider>
                    <ExerciseProvider>
                      <CommunityProvider>
                        <GestureHandlerRootView>
                          <RootLayoutNav />
                        </GestureHandlerRootView>
                      </CommunityProvider>
                    </ExerciseProvider>
                  </SubscriptionProvider>
                </MealDraftProvider>
              </NutritionProvider>
            </NotificationProvider>
          </ThemeProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
