import { Children, useState, type ReactNode } from "react";
import {
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/** Shared adaptive layout primitives. Breakpoints use the current window, so they
 * respond to rotation, split-screen and resizable windows. */
export const RESPONSIVE_BREAKPOINTS = { compact: 360, medium: 600, expanded: 840 } as const;
export const LAYOUT_TOKENS = {
  pageGutter: { compact: 16, standard: 20, wide: 28 },
  contentMaxWidth: 1120,
  formMaxWidth: 680,
  gridGap: 16,
  touchTargetMinHeight: 48,
  buttonMinHeight: 54,
} as const;

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const compact = width < RESPONSIVE_BREAKPOINTS.compact;
  const medium = width >= RESPONSIVE_BREAKPOINTS.medium;
  const expanded = width >= RESPONSIVE_BREAKPOINTS.expanded;
  const pageGutter = compact ? LAYOUT_TOKENS.pageGutter.compact : medium ? LAYOUT_TOKENS.pageGutter.wide : LAYOUT_TOKENS.pageGutter.standard;
  const availableWidth = Math.min(width, LAYOUT_TOKENS.contentMaxWidth) - pageGutter * 2;
  return {
    width,
    height,
    fontScale,
    compact,
    medium,
    expanded,
    breakpoint: compact ? "compact" : medium ? (expanded ? "expanded" : "medium") : "standard",
    pageGutter,
    columns: Math.max(1, Math.floor((availableWidth + LAYOUT_TOKENS.gridGap) / (280 + LAYOUT_TOKENS.gridGap))),
  } as const;
}

export function ContentContainer({ children, maxWidth = LAYOUT_TOKENS.contentMaxWidth, style }: { children: ReactNode; maxWidth?: number; style?: StyleProp<ViewStyle> }) {
  const { pageGutter } = useResponsiveLayout();
  return <View style={[{ width: "100%", maxWidth, alignSelf: "center", paddingHorizontal: pageGutter }, style]}>{children}</View>;
}

export function ResponsiveGrid({ children, minItemWidth = 280, gap = LAYOUT_TOKENS.gridGap, style }: { children: ReactNode; minItemWidth?: number; gap?: number; style?: StyleProp<ViewStyle> }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const items = Children.toArray(children);
  const columns = containerWidth > 0 ? Math.max(1, Math.floor((containerWidth + gap) / (minItemWidth + gap))) : 1;
  const itemWidth = containerWidth > 0 ? Math.max(0, (containerWidth - gap * (columns - 1)) / columns) : undefined;
  const onLayout = (event: LayoutChangeEvent) => setContainerWidth(event.nativeEvent.layout.width);
  return <View onLayout={onLayout} style={[{ flexDirection: "row", flexWrap: "wrap", gap }, style]}>{items.map((child, index) => <View key={index} style={{ width: itemWidth, minWidth: 0 }}>{child}</View>)}</View>;
}

export function ResponsiveRow({ children, minWidth = 420, gap = 12, style }: { children: ReactNode; minWidth?: number; gap?: number; style?: StyleProp<ViewStyle> }) {
  const { width } = useWindowDimensions();
  return <View style={[{ flexDirection: width >= minWidth ? "row" : "column", gap, minWidth: 0 }, style]}>{children}</View>;
}

