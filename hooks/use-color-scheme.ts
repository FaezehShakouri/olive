import { getThemeOverride, subscribeTheme } from '@/lib/theme';
import React from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export function useColorScheme(): 'light' | 'dark' {
  const system = useSystemColorScheme();
  const [override, setOverride] = React.useState<null | 'light' | 'dark'>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const v = await getThemeOverride();
      if (mounted) setOverride(v);
    })();
    const unsub = subscribeTheme((v) => mounted && setOverride(v));
    return () => { mounted = false; unsub(); };
  }, []);

  const resolved = override ?? (system === 'dark' ? 'dark' : 'light');
  return resolved;
}
