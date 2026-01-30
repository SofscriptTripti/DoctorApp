import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from './theme/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');

type Props = {
  route: {
    params: {
      storageKey: string;
      totalPages: number;
      title: string;
    };
  };
  navigation: any;
};

export default function ImagePdfViewer({ route, navigation }: Props) {
  const { isDark, colors } = useTheme();
  const { storageKey, title } = route.params;

  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---------- LOAD IMAGES ---------- */

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) {
        console.warn('No stored editor data for key:', storageKey);
        return;
      }

      const parsed = JSON.parse(raw);
      const bitmaps = Array.isArray(parsed?.bitmaps)
        ? parsed.bitmaps
        : [];

      const paths = bitmaps
        .map((b: any) => b?.bitmapPath)
        .filter(Boolean);

      // 🔍 DEBUG (keep once if needed)
      console.log('ImagePdfViewer bitmap paths:', paths);

      setImagePaths(paths);
    } catch (e) {
      console.warn('Failed to load images', e);
    } finally {
      setLoading(false);
    }
  };


  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? colors.background : '#F1F5F9' }]}>
      {/* Header */}
      <View style={[styles.header, !isDark && { backgroundColor: '#0EA5A4' }, isDark && { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[
            { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
            !isDark && { backgroundColor: 'rgba(255,255,255,0.18)' },
            isDark && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#0EA5A4' }
          ]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={isDark ? '#0EA5A4' : '#fff'}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, !isDark && { color: '#fff' }, isDark && { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0EA5A4" />
          <Text style={[{ marginTop: 8 }, { color: colors.textPrimary }]}>Loading pages…</Text>
        </View>
      )}

      {/* Pages */}
      {!loading && (
        <ScrollView contentContainerStyle={styles.scroll}>
          {imagePaths.map((path, idx) => {
            // ✅ FIX: handle both with and without file://
            const uri = path.startsWith('file://')
              ? path
              : `file://${path}`;

            return (
              <View key={idx} style={styles.pageWrap}>
                <Image
                  source={{ uri }}
                  style={styles.pageImage}
                  resizeMode="contain"
                />
                <Text style={[styles.pageLabel, isDark && { color: colors.textSecondary }]}>
                  Page {idx + 1} of {imagePaths.length}
                </Text>
              </View>
            );
          })}

          {imagePaths.length === 0 && (
            <Text style={[styles.empty, isDark && { color: colors.textSecondary }]}>
              No saved pages found
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  header: {
    height: 52,
    backgroundColor: '#0EA5A4',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },

  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scroll: {
    paddingBottom: 24,
  },

  pageWrap: {
    marginBottom: 24,
    alignItems: 'center',
  },

  pageImage: {
    width: SCREEN_W,
    height: SCREEN_W * 1.4,
    backgroundColor: '#fff',
  },

  pageLabel: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
  },

  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
});
