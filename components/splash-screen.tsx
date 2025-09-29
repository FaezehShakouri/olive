import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Image, StyleSheet, View } from "react-native";
import { ThemedText } from "./themed-text";

const { width, height } = Dimensions.get("window");

interface SplashScreenProps {
  onAnimationFinish?: () => void;
}

export function SplashScreen({ onAnimationFinish }: SplashScreenProps) {
  const line1Anim = useRef(new Animated.Value(0)).current;
  const line2Anim = useRef(new Animated.Value(0)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate lines and logo
    Animated.sequence([
      // Animate lines first
      Animated.parallel([
        Animated.timing(line1Anim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(line2Anim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
      // Then animate logo
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Animated Background Lines */}
      <View style={styles.linesContainer}>
        {/* Line 1 - Above logo and text */}
        <Animated.View
          style={[
            styles.line,
            styles.line1,
            {
              opacity: line1Anim,
              transform: [
                {
                  scaleX: line1Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ],
            },
          ]}
        />

        {/* Line 2 - Below logo and text */}
        <Animated.View
          style={[
            styles.line,
            styles.line2,
            {
              opacity: line2Anim,
              transform: [
                {
                  scaleX: line2Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoAnim,
            transform: [
              {
                scale: logoAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Image
          source={require("@/assets/images/olive-logo-transparent.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* App Subtitle */}
      <Animated.View
        style={[
          styles.subtitleContainer,
          {
            opacity: logoAnim,
            transform: [
              {
                translateY: logoAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <ThemedText style={styles.subtitle}>Calorie Tracker</ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#151718", // Same as app background
  },
  linesContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  line: {
    position: "absolute",
    backgroundColor: "rgba(107, 142, 35, 0.1)", // Olive green with low opacity
    height: 2,
    width: "60%",
    left: "20%",
  },
  line1: {
    top: "35%", // Above the logo
  },
  line2: {
    top: "65%", // Below the text
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  logo: {
    width: 200,
    height: 200,
  },
  subtitleContainer: {
    marginTop: 10,
    zIndex: 10,
  },
  subtitle: {
    fontSize: 18,
    color: "#9CA3AF",
    fontWeight: "400",
    letterSpacing: 1,
  },
});
