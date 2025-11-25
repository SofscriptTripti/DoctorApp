// src/FormImageEditor.pages.tsx
// Redesigned editor: visible toolbar with Undo / Redo / Clear / Pen / Eraser separate buttons / Thickness slider / Color palette.
// Added: RIGHT-EDGE draggable scroll handle (holds + drag to scroll). Left quick-tab no longer steals gestures.
// IMPORTANT: Undo/Redo handlers now prefer canvas.undo()/canvas.redo() to preserve internal history (fixes redo).

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Pressable,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import SketchCanvas, { SketchCanvasHandle } from './components/SketchCanvas';

const ATTACHED_MOCK = '/mnt/data/WhatsApp Image 2025-11-25 at 8.49.40 PM.jpeg';

let AsyncStorage: any = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch (e) { AsyncStorage = null; }

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAGE_HEIGHT = Math.round(SCREEN_H * 0.72);
const PAGE_SPACING = 18;
const DEFAULT_STORAGE_KEY = 'DoctorApp:strokesByPage:v1';
const DEFAULT_UI_KEY = 'DoctorApp:editorUI:v1';

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

type SavedStroke = { id: string; color: string; width: number; erase?: boolean };

export default function FormImageEditor() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const storageKeyParam = route.params?.storageKey as string | undefined;
  const uiKeyParam = route.params?.uiStorageKey as string | undefined;
  const STORAGE_KEY = storageKeyParam ?? DEFAULT_STORAGE_KEY;
  const STORAGE_UI_KEY = uiKeyParam ?? DEFAULT_UI_KEY;

  // --- editor state (clean and visible controls) ---
  const [color, setColor] = useState('#0EA5A4');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen'); // explicit pen or eraser
  const [colorPanelOpen, setColorPanelOpen] = useState(false);

  const colorRef = useRef(color);
  const widthRef = useRef(strokeWidth);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { widthRef.current = strokeWidth; }, [strokeWidth]);

  // canvas refs and stacks
  const canvasRefs = useRef<Array<SketchCanvasHandle | null>>(IMAGES.map(() => null));
  // Keep undoneStacksRef for backward compatibility but we will prefer canvas' own history
  const undoneStacksRef = useRef<Array<any[]>>(IMAGES.map(() => []));
  const [savedStrokesMeta, setSavedStrokesMeta] = useState<Array<SavedStroke[]>>(() => IMAGES.map(() => []));

  // scroll state
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollY = useRef(0);
  const lastSavedPage = useRef(0);

  // simple UI helpers
  const topPadding = Math.max(8, insets.top + 6);
  const HEADER_HEIGHT = topPadding + 52;

  // --- smoothing: tap-vs-drag threshold ---
  const STROKE_START_THRESHOLD = 6; // pixels (small - adjust to taste)
  const strokeStartInfo = useRef<{x: number; y: number; accepted: boolean}>({ x: 0, y: 0, accepted: true });

  const onCanvasStrokeStart = (pageIndex: number, evt: any) => {
    strokeStartInfo.current = { x: evt?.x ?? 0, y: evt?.y ?? 0, accepted: false };
  };
  const onCanvasStrokeMove = (pageIndex: number, evt: any) => {
    const s = strokeStartInfo.current;
    if (!s) return;
    const dx = (evt?.x ?? 0) - s.x;
    const dy = (evt?.y ?? 0) - s.y;
    const distSq = dx * dx + dy * dy;
    if (!s.accepted && distSq >= STROKE_START_THRESHOLD * STROKE_START_THRESHOLD) {
      s.accepted = true;
    }
  };
  const onCanvasStrokeEnd = (pageIndex: number, evt: any) => {
    const s = strokeStartInfo.current;
    const c = canvasRefs.current[pageIndex];
    try {
      // best-effort: if the sketch component recorded a tiny tap stroke, drop it
      if (c && !s.accepted && typeof c.getPaths === 'function' && typeof c.clear === 'function' && typeof c.addPath === 'function') {
        const paths = c.getPaths() || [];
        if (paths.length > 0) {
          const last = paths[paths.length - 1];
          if (last && last.bounds && (last.bounds.width < STROKE_START_THRESHOLD && last.bounds.height < STROKE_START_THRESHOLD)) {
            paths.pop();
            c.clear();
            for (const p of paths) c.addPath(p);
          }
        }
      }
    } catch (e) {
      // ignore — best-effort
    }

    // update meta as usual
    handleStrokeEnd(pageIndex);
  };

  // --- core: persist metadata on stroke end ---
  const handleStrokeEnd = async (pageIndex: number) => {
    const c = canvasRefs.current[pageIndex];
    if (!c) return;
    const paths = typeof c.getPaths === 'function' ? c.getPaths() : [];
    const meta = (paths || []).map((x: any) => ({ id: x.id ?? String(Date.now()), color: x.erase ? (x.color ?? '#000') : (x.color ?? colorRef.current), width: x.width ?? widthRef.current, erase: !!x.erase }));
    setSavedStrokesMeta(prev => {
      const copy = prev.map(a => a.slice());
      copy[pageIndex] = meta;
      if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(copy)).catch(() => {});
      return copy;
    });
    // If user draws new stroke, external redo stack should be cleared (we keep this for compatibility)
    undoneStacksRef.current[pageIndex] = [];
  };

  // --- UPDATED undo / redo / clear implementations (prefer canvas.undo()/canvas.redo()) ---
  const undoHandler = (pageIndex: number) => {
    const c = canvasRefs.current[pageIndex];
    if (!c) return;

    // PREFER canvas.undo() to preserve canvas internal history & enable redo
    if (typeof c.undo === 'function') {
      try {
        c.undo();
      } catch (e) {
        // fallback to manual below if undo fails
        console.log('canvas.undo() threw, falling back:', e);
      }
      // refresh meta
      try {
        const p = typeof c.getPaths === 'function' ? c.getPaths() : [];
        const meta = (p || []).map((x: any) => ({ id: x.id ?? String(Date.now()), color: x.erase ? (x.color ?? '#000') : (x.color ?? colorRef.current), width: x.width ?? widthRef.current, erase: !!x.erase }));
        setSavedStrokesMeta(prev => { const copy = prev.map(a => a.slice()); copy[pageIndex] = meta; if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(copy)).catch(()=>{}); return copy; });
      } catch (e) { /* ignore */ }
      return;
    }

    // FALLBACK: If canvas.undo isn't available, operate on path list manually (legacy code)
    if (typeof c.getPaths === 'function' && typeof c.clear === 'function' && typeof c.addPath === 'function') {
      const paths = c.getPaths() || [];
      if (paths.length === 0) return;
      const last = paths.pop();
      if (!last) return;
      undoneStacksRef.current[pageIndex] = undoneStacksRef.current[pageIndex] || [];
      undoneStacksRef.current[pageIndex].push(last);
      try {
        c.clear();
        for (const p of paths) c.addPath(p);
      } catch (e) {
        if (typeof c.undo === 'function') c.undo();
      }

      const meta = (paths || []).map((x: any) => ({ id: x.id ?? String(Date.now()), color: x.erase ? (x.color ?? '#000') : (x.color ?? colorRef.current), width: x.width ?? widthRef.current, erase: !!x.erase }));
      setSavedStrokesMeta(prev => { const copy = prev.map(a => a.slice()); copy[pageIndex] = meta; if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(copy)).catch(()=>{}); return copy; });
      return;
    }
  };

  const redoHandler = (pageIndex: number) => {
    const c = canvasRefs.current[pageIndex];
    if (!c) return;

    // PREFER canvas.redo() — this replays whatever the canvas stored in redoRef and will work if undo was used.
    if (typeof c.redo === 'function') {
      try {
        c.redo();
      } catch (e) {
        console.log('canvas.redo() threw, falling back:', e);
      }
      // refresh meta
      try {
        const p = typeof c.getPaths === 'function' ? c.getPaths() : [];
        const meta = (p || []).map((x: any) => ({ id: x.id ?? String(Date.now()), color: x.erase ? (x.color ?? '#000') : (x.color ?? colorRef.current), width: x.width ?? widthRef.current, erase: !!x.erase }));
        setSavedStrokesMeta(prev => { const copy = prev.map(a => a.slice()); copy[pageIndex] = meta; if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(copy)).catch(()=>{}); return copy; });
      } catch (e) { /* ignore */ }
      return;
    }

    // FALLBACK: If canvas.redo not available, try external undone stack (legacy approach)
    if (!undoneStacksRef.current[pageIndex]) undoneStacksRef.current[pageIndex] = [];
    const undone = undoneStacksRef.current[pageIndex];
    if (undone.length > 0) {
      const obj = undone.pop();
      if (!obj) return;
      try {
        if (typeof c.addPath === 'function') {
          c.addPath(obj);
          const p = typeof c.getPaths === 'function' ? c.getPaths() : [];
          const meta = (p || []).map((x: any) => ({ id: x.id ?? String(Date.now()), color: x.erase ? (x.color ?? '#000') : (x.color ?? colorRef.current), width: x.width ?? widthRef.current, erase: !!x.erase }));
          setSavedStrokesMeta(prev => { const copy = prev.map(a => a.slice()); copy[pageIndex] = meta; if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(copy)).catch(()=>{}); return copy; });
          return;
        }
      } catch (e) {
        console.log('Redo addPath failed:', e);
      }
    }

    // final fallback to canvas.redo() if possible
    if (typeof c.redo === 'function') {
      c.redo();
      const p = typeof c.getPaths === 'function' ? c.getPaths() : [];
      const meta = (p || []).map((x: any) => ({ id: x.id ?? String(Date.now()), color: x.color ?? colorRef.current, width: x.width ?? widthRef.current, erase: !!x.erase }));
      setSavedStrokesMeta(prev => { const copy = prev.map(a => a.slice()); copy[pageIndex] = meta; if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(copy)).catch(()=>{}); return copy; });
    }
  };

  const clearHandler = (pageIndex: number) => {
    const c = canvasRefs.current[pageIndex];
    if (!c) return;
    if (typeof c.clear === 'function') {
      c.clear();
      setSavedStrokesMeta(prev=>{const copy=prev.map(a=>a.slice());copy[pageIndex]=[]; if(AsyncStorage) AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(copy)).catch(()=>{}); return copy;});
      if (!undoneStacksRef.current[pageIndex]) undoneStacksRef.current[pageIndex] = [];
      undoneStacksRef.current[pageIndex]=[]; // clear external undone stack too
      return;
    }
    if (typeof c.getPaths === 'function' && typeof c.undo === 'function') {
      let paths = c.getPaths()||[];
      // perform many undo until empty (best-effort)
      while(paths.length>0){
        if (typeof c.undo === 'function') c.undo();
        paths = c.getPaths()||[];
      }
      setSavedStrokesMeta(prev=>{const copy=prev.map(a=>a.slice());copy[pageIndex]=[]; if(AsyncStorage) AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(copy)).catch(()=>{}); return copy;});
      if (!undoneStacksRef.current[pageIndex]) undoneStacksRef.current[pageIndex] = [];
      undoneStacksRef.current[pageIndex]=[];
    }
  };

  const onSaveAll = async () => {
    const allMeta: SavedStroke[][] = IMAGES.map(()=>[]);
    for(let i=0;i<IMAGES.length;i++){
      const c = canvasRefs.current[i];
      if(!c){ allMeta[i]=savedStrokesMeta[i]||[]; continue; }
      try {
        const p = typeof c.getPaths==='function'? c.getPaths(): null;
        if(Array.isArray(p)) {
          allMeta[i]=p.map((x:any)=>({ id: x.id ?? String(Date.now()), color: x.erase ? (x.color ?? '#000') : (x.color ?? colorRef.current), width: x.width ?? widthRef.current, erase: !!x.erase }));
        } else allMeta[i]=savedStrokesMeta[i]||[];
      } catch(e){ allMeta[i]=savedStrokesMeta[i]||[]; }
    }
    if (AsyncStorage) { try { await AsyncStorage.setItem(STORAGE_UI_KEY, JSON.stringify({ color, strokeWidth, lastSavedPage: lastSavedPage.current })); } catch(e){} }
    if (AsyncStorage) { try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allMeta)); } catch(e){} }
    setSavedStrokesMeta(allMeta);
    navigation.goBack();
  };

  // visible Modify area actions
  const performUndo = () => { const idx = getCurrentPageIndex(); undoHandler(idx); };
  const performRedo = () => { const idx = getCurrentPageIndex(); redoHandler(idx); };
  const performClear = () => { const idx = getCurrentPageIndex(); clearHandler(idx); };
  // explicit set pen or eraser (separate buttons)
  const activatePen = () => setTool('pen');
  const activateEraser = () => setTool('eraser');

  function getCurrentPageIndex() {
    return Math.max(0, Math.min(IMAGES.length - 1, Math.round((scrollY.current || 0) / PAGE_HEIGHT)));
  }

  // palette
  const PALETTE = ['#0EA5A4','#E4572E','#FF8A80','#FFB6C1','#FFC79C','#FFEB7A','#7EE07A','#3FE0D0','#00B0FF','#9CC6FF','#C39CFF','#BDBDBD','#000000','#FFFFFF'];

  const NibPreview = ({ size = 36 }: { size?: number }) => (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: Math.max(4, Math.round((strokeWidth / 30) * size)), height: Math.max(4, Math.round((strokeWidth / 30) * size)), borderRadius: 100, backgroundColor: '#fff', opacity: 0.95 }} />
      </View>
    </View>
  );

  //
  // -----------------------------
  // LEFT quick tab: simple toggle, no drag (so it won't steal gestures)
  // -----------------------------
  //
  const LEFT_TAB_HEIGHT = 86;
  const LEFT_TAB_WIDTH = 48;
  const leftTopAnim = useRef(new Animated.Value(200)).current;
  useEffect(() => {
    const id = leftTopAnim.addListener(({ value }) => { /* keep in sync if needed */ });
    return () => { try { leftTopAnim.removeListener(id); } catch (e) {} };
  }, [leftTopAnim]);

  const onLeftTabPress = () => setColorPanelOpen(v => !v);

  //
  // -----------------------------
  // RIGHT scroll handle: press-and-drag to scroll
  // -----------------------------
  //
  const RIGHT_HANDLE_WIDTH = 36;
  const RIGHT_HANDLE_HEIGHT = 120;
  const rightTopAnim = useRef(new Animated.Value((SCREEN_H - RIGHT_HANDLE_HEIGHT) / 2)).current;
  const rightStartTopRef = useRef(0);

  // total scrollable height and helpers
  const totalScrollHeight = (PAGE_HEIGHT + PAGE_SPACING) * IMAGES.length;
  const maxScrollY = Math.max(0, totalScrollHeight - SCREEN_H);

  const clampRightTop = (val: number) => {
    const minTop = (insets.top ?? 0) + 8;
    const maxTop = SCREEN_H - RIGHT_HANDLE_HEIGHT - (insets.bottom ?? 0) - 8;
    return Math.max(minTop, Math.min(maxTop, val));
  };

  const rightTopToScroll = (top: number) => {
    const minTop = (insets.top ?? 0) + 8;
    const maxTop = SCREEN_H - RIGHT_HANDLE_HEIGHT - (insets.bottom ?? 0) - 8;
    const tRange = Math.max(1, maxTop - minTop);
    const sRange = Math.max(1, maxScrollY);
    const normalized = Math.max(minTop, Math.min(maxTop, top));
    const progress = (normalized - minTop) / tRange;
    return progress * sRange;
  };

  const scrollToRightTop = (sY: number) => {
    const minTop = (insets.top ?? 0) + 8;
    const maxTop = SCREEN_H - RIGHT_HANDLE_HEIGHT - (insets.bottom ?? 0) - 8;
    const tRange = Math.max(1, maxTop - minTop);
    const sRange = Math.max(1, maxScrollY);
    const progress = Math.max(0, Math.min(sRange, sY)) / sRange;
    return progress * tRange + minTop;
  };

  useEffect(() => {
    const id = rightTopAnim.addListener(({ value }) => { /* keep if needed */ });
    return () => { try { rightTopAnim.removeListener(id); } catch (e) {} };
  }, [rightTopAnim]);

  const rightPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt: GestureResponderEvent) => {
        const x = evt.nativeEvent.pageX ?? 0;
        return x >= SCREEN_W - RIGHT_HANDLE_WIDTH - 8;
      },
      onMoveShouldSetPanResponder: (evt: GestureResponderEvent) => {
        const x = evt.nativeEvent.pageX ?? 0;
        return x >= SCREEN_W - RIGHT_HANDLE_WIDTH - 8;
      },
      onPanResponderGrant: (evt: GestureResponderEvent, _gs: PanResponderGestureState) => {
        rightStartTopRef.current = rightTopAnim.__getValue ? rightTopAnim.__getValue() : ((SCREEN_H - RIGHT_HANDLE_HEIGHT) / 2);
      },
      onPanResponderMove: (evt: GestureResponderEvent, gs: PanResponderGestureState) => {
        const newTop = clampRightTop(rightStartTopRef.current + gs.dy);
        rightTopAnim.setValue(newTop);
        const newScroll = rightTopToScroll(newTop);
        if (scrollRef.current && typeof scrollRef.current.scrollTo === 'function') {
          try {
            scrollRef.current.scrollTo({ y: newScroll, animated: false });
            scrollY.current = newScroll;
          } catch (e) {}
        }
      },
      onPanResponderRelease: (_evt: GestureResponderEvent, gs: PanResponderGestureState) => {
        const finalTop = clampRightTop(rightStartTopRef.current + gs.dy);
        Animated.spring(rightTopAnim, { toValue: finalTop, useNativeDriver: false, friction: 8, tension: 50 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(rightTopAnim, { toValue: clampRightTop(rightStartTopRef.current), useNativeDriver: false, friction: 8, tension: 50 }).start();
      },
    })
  ).current;

  const syncRightHandleToScroll = (sY: number) => {
    const newTop = scrollToRightTop(sY);
    const curr = rightTopAnim.__getValue ? rightTopAnim.__getValue() : 0;
    if (Math.abs(newTop - curr) > 1.5) {
      rightTopAnim.setValue(newTop);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Top toolbar - visible controls */}
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color="#fff"/></TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity onPress={performUndo} style={styles.iconBtn}><Ionicons name="arrow-undo" size={20} color="#fff"/></TouchableOpacity>
        <TouchableOpacity onPress={performRedo} style={styles.iconBtn}><Ionicons name="arrow-redo" size={20} color="#fff"/></TouchableOpacity>
        <TouchableOpacity onPress={performClear} style={styles.iconBtn}><MaterialCommunityIcons name="broom" size={20} color="#fff"/></TouchableOpacity>

        {/* Separate Pen and Eraser buttons */}
        <TouchableOpacity onPress={activatePen} style={[styles.iconBtn, tool === 'pen' ? styles.iconActive : undefined]}>
          <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={activateEraser} style={[styles.iconBtn, tool === 'eraser' ? styles.iconActive : undefined]}>
          <MaterialCommunityIcons name="eraser" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setColorPanelOpen(v => !v)} style={[styles.iconBtn, { marginLeft: 6 }]}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color, borderWidth: 1, borderColor: '#eee' }} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onSaveAll} style={[styles.iconBtn, { marginLeft: 8 }]}><Ionicons name="checkmark" size={20} color="#fff"/></TouchableOpacity>
      </View>

      {/* Compact controls row: thickness slider + preview */}
      <View style={styles.controlsCompact}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ marginRight: 8 }}>{strokeWidth}px</Text>
          <NibPreview size={28} />
        </View>
        <Slider style={{ flex: 1, height: 36 }} minimumValue={1} maximumValue={30} value={strokeWidth} onValueChange={v => { setStrokeWidth(Math.round(v)); widthRef.current = Math.round(v); }} />
      </View>

      {/* Main scroll area with images + canvas */}
      <ScrollView
        ref={r => (scrollRef.current = r)}
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: 160 }}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
          // sync right handle smoothly
          syncRightHandleToScroll(scrollY.current);
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        decelerationRate="fast"
        overScrollMode="always"
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
      >
        {IMAGES.map((src, pageIndex) => (
          <View key={`page-${pageIndex}`} style={styles.pageWrap}>
            <View style={styles.pageInner}>
              <Image source={src} style={[styles.pageImage, { width: SCREEN_W, height: PAGE_HEIGHT }]} resizeMode="contain" />

              <SketchCanvas
                ref={(r) => (canvasRefs.current[pageIndex] = r)}
                width={SCREEN_W}
                height={PAGE_HEIGHT}
                strokeColor={tool === 'pen' ? color : '#000'}
                strokeWidth={strokeWidth}
                eraseMode={tool === 'eraser'}
                onStrokeStart={(evt:any) => onCanvasStrokeStart(pageIndex, evt)}
                onStrokeMove={(evt:any) => onCanvasStrokeMove(pageIndex, evt)}
                onStrokeEnd={(evt:any) => onCanvasStrokeEnd(pageIndex, evt)}
              />
            </View>

            <View style={styles.pageLabelCompact}>
              <Text style={{ color: '#333' }}>{`Page ${pageIndex + 1}`}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => undoHandler(pageIndex)} style={styles.smallBtn}><Ionicons name="arrow-undo-outline" size={18} color="#333" /></TouchableOpacity>
                <TouchableOpacity onPress={() => redoHandler(pageIndex)} style={styles.smallBtn}><Ionicons name="arrow-redo-outline" size={18} color="#333" /></TouchableOpacity>
                <TouchableOpacity onPress={() => clearHandler(pageIndex)} style={styles.smallBtn}><MaterialCommunityIcons name="broom" size={18} color="#333" /></TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* LEFT quick-tab (no panResponder) */}
      <Animated.View style={[styles.leftQuickTab, { top: leftTopAnim }]} pointerEvents="box-none">
        <Pressable onPress={onLeftTabPress} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: LEFT_TAB_WIDTH, height: LEFT_TAB_HEIGHT }}>
          <View style={styles.leftQuickTriangle} pointerEvents="none" />
          <Text style={styles.leftQuickText}>{'▶▶'}</Text>
        </Pressable>
      </Animated.View>

      {/* RIGHT scroll handle: user presses and drags to scroll */}
      <Animated.View
        style={[
          styles.rightHandle,
          {
            top: rightTopAnim,
            right: 6,
          },
        ]}
        {...rightPanResponder.panHandlers}
        pointerEvents="box-none"
      >
        <View style={styles.rightHandleInner}>
          <View style={styles.rightGrip} />
          <Text style={{ fontSize: 11, color: '#fff', marginTop: 8 }}>Drag</Text>
        </View>
      </Animated.View>

      {/* Color palette panel (grid) */}
      {colorPanelOpen && (
        <Animated.View style={styles.colorPanel}>
          <View style={styles.paletteGrid}>
            {PALETTE.map(c => (
              <TouchableOpacity key={c} onPress={() => { setColor(c); setColorPanelOpen(false); }} style={[styles.gridSwatchWrap, c.toUpperCase() === color.toUpperCase() ? styles.gridSwatchActive : undefined]}>
                <View style={[styles.gridSwatch, { backgroundColor: c }]} />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Small note showing sample mock path */}
      <View style={styles.mockNote} pointerEvents="none"><Text style={{ fontSize: 11, color: '#777' }}>Mock: {ATTACHED_MOCK}</Text></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, backgroundColor: '#0EA5A4' },
  headerTitle: { color: '#fff', fontWeight: '600', marginLeft: 10 },
  iconBtn: { padding: 8, borderRadius: 18, marginLeft: 8 },
  iconActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  controlsCompact: { flexDirection: 'row', alignItems: 'center', padding: 8, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  pageWrap: { width: SCREEN_W, alignItems: 'center', marginVertical: PAGE_SPACING / 2 },
  pageInner: { width: SCREEN_W, height: PAGE_HEIGHT, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pageImage: { width: SCREEN_W, height: PAGE_HEIGHT },
  pageLabelCompact: { width: SCREEN_W - 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  smallBtn: { padding: 6, marginLeft: 8 },

  colorPanel: { position: 'absolute', left: 12, right: 12, bottom: 18, backgroundColor: '#fff', borderRadius: 12, padding: 10, elevation: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  gridSwatchWrap: { width: 44, height: 44, padding: 6, margin: 6, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  gridSwatchActive: { borderColor: '#0EA5A4', borderWidth: 2 },
  gridSwatch: { width: '100%', height: '100%', borderRadius: 8 },

  // left quick tab
  leftQuickTab: {
    position: 'absolute',
    left: 0,
    width: 48,
    height: 86,
    backgroundColor: '#0A97F2',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    zIndex: 50,
  },
  leftQuickTriangle: { position: 'absolute', left: -12, width: 0, height: 0, borderTopWidth: 18, borderTopColor: 'transparent', borderBottomWidth: 18, borderBottomColor: 'transparent', borderRightWidth: 12, borderRightColor: '#0A97F2' },
  leftQuickText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // right scroll handle (small draggable area)
  rightHandle: {
    position: 'absolute',
    width: 36,
    height: 120,
    backgroundColor: 'transparent',
    zIndex: 60,
  },
  rightHandleInner: {
    flex: 1,
    backgroundColor: '#0A97F2',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  rightGrip: { width: 20, height: 6, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.95)' },

  mockNote: { position: 'absolute', left: 12, bottom: 6 },
});
