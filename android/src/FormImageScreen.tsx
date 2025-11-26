// src/FormImageScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';

const { width: W, height: H } = Dimensions.get('window');

// Editor canvas dimensions used when drawing strokes (must match editor)
const EDITOR_PAGE_WIDTH = Dimensions.get('window').width;
const EDITOR_PAGE_HEIGHT = Math.round(Dimensions.get('window').height * 0.72);

// try to resolve a module that exports image requires (keeps compatibility)
const resolveImages = (): any | null => {
  try { return require('./Images').default ?? require('./Images'); } catch (_) {}
  try { return require('../android/src/Images').default ?? require('../android/src/Images'); } catch (_) {}
  try { return require('../src/Images').default ?? require('../src/Images'); } catch (_) {}
  return null;
};

const Images = resolveImages();

const LOCAL_IMAGE_LIST = [
  require('./Images/first.jpeg'),
  require('./Images/second.jpeg'),
  require('./Images/Third.jpeg'),
  require('./Images/forth.jpeg'),
  require('./Images/fifth.jpeg'),
  require('./Images/sixtg.jpeg'),
  require('./Images/seventh.jpeg'),
  require('./Images/Eighth.jpeg'),
  require('./Images/Eleventh.jpeg'),
  require('./Images/ninth.jpeg'),
  require('./Images/Tenth.jpeg'),
  require('./Images/Thirteen.jpeg'),
  require('./Images/twelve.jpeg'),
];

// AsyncStorage fallback loader
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

/** Types reused from editor (light) */
type Point = { x: number; y: number; t?: number };
type Stroke = { id: string; color: string; width: number; points: Point[] };

export function FormImageScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const params = (route.params as any) || {};
  const formName: string | undefined = params.formName;
  const perFormStorageKey = (params.storageKey as string | undefined) ?? `DoctorApp:strokesByPage:v1`;

  const [loading, setLoading] = useState(false);
  const [savedFlags, setSavedFlags] = useState<boolean[]>(() => LOCAL_IMAGE_LIST.map(() => false));
  const [savedStrokes, setSavedStrokes] = useState<(Stroke[] | null)[]>(() => LOCAL_IMAGE_LIST.map(() => null));
  const [checkingSaved, setCheckingSaved] = useState(false);

  // catmull->bezier helper (same logic as editor)
  const catmullRom2bezier = (pts: Point[]) => {
    if (!pts || pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    if (pts.length === 2) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i - 1 < 0 ? pts[0] : pts[i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i + 2 >= pts.length ? pts[pts.length - 1] : pts[i + 2];
      const t = 0.5;
      const bp1x = p1.x + (p2.x - p0.x) * t / 3 * 2;
      const bp1y = p1.y + (p2.y - p0.y) * t / 3 * 2;
      const bp2x = p2.x - (p3.x - p1.x) * t / 3 * 2;
      const bp2y = p2.y - (p3.y - p1.y) * t / 3 * 2;
      d += ` C ${bp1x.toFixed(1)} ${bp1y.toFixed(1)}, ${bp2x.toFixed(1)} ${bp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  // Load saved strokes from AsyncStorage and set badges & strokes array
  const checkSavedStrokes = useCallback(async () => {
    if (!AsyncStorage) {
      setSavedFlags(LOCAL_IMAGE_LIST.map(() => false));
      setSavedStrokes(LOCAL_IMAGE_LIST.map(() => null));
      return;
    }

    setCheckingSaved(true);
    try {
      const raw = await AsyncStorage.getItem(perFormStorageKey);
      if (!raw) {
        setSavedFlags(LOCAL_IMAGE_LIST.map(() => false));
        setSavedStrokes(LOCAL_IMAGE_LIST.map(() => null));
        setCheckingSaved(false);
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const flags = LOCAL_IMAGE_LIST.map((_, idx) => {
          const arr = parsed[idx];
          return Array.isArray(arr) && arr.length > 0;
        });

        const strokesArr = LOCAL_IMAGE_LIST.map((_, idx) => {
          const arr = parsed[idx];
          return Array.isArray(arr) ? arr as Stroke[] : null;
        });

        setSavedFlags(flags);
        setSavedStrokes(strokesArr);
      } else {
        setSavedFlags(LOCAL_IMAGE_LIST.map(() => false));
        setSavedStrokes(LOCAL_IMAGE_LIST.map(() => null));
      }
    } catch (e) {
      console.warn('[FormImageScreen] error reading saved strokes:', e);
      setSavedFlags(LOCAL_IMAGE_LIST.map(() => false));
      setSavedStrokes(LOCAL_IMAGE_LIST.map(() => null));
    } finally {
      setCheckingSaved(false);
    }
  }, [perFormStorageKey]);

  useFocusEffect(
    React.useCallback(() => {
      checkSavedStrokes();
    }, [checkSavedStrokes])
  );

  useEffect(() => { checkSavedStrokes(); }, [checkSavedStrokes]);

  const openEditorForPage = (pageIndex: number) => {
    const localModule = LOCAL_IMAGE_LIST[pageIndex] ?? null;
    navigation.navigate('FormImageEditor', {
      imageUri: null,
      localImageModule: localModule,
      formName: formName ?? `form-${pageIndex + 1}`,
      singleImageMode: true,
      storageKey: perFormStorageKey,
      uiStorageKey: undefined,
      pageIndex,
    });
  };

  // Open the multi-page editor (full editor)
  const openFullEditor = () => {
    navigation.navigate('FormImageEditor', {
      singleImageMode: false,
      storageKey: perFormStorageKey,
      uiStorageKey: undefined,
      formName,
    });
  };

  // Thumbnail / Card for vertical list — renders saved strokes overlay if present
  const ThumbCard = ({ idx, source }: { idx: number; source: any }) => {
    const saved = savedFlags[idx];
    const strokes = savedStrokes[idx];
    const THUMB_W = W - 24;
    const THUMB_H = H * 0.58;
    const scaleX = THUMB_W / EDITOR_PAGE_WIDTH;
    const scaleY = THUMB_H / EDITOR_PAGE_HEIGHT;

    return (
      <TouchableOpacity activeOpacity={0.95} onPress={() => openEditorForPage(idx)} style={styles.card}>
        <Image source={source} style={styles.cardImage} resizeMode="contain" />
        {strokes && strokes.length > 0 ? (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }]}>
            { (() => {
              try {
                const Svg = require('react-native-svg').Svg;
                const Path = require('react-native-svg').Path;
                return (
                  <Svg width={THUMB_W} height={THUMB_H} viewBox={`0 0 ${THUMB_W} ${THUMB_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
                    {strokes.map(s => {
                      const scaledPts = (s.points || []).map((p: Point) => ({ x: (p.x || 0) * scaleX, y: (p.y || 0) * scaleY }));
                      const d = catmullRom2bezier(scaledPts);
                      if (!d) return null;
                      const strokeW = (s.width || 4) * ((scaleX + scaleY) / 2);
                      return <Path key={s.id} d={d} stroke={s.color || '#000'} strokeWidth={Math.max(1, strokeW)} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
                    })}
                  </Svg>
                );
              } catch (e) {
                return null;
              }
            })() }
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.cardTitle}>Page {idx + 1}</Text>
          {/* {saved ? (
            <View style={styles.savedBadge}>
              <Text style={styles.savedBadgeText}>Saved</Text>
            </View>
          ) : null} */}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{(formName as string) || 'Form Images'}</Text>
        {/* <TouchableOpacity style={styles.refreshBtnSmall} onPress={checkSavedStrokes}>
          <Text style={styles.refreshBtnText}>{checkingSaved ? '...' : 'Refresh'}</Text>
        </TouchableOpacity> */}
      </View>

      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={true}>
        {LOCAL_IMAGE_LIST.map((srcItem, i) => (
          <ThumbCard key={`card-${i}`} idx={i} source={srcItem} />
        ))}
        <View style={{ height: 92 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.openEditorBtn} onPress={openFullEditor}>
          <Text style={styles.openEditorBtnText}>Open Editor</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#0EA5A4', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  refreshBtnSmall: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8 },
  refreshBtnText: { color: '#fff', fontWeight: '700' },

  listContainer: { padding: 12, alignItems: 'center' },

  card: { width: W - 24, backgroundColor: '#fff', borderRadius: 10, marginBottom: 14, overflow: 'hidden', elevation: 3, borderWidth: 1, borderColor: '#eee' },
  cardImage: { width: '100%', height: H * 0.58, backgroundColor: '#f9fbfd' },
  cardFooter: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontWeight: '700', fontSize: 14, color: '#333' },

  savedBadge: { backgroundColor: '#0EA5A4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  savedBadgeText: { color: '#fff', fontWeight: '700' },

  centered: { position: 'absolute', left: 0, right: 0, top: '45%', alignItems: 'center' },

  footer: { position: 'absolute', left: 12, right: 12, bottom: 16, alignItems: 'center' },
  openEditorBtn: { backgroundColor: '#0EA5A4', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, elevation: 6, width: W - 48, alignItems: 'center' },
  openEditorBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
