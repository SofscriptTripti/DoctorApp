// src/FormImageEditor.pages.tsx
// Updated: stable refs for NativeDrawingView, no touch interception by wrappers.

import React, { useRef, useState, useEffect, useMemo, forwardRef } from 'react';
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
  Alert,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import NativeDrawingView, { DrawingRef } from './components/NativeDrawingView';

let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAGE_HEIGHT = Math.round(SCREEN_H * 0.72);
const PAGE_SPACING = 18;
const DEFAULT_STORAGE_KEY = 'DoctorApp:pagesBitmaps:v1';
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

type SavedMeta = { bitmapPath?: string | null };

// --- stable memoized drawing canvas that forwards ref reliably
const DrawingCanvas = React.memo(
  forwardRef(function DrawingCanvasInternal(
    { index }: { index: number },
    forwardedRef: React.Ref<DrawingRef | null>
  ) {
    useEffect(() => {
      console.log(`[DrawingCanvas] mount index=${index}`);
      return () => console.log(`[DrawingCanvas] unmount index=${index}`);
    }, [index]);

    return (
      <NativeDrawingView
        ref={forwardedRef}
        style={styles.canvasOverlay}
      />
    );
  }),
  (prev, next) => prev.index === next.index
);

// ----- main component
export default function FormImageEditor() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const storageKeyParam = route.params?.storageKey as string | undefined;
  const uiKeyParam = route.params?.uiStorageKey as string | undefined;
  const STORAGE_KEY = storageKeyParam ?? DEFAULT_STORAGE_KEY;
  const STORAGE_UI_KEY = uiKeyParam ?? DEFAULT_UI_KEY;

  const [color, setColor] = useState('#0EA5A4');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [colorPanelOpen, setColorPanelOpen] = useState(false);

  const colorRef = useRef(color);
  const widthRef = useRef(strokeWidth);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    widthRef.current = strokeWidth;
  }, [strokeWidth]);

  // stable storage for canvas refs
  const canvasRefs = useRef<Array<DrawingRef | null>>(
    useMemo(() => IMAGES.map(() => null), [])
  );
  const [savedMeta, setSavedMeta] = useState<Array<SavedMeta>>(() =>
    IMAGES.map(() => ({ bitmapPath: null }))
  );

  // stable ref setter array (store refs directly for imperative calls)
  const refSetters = useRef<Array<(r: DrawingRef | null) => void>>(
    useMemo(
      () =>
        IMAGES.map((_, i) => (r: DrawingRef | null) => {
          canvasRefs.current[i] = r;
          console.log(
            `[FormImageEditor] native ref set for page ${i}: ${
              r ? 'attached' : 'null'
            }`
          );
        }),
      []
    )
  );

  const scrollRef = useRef<ScrollView | null>(null);
  const scrollY = useRef(0);
  const topPadding = Math.max(8, insets.top + 6);

  // NO touch scrolling (only via right handle)
  const [scrollEnabled] = useState(false);

  const performUndo = () => {
    const idx = getCurrentPageIndex();
    const c = canvasRefs.current[idx];
    if (c && typeof c.undo === 'function') c.undo();
  };
  const performRedo = () => {
    const idx = getCurrentPageIndex();
    const c = canvasRefs.current[idx];
    if (c && typeof c.redo === 'function') c.redo();
  };
  const performClear = () => {
    const idx = getCurrentPageIndex();
    const c = canvasRefs.current[idx];
    if (c && typeof c.clear === 'function') c.clear();
  };

  const activatePen = () => setTool('pen');
  const activateEraser = () => setTool('eraser');

  const CONTENT_TOP_PADDING = Math.max(
    24,
    (insets.top ?? 0) + PAGE_SPACING + 8
  );
  const CONTENT_BOTTOM_PADDING = Math.max(
    160,
    SCREEN_H - PAGE_HEIGHT + PAGE_SPACING + 24
  );

  function getCurrentPageIndex() {
    const effective = Math.max(0, scrollY.current - CONTENT_TOP_PADDING);
    return Math.max(
      0,
      Math.min(
        IMAGES.length - 1,
        Math.round(effective / (PAGE_HEIGHT + PAGE_SPACING))
      )
    );
  }

  const PALETTE = [
    '#0EA5A4',
    '#E4572E',
    '#FF8A80',
    '#FFB6C1',
    '#FFC79C',
    '#FFEB7A',
    '#7EE07A',
    '#3FE0D0',
    '#00B0FF',
    '#9CC6FF',
    '#C39CFF',
    '#BDBDBD',
    '#000000',
    '#FFFFFF',
  ];

  const NibPreview = ({ size = 36 }: { size?: number }) => (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: Math.max(4, Math.round((strokeWidth / 30) * size)),
            height: Math.max(4, Math.round((strokeWidth / 30) * size)),
            borderRadius: 100,
            backgroundColor: '#fff',
            opacity: 0.95,
          }}
        />
      </View>
    </View>
  );

  // RIGHT handle code unchanged (keeps scrolling via handle)
  const RIGHT_HANDLE_WIDTH = 36;
  const RIGHT_HANDLE_HEIGHT = 100;
  const rightTopAnim = useRef(
    new Animated.Value((SCREEN_H - RIGHT_HANDLE_HEIGHT) / 2 + 60)
  ).current;
  const rightStartTopRef = useRef(0);

  const totalContentHeight =
    (PAGE_HEIGHT + PAGE_SPACING) * IMAGES.length +
    CONTENT_TOP_PADDING +
    CONTENT_BOTTOM_PADDING;
  const maxScrollY = Math.max(0, totalContentHeight - SCREEN_H);

  const clampRightTop = (val: number) => {
    const minTop = (insets.top ?? 0) + 8;
    const maxTop =
      SCREEN_H - RIGHT_HANDLE_HEIGHT - (insets.bottom ?? 0) - 8;
    return Math.max(minTop, Math.min(maxTop, val));
  };

  const rightTopToScroll = (top: number) => {
    const minTop = (insets.top ?? 0) + 8;
    const maxTop =
      SCREEN_H - RIGHT_HANDLE_HEIGHT - (insets.bottom ?? 0) - 8;
    const tRange = Math.max(1, maxTop - minTop);
    const sRange = Math.max(1, maxScrollY);
    const normalized = Math.max(minTop, Math.min(maxTop, top));
    const progress = (normalized - minTop) / tRange;
    return progress * sRange;
  };

  const scrollToRightTop = (sY: number) => {
    const minTop = (insets.top ?? 0) + 8;
    const maxTop =
      SCREEN_H - RIGHT_HANDLE_HEIGHT - (insets.bottom ?? 0) - 8;
    const tRange = Math.max(1, maxTop - minTop);
    const sRange = Math.max(1, maxScrollY);
    const progress = Math.max(0, Math.min(sRange, sY)) / sRange;
    return progress * tRange + minTop;
  };

  useEffect(() => {
    const id = rightTopAnim.addListener(({ value }) => {});
    return () => {
      try {
        rightTopAnim.removeListener(id);
      } catch (e) {}
    };
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
      onPanResponderGrant: (
        evt: GestureResponderEvent,
        _gs: PanResponderGestureState
      ) => {
        try {
          rightStartTopRef.current = (rightTopAnim as any).__getValue
            ? (rightTopAnim as any).__getValue()
            : (SCREEN_H - RIGHT_HANDLE_HEIGHT) / 2;
        } catch (e) {
          rightStartTopRef.current =
            (SCREEN_H - RIGHT_HANDLE_HEIGHT) / 2;
        }
      },
      onPanResponderMove: (
        evt: GestureResponderEvent,
        gs: PanResponderGestureState
      ) => {
        const newTop = clampRightTop(rightStartTopRef.current + gs.dy);
        rightTopAnim.setValue(newTop);
        const newScroll = rightTopToScroll(newTop);
        if (
          scrollRef.current &&
          typeof (scrollRef.current as any).scrollTo === 'function'
        ) {
          try {
            (scrollRef.current as any).scrollTo({
              y: newScroll,
              animated: false,
            });
            scrollY.current = newScroll;
          } catch (e) {}
        }
      },
      onPanResponderRelease: (
        _evt: GestureResponderEvent,
        gs: PanResponderGestureState
      ) => {
        const finalTop = clampRightTop(
          rightStartTopRef.current + gs.dy
        );
        Animated.spring(rightTopAnim, {
          toValue: finalTop,
          useNativeDriver: false,
          friction: 8,
          tension: 50,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(rightTopAnim, {
          toValue: clampRightTop(rightStartTopRef.current),
          useNativeDriver: false,
          friction: 8,
          tension: 50,
        }).start();
      },
    })
  ).current;

  const syncRightHandleToScroll = (sY: number) => {
    const newTop = scrollToRightTop(sY);
    try {
      const curr = (rightTopAnim as any).__getValue
        ? (rightTopAnim as any).__getValue()
        : 0;
      if (Math.abs(newTop - curr) > 1.5) rightTopAnim.setValue(newTop);
    } catch (e) {
      rightTopAnim.setValue(newTop);
    }
  };

  // load UI + saved meta
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (AsyncStorage) {
          try {
            const rawUI = await AsyncStorage.getItem(STORAGE_UI_KEY);
            if (rawUI) {
              const ui = JSON.parse(rawUI);
              if (ui && typeof ui.color === 'string')
                setColor(ui.color);
              if (ui && typeof ui.strokeWidth === 'number')
                setStrokeWidth(ui.strokeWidth);
            }

            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (
                Array.isArray(parsed) &&
                parsed.length === IMAGES.length
              ) {
                if (mounted)
                  setSavedMeta(
                    parsed.map((p: any) => ({
                      bitmapPath: p?.bitmapPath ?? null,
                    }))
                  );
              }
            }
          } catch (e) {
            console.warn('Failed to load storage', e);
          }
        }
      } catch (e) {
        console.warn('load saved strokes error', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [route.params]);

  // imperative updates to canvases
  useEffect(() => {
    canvasRefs.current.forEach((c) => {
      if (c && typeof c.setColor === 'function') {
        try {
          c.setColor(color);
        } catch (err) {
          console.warn('setColor err', err);
        }
      }
    });
  }, [color]);

  useEffect(() => {
    canvasRefs.current.forEach((c) => {
      if (c && typeof c.setBrushSize === 'function') {
        try {
          c.setBrushSize(strokeWidth);
        } catch (err) {
          console.warn('setBrushSize err', err);
        }
      }
    });
  }, [strokeWidth]);

  useEffect(() => {
    const er = tool === 'eraser';
    canvasRefs.current.forEach((c) => {
      if (c && typeof c.setEraser === 'function') {
        try {
          c.setEraser(er);
        } catch (err) {
          console.warn('setEraser err', err);
        }
      }
    });
  }, [tool]);

  const APP_FILES_DIR = '/data/data/com.doctor/files';
  const onSaveAll = async () => {
    const allMeta: SavedMeta[] = IMAGES.map(() => ({ bitmapPath: null }));
    for (let i = 0; i < IMAGES.length; i++) {
      const c = canvasRefs.current[i];
      if (!c || typeof c.saveToFile !== 'function') {
        allMeta[i] = savedMeta[i] || { bitmapPath: null };
        continue;
      }
      const filename = `drawing_page_${i + 1}.png`;
      const path = `${APP_FILES_DIR}/${filename}`;
      try {
        const ok = await c.saveToFile(path);
        if (ok) allMeta[i] = { bitmapPath: path };
        else
          allMeta[i] = savedMeta[i] || { bitmapPath: null };
      } catch (e) {
        console.warn('saveToFile failed for page', i, e);
        allMeta[i] = savedMeta[i] || { bitmapPath: null };
      }
    }

    const uiPayload = { color, strokeWidth };
    try {
      if (AsyncStorage) {
        await AsyncStorage.setItem(
          STORAGE_UI_KEY,
          JSON.stringify(uiPayload)
        );
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(allMeta)
        );
      } else console.warn('AsyncStorage not available — session-only.');
      setSavedMeta(allMeta);

      const returnScreen =
        (route.params &&
          (route.params.returnScreen as string | undefined)) ||
        undefined;
      const payload = {
        savedStrokes: allMeta,
        editorUI: uiPayload,
        editorSavedAt: Date.now(),
      };
      try {
        if (returnScreen && typeof navigation.navigate === 'function')
          navigation.navigate(returnScreen as never, payload as never);
        else if (
          (navigation as any).canGoBack &&
          (navigation as any).canGoBack()
        )
          navigation.navigate(
            {
              name: route.name as never,
              params: payload as never,
              merge: true,
            } as never
          );
      } catch (e) {
        console.warn('onSaveAll: navigation notify failed', e);
      }

      Alert.alert(
        'Saved',
        'Changes saved successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
        { cancelable: false }
      );
    } catch (err) {
      console.error('Failed to save editor state:', err);
      Alert.alert(
        'Save failed',
        'Could not save changes. Please try again.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={performUndo}
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-undo" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={performRedo}
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-redo" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={performClear}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons
            name="broom"
            size={20}
            color="#fff"
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={activatePen}
          style={[
            styles.iconBtn,
            tool === 'pen' ? styles.iconActive : undefined,
          ]}
        >
          <MaterialCommunityIcons
            name="pencil"
            size={20}
            color="#fff"
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={activateEraser}
          style={[
            styles.iconBtn,
            tool === 'eraser' ? styles.iconActive : undefined,
          ]}
        >
          <MaterialCommunityIcons
            name="eraser"
            size={20}
            color="#fff"
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setColorPanelOpen((v) => !v)}
          style={[styles.iconBtn, { marginLeft: 6 }]}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: color,
              borderWidth: 1,
              borderColor: '#eee',
            }}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSaveAll}
          style={[styles.iconBtn, { marginLeft: 8 }]}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.controlsCompact}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ marginRight: 8 }}>{strokeWidth}px</Text>
          <NibPreview size={28} />
        </View>
        <Slider
          style={{ flex: 1, height: 36 }}
          minimumValue={1}
          maximumValue={30}
          value={strokeWidth}
          onValueChange={(v) => {
            setStrokeWidth(Math.round(v));
            widthRef.current = Math.round(v);
          }}
        />
      </View>

      <ScrollView
        ref={(r) => (scrollRef.current = r)}
        style={{ flex: 1 }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingTop: CONTENT_TOP_PADDING,
          paddingBottom: CONTENT_BOTTOM_PADDING,
        }}
        onScroll={(
          e: NativeSyntheticEvent<NativeScrollEvent>
        ) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
          syncRightHandleToScroll(scrollY.current);
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        decelerationRate="fast"
        overScrollMode="always"
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        {IMAGES.map((src, pageIndex) => (
          <View
            key={`page-${pageIndex}`}
            style={styles.pageWrap}
          >
            <View style={styles.pageInner}>
              <Image
                source={src}
                style={[
                  styles.pageImage,
                  { width: SCREEN_W, height: PAGE_HEIGHT },
                ]}
                resizeMode="contain"
              />

              {/* Absolute overlay for drawing */}
              <View style={styles.canvasContainer}>
                <DrawingCanvas
                  index={pageIndex}
                  ref={(r) => refSetters.current[pageIndex](r)}
                />
              </View>
            </View>

            <View style={styles.pageLabelCompact} />
          </View>
        ))}
      </ScrollView>

      <Animated.View
        style={[styles.rightHandle, { top: rightTopAnim, right: 6 }]}
        {...rightPanResponder.panHandlers}
        pointerEvents="auto"
      >
        <View style={styles.rightHandleInner}>
          <View style={styles.rightGrip} />
        </View>
      </Animated.View>

      {colorPanelOpen && (
        <Animated.View style={styles.colorPanel}>
          <View style={styles.paletteGrid}>
            {PALETTE.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => {
                  setColor(c);
                  setColorPanelOpen(false);
                }}
                style={[
                  styles.gridSwatchWrap,
                  c.toUpperCase() === color.toUpperCase()
                    ? styles.gridSwatchActive
                    : undefined,
                ]}
              >
                <View
                  style={[styles.gridSwatch, { backgroundColor: c }]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

export const FormImageScreen = FormImageEditor;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#0EA5A4',
  },
  iconBtn: { padding: 8, borderRadius: 18, marginLeft: 8 },
  iconActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  controlsCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  pageWrap: {
    width: SCREEN_W,
    alignItems: 'center',
    marginVertical: PAGE_SPACING / 2,
  },
  pageInner: {
    width: SCREEN_W,
    height: PAGE_HEIGHT,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageImage: { width: SCREEN_W, height: PAGE_HEIGHT },
  canvasContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SCREEN_W,
    height: PAGE_HEIGHT,
  },
  canvasOverlay: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  pageLabelCompact: {
    width: SCREEN_W - 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  colorPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 18,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  gridSwatchWrap: {
    width: 44,
    height: 44,
    padding: 6,
    margin: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  gridSwatchActive: { borderColor: '#0EA5A4', borderWidth: 2 },
  gridSwatch: { width: '100%', height: '100%', borderRadius: 8 },
  rightHandle: {
    position: 'absolute',
    width: 26,
    height: 100,
    backgroundColor: 'transparent',
    zIndex: 60,
    paddingTop: 40,
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
  rightGrip: {
    width: 20,
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
});
