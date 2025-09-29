import { SplashScreen } from "@/components/splash-screen";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions } from "react-native";
import "react-native-reanimated";

const { width } = Dimensions.get("window");

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const splashAnim = useRef(new Animated.Value(0)).current;
  const appAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    // Simulate app initialization
    const timer = setTimeout(() => {
      // Start transition animations simultaneously
      Animated.parallel([
        // Splash screen slides out to the left
        Animated.timing(splashAnim, {
          toValue: -width,
          duration: 500,
          useNativeDriver: true,
        }),
        // App slides in from the right
        Animated.timing(appAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsLoading(false);
      });
    }, 3000); // Start transition after 3 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={{ flex: 1, position: "relative" }}>
      {/* Splash Screen */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ translateX: splashAnim }],
        }}
      >
        <SplashScreen
          onAnimationFinish={() => {
            // Animation finished, but we still wait for the timer
          }}
        />
      </Animated.View>

      {/* Main App */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ translateX: appAnim }],
        }}
      >
        <ThemeProvider value={DarkTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "Modal" }}
            />
          </Stack>
          <StatusBar
            style="light"
            backgroundColor="#000000"
            translucent={false}
          />
        </ThemeProvider>
      </Animated.View>
    </Animated.View>
  );
}
