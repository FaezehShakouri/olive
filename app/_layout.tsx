import { SplashScreen } from "@/components/splash-screen";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate app initialization
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3500); // Show splash for 3.5 seconds

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <SplashScreen
        onAnimationFinish={() => {
          // Animation finished, but we still wait for the timer
        }}
      />
    );
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="light" backgroundColor="#000000" translucent={false} />
    </ThemeProvider>
  );
}
