import React, { useRef, useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, StatusBar, Animated, Easing, Platform } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import Svg, { Image as SvgImage, Defs, Mask, Rect, Circle } from 'react-native-svg';
import ThemeContext, { LightColors, DarkColors, ColorTheme } from '../theme/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_RADIUS = Math.hypot(SCREEN_WIDTH, SCREEN_HEIGHT);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const ThemeRevealProvider = ({ children }: { children: React.ReactNode }) => {
    const [isDark, setIsDark] = useState(false);
    const [snapshot, setSnapshot] = useState<string | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Animation value for the radius (0 -> MAX_RADIUS)
    const radius = useRef(new Animated.Value(0)).current;
    const touchCoords = useRef({ x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 });

    const viewShotRef = useRef<ViewShot>(null);

    const colors = isDark ? DarkColors : LightColors;

    const toggleTheme = async (coords?: { x: number; y: number }) => {
        if (isTransitioning) return;

        // 1. Set origin coordinates - CRITICAL: Must be set BEFORE capture/start
        // If coords are provided, use them. Otherwise center.
        const origin = coords || { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 };
        touchCoords.current = origin;

        try {
            // 2. Capture the current screen (Old Theme)
            // Note: captureRef works on the viewShotRef
            const uri = await captureRef(viewShotRef, {
                format: 'png',
                quality: 0.8, // Slightly lower quality for speed
                result: 'tmpfile'
            });

            console.log("Snapshot captured", uri);
            setSnapshot(uri);

            // 3. Start Transition State - Renders Overlay
            setIsTransitioning(true);
            radius.setValue(0); // Reset animation

            // 4. CHANGE THEME STATE
            // This causes the MAIN APP (underneath) to re-render with NEW colors immediately
            setIsDark(prev => !prev);

            // 5. Animate the 'Hole' (Reveal the new theme underneath)
            Animated.timing(radius, {
                toValue: MAX_RADIUS * 1.5, // Ensure full coverage
                duration: 600,
                useNativeDriver: false, // SVG Props require JS driver usually
                easing: Easing.bezier(0.25, 1, 0.5, 1) // EaseOutQuint for snappy feel
            }).start(() => {
                // Cleanup
                setIsTransitioning(false);
                setSnapshot(null);
            });

        } catch (error) {
            console.error('Failed to capture theme snapshot', error);
            // Fallback: just switch theme instantly
            setIsDark(prev => !prev);
        }
    };

    const contextValue = useMemo(() => ({
        isDark,
        colors,
        toggleTheme,
    }), [isDark, colors]);

    return (
        <ThemeContext.Provider value={contextValue}>
            <View style={{ flex: 1 }}>
                <StatusBar
                    barStyle={isDark ? 'light-content' : 'dark-content'}
                    backgroundColor="transparent"
                    translucent
                />

                {/* Main App Content - Wrapped in ViewShot */}
                <ViewShot
                    ref={viewShotRef}
                    style={{ flex: 1, backgroundColor: colors.background }}
                    options={{ format: 'png', quality: 0.9 }}
                >
                    {children}
                </ViewShot>

                {/* Overlay: Rendered ON TOP when transitioning */}
                {isTransitioning && snapshot && (
                    <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} pointerEvents="none">
                        <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                            <Defs>
                                <Mask id="mask">
                                    {/* Everything white is visible (the snapshot) */}
                                    <Rect x="0" y="0" width="100%" height="100%" fill="white" />

                                    {/* Everything black is hidden (the hole revealing new theme) */}
                                    <AnimatedCircle
                                        cx={touchCoords.current.x}
                                        cy={touchCoords.current.y}
                                        r={radius}
                                        fill="black"
                                    />
                                </Mask>
                            </Defs>

                            {/* The Old Theme Snapshot */}
                            <SvgImage
                                x="0"
                                y="0"
                                width="100%"
                                height="100%"
                                preserveAspectRatio="xMidYMid slice"
                                href={{ uri: snapshot }}
                                mask="url(#mask)"
                            />
                        </Svg>
                    </View>
                )}
            </View>
        </ThemeContext.Provider>
    );
};
