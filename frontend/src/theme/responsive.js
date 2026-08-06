import { useWindowDimensions } from 'react-native';

// A browser on a phone is still reported as `web` by React Native Web.
// Use the viewport instead of Platform.OS for layout decisions.
export const MOBILE_BREAKPOINT = 768;
export const COMPACT_BREAKPOINT = 480;

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  return {
    width,
    height,
    isMobile: width < MOBILE_BREAKPOINT,
    isCompact: width < COMPACT_BREAKPOINT,
    pagePadding: width < 360 ? 12 : 16,
  };
}
