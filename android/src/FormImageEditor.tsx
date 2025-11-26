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
  TextInput,
  Alert,
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

type TextItem = { id: string; text: string; fontSize: number; x: number; y: number; pageIndex: number };
// NOTE: stroke/path shape is implementation-specific to your SketchCanvas. We store it as `any`.
type PathObject = any;

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
  // *** savedStrokesMeta stores the full path objects (not just metadata) ***
  const [savedStrokesMeta, setSavedStrokesMeta] = useState<Array<PathObject[]>>(() => IMAGES.map(() => []));

  // --- NEW: texts per page ---
  const [textsByPage, setTextsByPage] = useState<Array<TextItem[]>>(() => IMAGES.map(() => []));
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const [currentTextPage, setCurrentTextPage] = useState(0);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

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

  // --- core: persist full path objects on stroke end ---
  const handleStrokeEnd = async (pageIndex: number) => {
    const c = canvasRefs.current[pageIndex];
    if (!c) return;
    try {
      const paths = typeof c.getPaths === 'function' ? c.getPaths() : [];
      // store the entire path objects (not just metadata) so we can re-add them later
      const copyPaths = Array.isArray(paths) ? paths.map((p: any) => p) : [];
      setSavedStrokesMeta(prev => {
        const copy = prev.map(a => a.slice());
        copy[pageIndex] = copyPaths;
        if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(copy)).catch(() => {});
        return copy;
      });
      // clear external redo stack on new stroke
      undoneStacksRef.current[pageIndex] = [];
    } catch (e) {
      // fallback: do nothing
      console.warn('handleStrokeEnd: failed to read paths', e);
    }
  };

  // --- UPDATED undo / redo / clear implementations (prefer canvas.undo()/canvas.redo()) ---
  const undoHandler = (pageIndex: number) => {
    const c = canvasRefs.current[pageIndex];
    if (!c) return;

    if (typeof c.undo === 'function') {
      try {
        c.undo();
      } catch (e) {
        console.log('canvas.undo() threw, falling back:', e);
      }
      // refresh savedPaths state
      try {
        const p = typeof c.getPaths === 'function' ? c.getPaths() : [];
        const copyPaths = Array.isArray(p) ? p.map((x: any) => x) : [];
        setSavedStrokesMeta(prev => { const copy = prev.map(a => a.slice()); copy[pageIndex] = copyPaths; if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(copy)).catch(()=>{}); return copy; });
      } catch (e) { /* ignore */ }
      return;
    }

    // FALLBACK manual
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

      const copyPaths = (paths || []).map((x: any) => x);
      setSavedStrokesMeta(prev => { const copy = prev.map(a => a.slice()); copy[pageIndex] = copyPaths; if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(copy)).catch(()=>{}); return copy; });
      return;
    }
  };

  const redoHandler = (pageIndex: number) => {
    const c = canvasRefs.current[pageIndex];
    if (!c) return;

    if (typeof c.redo === 'function') {
      try {
        c.redo();
      } catch (e) {
        console.log('canvas.redo() threw, falling back:', e);
      }
      // refresh state
      try {
        const p = typeof c.getPaths === 'function' ? c.getPaths() : [];
        const copyPaths = Array.isArray(p) ? p.map((x: any) => x) : [];
        setSavedStrokesMeta(prev => { const copy = prev.map(a => a.slice()); copy[pageIndex] = copyPaths; if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(copy)).catch(()=>{}); return copy; });
      } catch (e) {}
      return;
    }

    // FALLBACK: external undone stack
    if (!undoneStacksRef.current[pageIndex]) undoneStacksRef.current[pageIndex] = [];
    const undone = undoneStacksRef.current[pageIndex];
    if (undone.length > 0) {
      const obj = undone.pop();
      if (!obj) return;
      try {
        if (typeof c.addPath === 'function') {
          c.addPath(obj);
          const p = typeof c.getPaths === 'function' ? c.getPaths() : [];
          const copyPaths = Array.isArray(p) ? p.map((x: any) => x) : [];
          setSavedStrokesMeta(prev => { const copy = prev.map(a => a.slice()); copy[pageIndex] = copyPaths; if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(copy)).catch(()=>{}); return copy; });
          return;
        }
      } catch (e) {
        console.log('Redo addPath failed:', e);
      }
    }

    if (typeof c.redo === 'function') {
      c.redo();
      const p = typeof c.getPaths === 'function' ? c.getPaths() : [];
      const copyPaths = Array.isArray(p) ? p.map((x: any) => x) : [];
      setSavedStrokesMeta(prev => { const copy = prev.map(a => a.slice()); copy[pageIndex] = copyPaths; if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(copy)).catch(()=>{}); return copy; });
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

  // ---------- UPDATED onSaveAll: persist full path arrays ----------
  const onSaveAll = async () => {
    // Build the strokes meta by querying each canvas if available
    const allMeta: PathObject[][] = IMAGES.map(() => []);
    for (let i = 0; i < IMAGES.length; i++) {
      const c = canvasRefs.current[i];
      if (!c) {
        allMeta[i] = savedStrokesMeta[i] || [];
        continue;
      }
      try {
        const p = typeof c.getPaths === 'function' ? c.getPaths() : null;
        if (Array.isArray(p)) {
          // store entire path objects for later rehydration
          allMeta[i] = p.map((x: any) => x);
        } else {
          allMeta[i] = savedStrokesMeta[i] || [];
        }
      } catch (e) {
        console.warn('onSaveAll: failed reading canvas paths for page', i, e);
        allMeta[i] = savedStrokesMeta[i] || [];
      }
    }

    // Persist UI and strokes and texts
    const uiPayload = { color, strokeWidth, lastSavedPage: lastSavedPage.current };

    try {
      if (AsyncStorage) {
        await AsyncStorage.setItem(STORAGE_UI_KEY, JSON.stringify(uiPayload));
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allMeta));
        await AsyncStorage.setItem(STORAGE_KEY + ':texts', JSON.stringify(textsByPage));
      } else {
        // Fallback: if AsyncStorage isn't available (dev environment), save in-memory and warn
        console.warn('AsyncStorage not available — using in-memory fallback for this session only.');
      }
      // Update local state too
      setSavedStrokesMeta(allMeta);

      // Notify previous screen with the saved payload so it can update immediately without reloading storage.
      const returnScreen = (route.params && (route.params.returnScreen as string | undefined)) || undefined;
      const payload = { savedStrokes: allMeta, savedTexts: textsByPage, editorUI: uiPayload, editorSavedAt: Date.now() };

      try {
        if (returnScreen && typeof navigation.navigate === 'function') {
          // navigate with merge so the receiving screen can pick it up
          navigation.navigate(returnScreen as never, payload as never);
        } else if (navigation.canGoBack && navigation.canGoBack()) {
          // merge params into parent before going back so parent can read route.params
          navigation.navigate({ name: route.name as never, params: payload as never, merge: true } as never);
        }
      } catch (e) {
        // ignore navigation notify failure — we'll still go back
        console.warn('onSaveAll: navigation notify failed', e);
      }

      // Give the user a quick confirmation then go back
      Alert.alert('Saved', 'Changes saved successfully.', [{ text: 'OK', onPress: () => navigation.goBack() }], { cancelable: false });
    } catch (err) {
      console.error('Failed to save editor state:', err);
      Alert.alert('Save failed', 'Could not save changes. Please try again.');
    }
  };
  // ---------- end onSaveAll ----------

  // visible Modify area actions
  const performUndo = () => { const idx = getCurrentPageIndex(); undoHandler(idx); };
  const performRedo = () => { const idx = getCurrentPageIndex(); redoHandler(idx); };
  const performClear = () => { const idx = getCurrentPageIndex(); clearHandler(idx); };
  // explicit set pen or eraser (separate buttons)
  const activatePen = () => setTool('pen');
  const activateEraser = () => setTool('eraser');

  // ---------------------------
  // IMPORTANT: Scroll padding adjustments to ensure first & last pages are not hidden
  // - Add extra content top padding so first page isn't hidden under top bar.
  // - Add bottom padding large enough so last page can be scrolled fully into view.
  // ---------------------------
  const CONTENT_TOP_PADDING = Math.max(24, (insets.top ?? 0) + PAGE_SPACING + 8); // extra top
  const CONTENT_BOTTOM_PADDING = Math.max(160, (SCREEN_H - PAGE_HEIGHT) + PAGE_SPACING + 24); // ensures last page can reach top

  // function to get current page index must account for top padding
  function getCurrentPageIndex() {
    // offset scroll by top padding and divide by page slot (page height + spacing)
    const effective = Math.max(0, scrollY.current - CONTENT_TOP_PADDING);
    return Math.max(0, Math.min(IMAGES.length - 1, Math.round(effective / (PAGE_HEIGHT + PAGE_SPACING))));
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

  // -----------------------------
  // LEFT quick tab: simple toggle, no drag (so it won't steal gestures)
  // -----------------------------
  const LEFT_TAB_HEIGHT = 86;
  const LEFT_TAB_WIDTH = 48;
  const leftTopAnim = useRef(new Animated.Value(200)).current;
  useEffect(() => {
    const id = leftTopAnim.addListener(({ value }) => { /* keep in sync if needed */ });
    return () => { try { leftTopAnim.removeListener(id); } catch (e) {} };
  }, [leftTopAnim]);

  const onLeftTabPress = () => setColorPanelOpen(v => !v);

  // -----------------------------
  // RIGHT scroll handle: press-and-drag to scroll
  // -----------------------------
  const RIGHT_HANDLE_WIDTH = 36;
  const RIGHT_HANDLE_HEIGHT = 100;
  // <<-- moved the initial top value slightly down so the handle doesn't overlap the top bar / save icon
  const rightTopAnim = useRef(new Animated.Value((SCREEN_H - RIGHT_HANDLE_HEIGHT) / 2 + 60)).current;
  const rightStartTopRef = useRef(0);

  // total scrollable height and helpers (ACCOUNT for content paddings now)
  const totalContentHeight = (PAGE_HEIGHT + PAGE_SPACING) * IMAGES.length + CONTENT_TOP_PADDING + CONTENT_BOTTOM_PADDING;
  const maxScrollY = Math.max(0, totalContentHeight - SCREEN_H);

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

  // -----------------------------
  // TEXT helpers
  // -----------------------------
  const openTextEditor = () => {
    const page = getCurrentPageIndex();
    setCurrentTextPage(page);
    setTextInputValue('');
    setTextEditorOpen(true);
  };

  const addTextToPage = () => {
    const page = currentTextPage;
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 7);
    const defaultFont = 18;
    const newItem: TextItem = { id, text: textInputValue || 'Text', fontSize: defaultFont, x: SCREEN_W / 2 - 50, y: PAGE_HEIGHT / 2 - 12, pageIndex: page };
    setTextsByPage(prev => {
      const copy = prev.map(a => a.slice());
      copy[page] = copy[page] || [];
      copy[page].push(newItem);
      // persist texts
      if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY + ':texts', JSON.stringify(copy)).catch(() => {});
      return copy;
    });
    setTextEditorOpen(false);
    setTextInputValue('');
  };

  const updateTextItem = (pageIndex: number, id: string, patch: Partial<TextItem>) => {
    setTextsByPage(prev => {
      const copy = prev.map(a => a.slice());
      const list = copy[pageIndex] || [];
      const idx = list.findIndex(t => t.id === id);
      if (idx >= 0) {
        copy[pageIndex][idx] = { ...copy[pageIndex][idx], ...patch } as TextItem;
      }
      if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY + ':texts', JSON.stringify(copy)).catch(() => {});
      return copy;
    });
  };

  const removeTextItem = (pageIndex: number, id: string) => {
    setTextsByPage(prev => {
      const copy = prev.map(a => a.slice());
      copy[pageIndex] = (copy[pageIndex] || []).filter(t => t.id !== id);
      if (AsyncStorage) AsyncStorage.setItem(STORAGE_KEY + ':texts', JSON.stringify(copy)).catch(() => {});
      return copy;
    });
    if (selectedTextId === id) setSelectedTextId(null);
  };

  // when mounting try load saved texts
  useEffect(() => {
    (async () => {
      if (!AsyncStorage) return;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY + ':texts');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length === IMAGES.length) setTextsByPage(parsed);
        }
      } catch (e) {}
    })();
  }, []);

  // ---------------------------
  // NEW: normalize + load saved strokes + hydrate canvases
  // ---------------------------

  // helper: normalize a "Stroke" (from FormImageScreen) to a path object compatible with addPath
  const strokeToPathObject = (s: any) => {
    // Best-effort normalization: keep id/color/width/points and add erase flag.
    if (!s) return s;
    // If it already looks like a path (no points but path commands), return as-is
    if (!Array.isArray(s.points) && (s.path || s.commands || s.data)) {
      return s;
    }
    return {
      id: s.id ?? String(Date.now()),
      color: s.color ?? '#000',
      width: s.width ?? 4,
      points: Array.isArray(s.points) ? s.points.map((p: any) => ({ x: p.x ?? 0, y: p.y ?? 0, t: p.t })) : [],
      erase: !!s.erase,
      // keep extra fields if present
      ...(s.path ? { path: s.path } : {}),
      ...(s.data ? { data: s.data } : {}),
    };
  };

  // 1) Load saved strokes when the editor opens (prefer navigation payload, fallback to AsyncStorage)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const navSaved = (route.params && (route.params.savedStrokes as any[] | undefined));
        if (Array.isArray(navSaved) && navSaved.length === IMAGES.length) {
          const normalized = navSaved.map((pageArr: any) => {
            if (!Array.isArray(pageArr)) return [];
            return pageArr.map((s: any) => strokeToPathObject(s));
          });
          if (mounted) setSavedStrokesMeta(normalized);
          return;
        }
      } catch (e) {
        // ignore
      }

      // fallback to AsyncStorage
      if (!AsyncStorage) return;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === IMAGES.length) {
          const normalized = parsed.map((pageArr: any) => {
            if (!Array.isArray(pageArr)) return [];
            return pageArr.map((item: any) => (item && Array.isArray(item.points) ? strokeToPathObject(item) : item));
          });
          if (mounted) setSavedStrokesMeta(normalized);
        }
      } catch (e) {
        console.warn('Failed to load saved strokes from AsyncStorage', e);
      }
    })();

    return () => { mounted = false; };
  }, [route.params]);

  // 2) Hydrate canvas instances whenever savedStrokesMeta changes.
  useEffect(() => {
    const tryHydrate = async () => {
      for (let i = 0; i < IMAGES.length; i++) {
        const c = canvasRefs.current[i];
        const saved = savedStrokesMeta[i] || [];
        if (!c) continue;

        try {
          // If canvas exposes getPaths, check if it's already populated to avoid duplicate replays
          const existing = typeof c.getPaths === 'function' ? (c.getPaths() || []) : [];
          if (existing.length > 0) {
            // canvas already has strokes (don't double-add)
            continue;
          }

          // If we have saved paths for this page, clear canvas and replay them
          if (Array.isArray(saved) && saved.length > 0) {
            if (typeof c.clear === 'function') c.clear();
            // addPath might throw for incompatible formats; wrap in try/catch per path
            for (const p of saved) {
              try {
                if (typeof c.addPath === 'function') {
                  c.addPath(p);
                }
              } catch (err) {
                console.warn(`addPath failed for page ${i}`, err);
              }
            }
          }
        } catch (e) {
          // ignore individual canvas errors
          console.warn('Failed to hydrate canvas', i, e);
        }
      }
    };

    tryHydrate();
  }, [savedStrokesMeta]);

  // PanResponder factory for each text item
  const clampTextPos = (x: number, y: number, fontSize: number) => {
    // Ensure text stays within the image area (pageInner)
    const minX = 0;
    const minY = 0;
    // estimate text width roughly as fontSize * chars * 0.5 (conservative)
    const estWidth = Math.max(40, fontSize * 6); // a conservative minimum width
    const estHeight = Math.max(16, fontSize + 8);
    const maxX = Math.max(0, SCREEN_W - estWidth);
    const maxY = Math.max(0, PAGE_HEIGHT - estHeight);
    const nx = Math.max(minX, Math.min(maxX, x));
    const ny = Math.max(minY, Math.min(maxY, y));
    return { x: nx, y: ny };
  };

  const createTextPanResponder = (pageIndex: number, item: TextItem) => {
    let startX = 0;
    let startY = 0;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, gs) => {
        startX = item.x;
        startY = item.y;
        setSelectedTextId(item.id);
      },
      onPanResponderMove: (evt, gs) => {
        const rawX = startX + gs.dx;
        const rawY = startY + gs.dy;
        const clamped = clampTextPos(rawX, rawY, item.fontSize);
        updateTextItem(pageIndex, item.id, { x: clamped.x, y: clamped.y });
      },
      onPanResponderRelease: () => {},
    });
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Top toolbar - visible controls */}
      <View style={[styles.topBar, { paddingTop: topPadding }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color="#fff"/></TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity onPress={performUndo} style={styles.iconBtn}><Ionicons name="arrow-undo" size={20} color="#fff"/></TouchableOpacity>
        <TouchableOpacity onPress={performRedo} style={styles.iconBtn}><Ionicons name="arrow-redo" size={20} color="#fff"/></TouchableOpacity>

        {/* ADD TEXT ICON (just behind undo/redo)
        <TouchableOpacity onPress={openTextEditor} style={[styles.iconBtn, { marginLeft: 6 }]}>
          <MaterialCommunityIcons name="text" size={20} color="#fff" />
        </TouchableOpacity> */}

        <TouchableOpacity onPress={performClear} style={styles.iconBtn}><MaterialCommunityIcons name="broom" size={20} color="#fff" /></TouchableOpacity>

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
        contentContainerStyle={{ alignItems: 'center', paddingTop: CONTENT_TOP_PADDING, paddingBottom: CONTENT_BOTTOM_PADDING }}
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

              {/* Render texts for this page */}
              { (textsByPage[pageIndex] || []).map((t) => {
                const pan = createTextPanResponder(pageIndex, t);
                const isSelected = selectedTextId === t.id;
                return (
                  <Animated.View
                    key={t.id}
                    {...pan.panHandlers}
                    style={[
                      styles.textOverlay,
                      { left: t.x, top: t.y, position: 'absolute' },
                      isSelected ? styles.textSelected : undefined,
                    ]}
                  >
                    <TouchableOpacity activeOpacity={0.9} onPress={() => setSelectedTextId(t.id)}>
                      <Text numberOfLines={0} style={{ fontSize: t.fontSize }}>{t.text}</Text>
                    </TouchableOpacity>

                    {/* When selected show size +/- and delete controls near the text */}
                    {isSelected && (
                      <View style={styles.textControls} pointerEvents="box-none">
                        <TouchableOpacity onPress={() => updateTextItem(pageIndex, t.id, { fontSize: Math.max(8, t.fontSize - 2) })} style={styles.smallControl}><Text style={styles.smallControlText}>-</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => updateTextItem(pageIndex, t.id, { fontSize: t.fontSize + 2 })} style={styles.smallControl}><Text style={styles.smallControlText}>+</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => removeTextItem(pageIndex, t.id)} style={[styles.smallControl, { marginLeft: 6 }]}><MaterialCommunityIcons name="delete" size={14} color="#fff" /></TouchableOpacity>
                      </View>
                    )}

                  </Animated.View>
                );
              })}

            </View>

            <View style={styles.pageLabelCompact}>
              {/* <Text style={{ color: '#333' }}>{`Page ${pageIndex + 1}`}</Text> */}
              {/* <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => undoHandler(pageIndex)} style={styles.smallBtn}><Ionicons name="arrow-undo-outline" size={18} color="#333" /></TouchableOpacity>
                <TouchableOpacity onPress={() => redoHandler(pageIndex)} style={styles.smallBtn}><Ionicons name="arrow-redo-outline" size={18} color="#333" /></TouchableOpacity>
                <TouchableOpacity onPress={() => clearHandler(pageIndex)} style={styles.smallBtn}><MaterialCommunityIcons name="broom" size={18} color="#333" /></TouchableOpacity>
              </View> */}
            </View>
          </View>
        ))}
      </ScrollView>

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
          {/* <Text style={{ fontSize: 11, color: '#fff', marginTop: 8 }}>Drag</Text> */}
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

      {/* Text editor overlay */}
      {textEditorOpen && (
        <View style={styles.textEditorOverlay}>
          <View style={styles.textEditorBox}>
            <Text style={{ fontWeight: '600', marginBottom: 8 }}>Add Text</Text>
            <TextInput value={textInputValue} onChangeText={setTextInputValue} placeholder="Type text" style={styles.textInput} autoFocus />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity onPress={() => setTextEditorOpen(false)} style={[styles.btn, { marginRight: 8 }]}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={addTextToPage} style={styles.btn}><Text>Add</Text></TouchableOpacity>
            </View>
          </View>
        </View>
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
    width: 26,
    height: 100,
    backgroundColor: 'transparent',
    zIndex: 60,
    paddingTop:40
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

  // text overlay styles
  textOverlay: {
    padding: 4,
  },
  textSelected: {
    // subtle indicator when selected (no border/background per request) - using slight shadow
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  textControls: { position: 'absolute', right: -48, top: -6, flexDirection: 'row', alignItems: 'center' },
  smallControl: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  smallControlText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  textEditorOverlay: { position: 'absolute', left: 12, right: 12, top: 120, backgroundColor: 'rgba(0,0,0,0.25)', padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  textEditorBox: { width: '100%', backgroundColor: '#fff', padding: 12, borderRadius: 10 },
  textInput: { borderWidth: 1, borderColor: '#eee', padding: 8, borderRadius: 8 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#eee', borderRadius: 8 },
});
