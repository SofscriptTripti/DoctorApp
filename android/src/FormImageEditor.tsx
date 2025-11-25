// FormImageEditor.pages.tsx
// Multi-page vertical editor — persistent strokes (saved to AsyncStorage when available).
// Ready-to-draw on open (no need to reselect pen/color/width). Default color = blue.

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Animated,
  Easing,
  PanResponder,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// AsyncStorage fallback
let AsyncStorage: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAGE_HEIGHT = Math.round(SCREEN_H * 0.72);
const STORAGE_KEY = 'DoctorApp:strokesByPage:v1';
const STORAGE_UI_KEY = 'DoctorApp:editorUI:v1';

// Replace with your actual local requires
const IMAGES = [
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

type Point = { x: number; y: number; t?: number };
type Stroke = { id: string; color: string; width: number; points: Point[] };

export default function FormImageEditorPages() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // DEFAULTS: set color to blue so editor is ready on open
  const [color, setColor] = useState('#0EA5A4'); // <- default blue
  const [strokeWidth, setStrokeWidth] = useState(8);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [colorPanelOpen, setColorPanelOpen] = useState(false);

  // Refs to keep latest UI values accessible inside static pan handlers
  const colorRef = useRef(color);
  const widthRef = useRef(strokeWidth);
  const toolRef = useRef(tool);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { widthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { toolRef.current = tool; }, [tool]);

  // strokes state (per page)
  const [strokesByPage, setStrokesByPage] = useState<Stroke[][]>(() => IMAGES.map(() => []));
  const undoneByPage = useRef<Stroke[][]>(IMAGES.map(() => []));

  // drawing refs
  const currentStroke = useRef<Stroke | null>(null);
  const isDrawing = useRef(false);
  const lastPointTime = useRef<number>(0);
  const drawingPageIndex = useRef<number | null>(null);
  const panResponder = useRef<any>(null);

  // scroll + restore
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollY = useRef(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const lastSavedPage = useRef(0);
  const scrollSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // animation for color panel
  const panelAnim = useRef(new Animated.Value(0)).current;
  const panelTranslateY = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [220, 0] });

  // persistence debounce
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // smoothing (tuned)
  const MIN_DIST_SQ = 16; // ~4px squared
  const MAX_FORCE_MS = 12;
  const distSq = (a: Point, b: Point) => { const dx = a.x - b.x; const dy = a.y - b.y; return dx * dx + dy * dy; };
  const shouldAddPoint = (last: Point, next: Point) => {
    const now = Date.now();
    const d2 = distSq(last, next);
    if (d2 >= MIN_DIST_SQ) return true;
    if (now - (lastPointTime.current || 0) >= MAX_FORCE_MS) return true;
    return false;
  };

  // catmull->bezier path helper
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

  const PRESET_COLORS = [
    '#E4572E', '#FF8A80', '#FFB6C1', '#FFC79C', '#FFEB7A', '#7EE07A',
    '#3FE0D0', '#00B0FF', '#9CC6FF', '#C39CFF', '#BDBDBD', '#0c0c0cff',
  ];

  const toggleColorPanel = (open?: boolean) => {
    const next = open === undefined ? !colorPanelOpen : open;
    setColorPanelOpen(next);
    Animated.timing(panelAnim, { toValue: next ? 1 : 0, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.cubic) }).start();
  };

  // persistence helpers
  const persistStrokesNow = async (payload?: Stroke[][]) => {
    const toSave = payload ?? strokesByPage;
    if (!AsyncStorage) return;
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)); } catch (e) { /* ignore */ }
  };
  const persistUIStateNow = async (ui?: any) => {
    if (!AsyncStorage) return;
    try { await AsyncStorage.setItem(STORAGE_UI_KEY, JSON.stringify(ui ?? { color, strokeWidth, tool, colorPanelOpen, lastSavedPage: lastSavedPage.current })); } catch (e) { /* ignore */ }
  };

  const schedulePersist = (payload?: Stroke[][]) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    saveTimer.current = setTimeout(() => {
      persistStrokesNow(payload);
      saveTimer.current = null;
    }, 350);
  };

  // load saved strokes + UI
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!AsyncStorage) return;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && mounted) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length === IMAGES.length) setStrokesByPage(parsed);
        }
      } catch (e) { /* ignore */ }

      try {
        const uiRaw = await AsyncStorage.getItem(STORAGE_UI_KEY);
        if (uiRaw && mounted) {
          const ui = JSON.parse(uiRaw);
          if (ui) {
            if (ui.color) { setColor(ui.color); colorRef.current = ui.color; }
            if (typeof ui.strokeWidth === 'number') { setStrokeWidth(ui.strokeWidth); widthRef.current = ui.strokeWidth; }
            if (ui.tool) { setTool(ui.tool); toolRef.current = ui.tool; }
            if (ui.colorPanelOpen) { setColorPanelOpen(Boolean(ui.colorPanelOpen)); panelAnim.setValue(ui.colorPanelOpen ? 1 : 0); }
            if (typeof ui.lastSavedPage === 'number') {
              lastSavedPage.current = ui.lastSavedPage;
              setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTo({ x: 0, y: lastSavedPage.current * PAGE_HEIGHT, animated: false }); }, 60);
            }
          }
        }
      } catch (e) { /* ignore */ }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build panResponder once and use refs to read latest UI state
  useEffect(() => {
    panResponder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: (evt) => {
        setScrollEnabled(false);
        const native = (evt as any).nativeEvent;
        const x = native.locationX;
        const y = native.locationY;
        const pageIndex = Math.max(0, Math.min(IMAGES.length - 1, Math.round(scrollY.current / PAGE_HEIGHT)));
        startStroke(pageIndex, { x, y, t: Date.now() });
      },

      onPanResponderMove: (evt) => {
        const native = (evt as any).nativeEvent;
        const x = native.locationX;
        const y = native.locationY;
        const pageIndex = drawingPageIndex.current ?? Math.max(0, Math.min(IMAGES.length - 1, Math.round(scrollY.current / PAGE_HEIGHT)));
        moveStroke(pageIndex, { x, y, t: Date.now() });
      },

      onPanResponderRelease: () => {
        const pageIndex = drawingPageIndex.current ?? Math.max(0, Math.min(IMAGES.length - 1, Math.round(scrollY.current / PAGE_HEIGHT)));
        endStroke(pageIndex);
        setScrollEnabled(true);
      },

      onPanResponderTerminate: () => {
        const pageIndex = drawingPageIndex.current ?? Math.max(0, Math.min(IMAGES.length - 1, Math.round(scrollY.current / PAGE_HEIGHT)));
        endStroke(pageIndex);
        setScrollEnabled(true);
      },

      onPanResponderTerminationRequest: () => false,
    });
    // create once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // stroke helpers (use refs when reading UI)
  const startStroke = (pageIndex: number, pt: Point) => {
    isDrawing.current = true;
    drawingPageIndex.current = pageIndex;

    if (toolRef.current === 'pen') {
      const s: Stroke = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, color: colorRef.current, width: widthRef.current, points: [pt] };
      currentStroke.current = s;
      lastPointTime.current = pt.t || Date.now();

      setStrokesByPage(prev => {
        const copy = prev.map(arr => arr.slice());
        copy[pageIndex] = (copy[pageIndex] || []).concat(s);
        return copy;
      });

      undoneByPage.current[pageIndex] = [];
    } else {
      const pad = Math.max(8, Math.round(widthRef.current));
      setStrokesByPage(prev => {
        const copy = prev.map(arr => arr.slice());
        copy[pageIndex] = (copy[pageIndex] || []).filter(st => {
          if (!st.points || st.points.length === 0) return true;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of st.points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
          const inside = pt.x >= minX - pad && pt.x <= maxX + pad && pt.y >= minY - pad && pt.y <= maxY + pad;
          return !inside;
        });
        schedulePersist(copy);
        return copy;
      });
    }
  };

  const moveStroke = (pageIndex: number, pt: Point) => {
    if (!isDrawing.current) return;
    if (toolRef.current === 'pen') {
      const cs = currentStroke.current;
      if (!cs) return;
      const last = cs.points[cs.points.length - 1];
      if (!last || !shouldAddPoint(last, pt)) return;
      cs.points.push(pt);
      lastPointTime.current = pt.t || Date.now();

      setStrokesByPage(prev => {
        const copy = prev.map(arr => arr.slice());
        const arr = copy[pageIndex] || [];
        if (!arr || arr.length === 0) arr.push({ ...cs });
        else {
          const idx = arr.findIndex(s => s.id === cs.id);
          if (idx >= 0) arr[idx] = { ...cs };
          else arr.push({ ...cs });
        }
        copy[pageIndex] = arr;
        return copy;
      });
    } else {
      const pad = Math.max(8, Math.round(widthRef.current));
      setStrokesByPage(prev => {
        const copy = prev.map(arr => arr.slice());
        copy[pageIndex] = (copy[pageIndex] || []).filter(st => {
          if (!st.points || st.points.length === 0) return true;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of st.points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
          const inside = pt.x >= minX - pad && pt.x <= maxX + pad && pt.y >= minY - pad && pt.y <= maxY + pad;
          return !inside;
        });
        schedulePersist(copy);
        return copy;
      });
    }
  };

  const endStroke = (pageIndex: number) => {
    if (!isDrawing.current) {
      drawingPageIndex.current = null;
      return;
    }
    if (toolRef.current === 'pen' && currentStroke.current) {
      persistStrokesNow();
    }
    currentStroke.current = null;
    isDrawing.current = false;
    drawingPageIndex.current = null;
    persistUIStateNow({ color, strokeWidth, tool, colorPanelOpen, lastSavedPage: lastSavedPage.current });
  };

  // undo/redo/clear
  const undo = (pageIndex: number) => {
    setStrokesByPage(prev => {
      const copy = prev.map(arr => arr.slice());
      const arr = copy[pageIndex] || [];
      if (!arr || arr.length === 0) return prev;
      const popped = arr.pop()!;
      undoneByPage.current[pageIndex] = undoneByPage.current[pageIndex] ?? [];
      undoneByPage.current[pageIndex].push(popped);
      copy[pageIndex] = arr;
      schedulePersist(copy);
      return copy;
    });
  };
  const redo = (pageIndex: number) => {
    const stack = undoneByPage.current[pageIndex] ?? [];
    if (!stack || stack.length === 0) return;
    const redoStroke = stack.pop()!;
    setStrokesByPage(prev => {
      const copy = prev.map(arr => arr.slice());
      copy[pageIndex] = (copy[pageIndex] || []).concat(redoStroke);
      schedulePersist(copy);
      return copy;
    });
  };
  const clearPage = (pageIndex: number) => {
    setStrokesByPage(prev => {
      const copy = prev.map(arr => arr.slice());
      const arr = copy[pageIndex] || [];
      if (!arr || arr.length === 0) return prev;
      undoneByPage.current[pageIndex] = (undoneByPage.current[pageIndex] ?? []).concat(arr.slice());
      copy[pageIndex] = [];
      schedulePersist(copy);
      return copy;
    });
  };

  const onSaveAll = async () => {
    if (isDrawing.current && drawingPageIndex.current !== null) {
      endStroke(drawingPageIndex.current);
    }
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    await persistStrokesNow();
    await persistUIStateNow({ color, strokeWidth, tool, colorPanelOpen, lastSavedPage: lastSavedPage.current });
    Alert.alert('Saved', 'All pages saved.', [{ text: 'OK', onPress: () => navigation.goBack() }], { cancelable: false });
  };

  const renderPaths = (pageIndex: number) => {
    const arr = strokesByPage[pageIndex] ?? [];
    return arr.map(s => {
      const d = catmullRom2bezier(s.points);
      if (!d) return null;
      return <Path key={s.id} d={d} stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
    });
  };

  const getCurrentPageIndex = () => Math.max(0, Math.min(IMAGES.length - 1, Math.round(scrollY.current / PAGE_HEIGHT)));

  // nib preview
  const NibPreview = ({ size = 36 }: { size?: number }) => (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: Math.max(6, Math.round((strokeWidth / 60) * size)), height: Math.max(6, Math.round((strokeWidth / 60) * size)), borderRadius: 100, backgroundColor: '#fff', opacity: 0.95 }} />
      </View>
    </View>
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      const idx = getCurrentPageIndex();
      lastSavedPage.current = idx;
      persistUIStateNow({ color, strokeWidth, tool, colorPanelOpen, lastSavedPage: idx });
    }, 300);
  };

  const topPadding = Math.max(8, insets.top + 6);

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity onPress={() => setTool('pen')} style={[styles.iconBtn, tool === 'pen' ? styles.iconActive : undefined]}>
          <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setTool('eraser')} style={[styles.iconBtn, tool === 'eraser' ? styles.iconActive : undefined]}>
          <MaterialCommunityIcons name="eraser" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => undo(getCurrentPageIndex())} style={styles.iconBtn}><Ionicons name="arrow-undo-outline" size={20} color="#fff" /></TouchableOpacity>

        <TouchableOpacity onPress={() => redo(getCurrentPageIndex())} style={styles.iconBtn}><Ionicons name="arrow-redo-outline" size={20} color="#fff" /></TouchableOpacity>

        <TouchableOpacity onPress={() => clearPage(getCurrentPageIndex())} style={styles.iconBtn}><MaterialCommunityIcons name="broom" size={20} color="#fff" /></TouchableOpacity>

        <TouchableOpacity onPress={onSaveAll} style={[styles.iconBtn, { marginLeft: 8 }]}>
          <Ionicons name="checkmark" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.colorCircle, { backgroundColor: color }]}
          onPress={() => toggleColorPanel(true)}
          activeOpacity={0.9}
        />

        <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
          <Slider minimumValue={1} maximumValue={60} value={strokeWidth} onValueChange={v => setStrokeWidth(Math.round(v))} />
        </View>

        <View style={{ width: 72, alignItems: 'center' }}>
          <NibPreview size={44} />
          <Text style={{ fontSize: 12 }}>{strokeWidth}px</Text>
        </View>
      </View>

      <ScrollView
        ref={r => (scrollRef.current = r)}
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: 240 }}
        scrollEnabled={scrollEnabled}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {IMAGES.map((src, pageIndex) => (
          <View key={`page-${pageIndex}`} style={styles.pageWrap}>
            <View
              style={styles.pageInner}
              {...(panResponder.current ? panResponder.current.panHandlers : {})}
            >
              <Image source={src} style={styles.pageImage} resizeMode="contain" />
              <Svg style={styles.svgOverlay} width={SCREEN_W} height={PAGE_HEIGHT}>
                {renderPaths(pageIndex)}
              </Svg>
            </View>

            <View style={styles.pageLabel}>
              <Text style={{ color: '#333' }}>{`Page ${pageIndex + 1}`}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => undo(pageIndex)} style={styles.smallBtn}><Ionicons name="arrow-undo-outline" size={18} color="#333" /></TouchableOpacity>
                <TouchableOpacity onPress={() => redo(pageIndex)} style={styles.smallBtn}><Ionicons name="arrow-redo-outline" size={18} color="#333" /></TouchableOpacity>
                <TouchableOpacity onPress={() => clearPage(pageIndex)} style={styles.smallBtn}><MaterialCommunityIcons name="broom" size={18} color="#333" /></TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Animated.View pointerEvents="box-none" style={[styles.colorPanel, { transform: [{ translateY: panelTranslateY }] }]}>
        <View style={styles.panelHandleRow}>
          <View style={styles.panelHandle} />
          <TouchableOpacity onPress={() => toggleColorPanel(false)} style={styles.panelCloseBtn}>
            <Text style={{ color: '#777' }}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal contentContainerStyle={styles.swatchRow} showsHorizontalScrollIndicator={false}>
          {PRESET_COLORS.map(c => {
            const selected = c.toUpperCase() === color.toUpperCase();
            return (
              <TouchableOpacity key={c} onPress={() => setColor(c)} style={[styles.swatchWrap, selected ? { borderColor: '#0EA5A4', borderWidth: 2 } : null]} activeOpacity={0.85}>
                <View style={[styles.swatch, { backgroundColor: c }]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.panelBottomRow}>
          <Slider style={{ flex: 1 }} minimumValue={1} maximumValue={60} value={strokeWidth} onValueChange={v => setStrokeWidth(Math.round(v))} />
          <Text style={{ width: 36, textAlign: 'center' }}>{strokeWidth}</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, backgroundColor: '#0EA5A4' },
  iconBtn: { padding: 8, borderRadius: 24, marginHorizontal: 6 },
  iconActive: { backgroundColor: 'rgba(255,255,255,0.12)' },

  controls: { flexDirection: 'row', alignItems: 'center', padding: 8, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  colorCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#ddd' },

  pageWrap: { width: SCREEN_W, alignItems: 'center', marginVertical: 10 },
  pageInner: { width: SCREEN_W, height: PAGE_HEIGHT, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pageImage: { width: SCREEN_W, height: PAGE_HEIGHT },
  svgOverlay: { position: 'absolute', left: 0, top: 0 },

  pageLabel: { width: SCREEN_W - 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  smallBtn: { padding: 6, marginLeft: 8 },

  colorPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  panelHandleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelHandle: { width: 60, height: 6, borderRadius: 4, backgroundColor: '#eee', alignSelf: 'center', marginBottom: 8 },
  panelCloseBtn: { paddingHorizontal: 8, paddingVertical: 4 },

  swatchRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  swatchWrap: { padding: 6, borderRadius: 22, marginRight: 8, borderWidth: 0.8, borderColor: '#ddd' },
  swatch: { width: 36, height: 36, borderRadius: 18 },

  panelBottomRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
});
