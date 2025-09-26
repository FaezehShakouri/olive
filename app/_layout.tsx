import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeOverride, subscribeTheme } from "@/lib/theme";
import React from "react";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const [override, setOverride] = React.useState<"light" | "dark" | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const v = await getThemeOverride();
      if (mounted) setOverride(v);
    })();
    const unsub = subscribeTheme((v) => mounted && setOverride(v));
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const colorScheme = override ?? systemScheme;

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar
        style={colorScheme === "dark" ? "light" : "dark"}
        backgroundColor={colorScheme === "dark" ? "#000000" : "#F7F7F7"}
        translucent={false}
      />
    </ThemeProvider>
  );
}
