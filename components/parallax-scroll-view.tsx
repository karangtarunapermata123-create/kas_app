import type { PropsWithChildren, ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedRef,
    useAnimatedStyle
} from 'react-native-reanimated';

import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

const HEADER_HEIGHT = 250;

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
  headerHeight?: number;
  contentStyle?: object;
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
  headerHeight,
  contentStyle,
}: Props) {
  const backgroundColor = useThemeColor({}, 'background');
  const colorScheme = useColorScheme() ?? 'light';
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollOffset.value = e.contentOffset.y;
  });
  const hh = headerHeight ?? HEADER_HEIGHT;
  const headerAnimatedStyle = useAnimatedStyle(() => {
    if (hh <= 0) return {};
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-hh, 0, hh],
            [-hh / 2, 0, hh * 0.75]
          ),
        },
        {
          scale: interpolate(scrollOffset.value, [-hh, 0, hh], [2, 1, 1]),
        },
      ],
    };
  });

  return (
    <Animated.ScrollView
      ref={scrollRef}
      onScroll={onScroll}
      style={{ backgroundColor, flex: 1 }}
      scrollEventThrottle={16}>
      {hh > 0 ? (
        <Animated.View
          style={[
            styles.header,
            { height: hh, backgroundColor: headerBackgroundColor[colorScheme] },
            headerAnimatedStyle,
          ]}>
          {headerImage}
        </Animated.View>
      ) : null}
      <ThemedView style={[styles.content, contentStyle]}>{children}</ThemedView>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 32,
    gap: 16,
    overflow: 'hidden',
  },
});
