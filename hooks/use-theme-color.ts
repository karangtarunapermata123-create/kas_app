import { Colors } from '@/constants/theme';
import { useAccentColor } from '@/hooks/use-accent-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const { accentColor } = useAccentColor();
  const colorFromProps = props[theme];

  if (colorFromProps) return colorFromProps;

  // Override tint dengan accent color pilihan user
  if (colorName === 'tint') return accentColor;

  return Colors[theme][colorName];
}
