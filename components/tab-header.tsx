import { View, type ViewProps } from 'react-native';
import { ThemedText } from './themed-text';

interface TabHeaderProps extends ViewProps {
  title: string;
  subtitle?: string;
}

export function TabHeader({ title, subtitle, style, ...otherProps }: TabHeaderProps) {
  return (
    <View style={[{ paddingBottom: 4 }, style]} {...otherProps}>
      <ThemedText type="title" style={{ fontSize: 24, marginBottom: subtitle ? 4 : 0 }}>
        {title}
      </ThemedText>
      {subtitle && (
        <ThemedText type="muted" style={{ fontSize: 14 }}>
          {subtitle}
        </ThemedText>
      )}
    </View>
  );
}
