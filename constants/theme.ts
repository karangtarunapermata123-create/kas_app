/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#4F46E5'; // Modern Indigo
const tintColorDark = '#818CF8'; // Light Indigo for dark mode

export const Colors = {
  light: {
    text: '#1F2937', // Gray-800
    background: '#F9FAFB', // Gray-50
    card: '#FFFFFF',
    tint: tintColorLight,
    icon: '#6B7280', // Gray-500
    tabIconDefault: '#9CA3AF', // Gray-400
    tabIconSelected: tintColorLight,
    border: '#E5E7EB', // Gray-200
    success: '#10B981', // Emerald-500
    danger: '#EF4444', // Red-500
    muted: '#6B7280', // Gray-500
  },
  dark: {
    text: '#F9FAFB', // Gray-50
    background: '#111827', // Gray-900
    card: '#1F2937', // Gray-800
    tint: tintColorDark,
    icon: '#9CA3AF', // Gray-400
    tabIconDefault: '#6B7280', // Gray-500
    tabIconSelected: tintColorDark,
    border: '#374151', // Gray-700
    success: '#34D399', // Emerald-400
    danger: '#F87171', // Red-400
    muted: '#9CA3AF', // Gray-400
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
