import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ─────────────────────────────
   Theme Types
───────────────────────────── */
export type ColorTheme = {
    background: string;
    surface: string;
    surfaceHighlight: string;
    surfaceSoft: string;

    textPrimary: string;
    textSecondary: string;
    textMuted: string;

    primary: string;
    primarySoft: string;

    border: string;
    cardBorder: string;
    borderActive: string;

    success: string;
    successSoft: string;
    danger: string;

    divider: string;
    modalBackdrop: string;
    shadow: string;
};

/* ─────────────────────────────
   LIGHT THEME (Clean Hospital)
───────────────────────────── */
export const LightColors: ColorTheme = {
    background: '#FFFFFF',
    surface: '#F8FAFC',
    surfaceHighlight: '#F1F5F9',
    surfaceSoft: '#F9FAFB',

    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',

    primary: '#0EA5A4',
    primarySoft: 'rgba(14,165,164,0.15)',

    border: '#E2E8F0',
    cardBorder: '#E2E8F0',
    borderActive: '#0EA5A4',

    success: '#16A34A',
    successSoft: 'rgba(22,163,74,0.15)',
    danger: '#EF4444',

    divider: '#E2E8F0',
    modalBackdrop: 'rgba(15, 23, 42, 0.35)',
    shadow: '#000000',
};

/* ─────────────────────────────
   DARK THEME (MATCHES IMAGE 🔥)
───────────────────────────── */
export const DarkColors: ColorTheme = {
    background: '#0B1220',          // deep navy (app bg)
    surface: '#111827',             // cards / sheets
    surfaceHighlight: '#0F1A2B',    // tabs / inputs
    surfaceSoft: '#0E1625',

    textPrimary: '#E5E7EB',         // main text
    textSecondary: '#9CA3AF',       // muted
    textMuted: '#6B7280',

    primary: '#0EA5A4',             // teal accent
    primarySoft: 'rgba(14,165,164,0.18)',

    border: '#1F2937',
    cardBorder: '#1F2937',
    borderActive: '#0EA5A4',

    success: '#22C55E',
    successSoft: 'rgba(34,197,94,0.18)',
    danger: '#F87171',

    divider: '#1F2937',
    modalBackdrop: 'rgba(0,0,0,0.75)',
    shadow: '#000000',
};

/* ─────────────────────────────
   Context Types
───────────────────────────── */
type ThemeContextType = {
    isDark: boolean;
    colors: ColorTheme;
    toggleTheme: () => void;
    setTheme: (theme: 'light' | 'dark') => void;
    resetTheme: () => void;
};

/* ─────────────────────────────
   Context
───────────────────────────── */
const ThemeContext = createContext<ThemeContextType>({
    isDark: false,
    colors: LightColors,
    toggleTheme: () => { },
    setTheme: () => { },
    resetTheme: () => { },
});

/* ─────────────────────────────
   Provider
───────────────────────────── */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const systemScheme = useColorScheme();
    const [isDark, setIsDark] = useState(systemScheme === 'dark');

    // Load saved theme
    useEffect(() => {
        const loadTheme = async () => {
            const saved = await AsyncStorage.getItem('user_theme');
            if (saved === 'dark' || saved === 'light') {
                setIsDark(saved === 'dark');
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = () => {
        setIsDark(prev => !prev);
    };

    const setTheme = (theme: 'light' | 'dark') => {
        setIsDark(theme === 'dark');
    };

    const resetTheme = () => {
        setIsDark(false);
        AsyncStorage.setItem('user_theme', 'light');
    };

    // Save theme when it changes
    useEffect(() => {
        AsyncStorage.setItem('user_theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    return (
        <ThemeContext.Provider
            value={{
                isDark,
                colors: isDark ? DarkColors : LightColors,
                toggleTheme,
                setTheme,
                resetTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
};

/* ─────────────────────────────
   Hook
───────────────────────────── */
export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
