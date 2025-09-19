import type { PropsWithChildren } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView as RNSafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = PropsWithChildren<
  SafeAreaViewProps & {
    style?: ViewStyle | ViewStyle[];
  }
>;

export function ThemedSafeAreaView({ children, style, edges = ['top', 'left', 'right'], ...rest }: Props) {
  const backgroundColor = useThemeColor({}, 'background');
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <RNSafeAreaView
      style={[styles.container, { backgroundColor }, style]}
      edges={edges}
      {...rest}
    >
      <StatusBar
        style={colorScheme === 'dark' ? 'light' : 'dark'}
        backgroundColor={backgroundColor as string}
        translucent={false}
      />
      {children}
    </RNSafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});