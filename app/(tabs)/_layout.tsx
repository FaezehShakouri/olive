import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#6B8E23", // Olive green for active state
        tabBarInactiveTintColor: "#6B7280", // Muted gray for inactive state
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: "#151718", // Dark background matching app theme
          borderTopWidth: 1,
          borderTopColor: "rgba(107, 142, 35, 0.2)", // Subtle olive border
          height: 55, // Reduced height
          paddingBottom: 4,
          paddingTop: 4,
          paddingHorizontal: 16,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginTop: -4,
          marginBottom: 0,
        },
        tabBarIconStyle: {
          marginTop: -2,
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
          justifyContent: "center",
          alignItems: "center",
          flex: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 22 : 20}
              name="house.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="days"
        options={{
          title: "History",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 22 : 20}
              name="calendar"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 22 : 20}
              name="gearshape"
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
