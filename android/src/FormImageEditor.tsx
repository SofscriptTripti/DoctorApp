// src/FormImageEditor.pages.tsx
// Session-only version: uses navigation payload instead of AsyncStorage persistence.

import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  forwardRef,
} from 'react';
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
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import NativeDrawingView, { DrawingRef } from './components/NativeDrawingView';

// We TRY AsyncStorage, but we don't depend on it.
let AsyncStorage: any = null;
try {
  AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
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

type DrawingCanvasProps = {
  index: number;
  savedPath?: string | null;
};

// --- stable memoized drawing canvas that forwards ref reliably
const DrawingCanvas = React.memo(
  forwardRef(function DrawingCanvasInternal(
    { index, savedPath }: DrawingCanvasProps,
    forwardedRef: React.Ref<DrawingRef | null>
  ) {
    useEffect(() => {
      console.log(
        `[DrawingCanvas] mount index=${index} savedPath=${savedPath ?? 'null'}`
      );
      return () =>
        console.log(
          `[DrawingCanvas] unmount index=${index} savedPath=${savedPath ?? 'null'}`
        );
    }, [index, savedPath]);

    return (
      <NativeDrawingView
        ref={forwardedRef}
        style={styles.canvasOverlay}
        savedPath={savedPath ?? undefined}
      />
    );
  }),
  (prev, next) =>
    prev.index === next.index && prev.savedPath === next.savedPath
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
  const returnScreen = route.params?.returnScreen as string | undefined;

  const initialStrokesFromParams = Array.isArray(route.params?.savedStrokes)
    ? route.params.savedStrokes
    : null;

  const [color, setColor] = useState('#0EA5A4');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [colorPanelOpen, setColorPanelOpen] = useState(false);

  // save status for overlay UI
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'success' | 'error'
  >('idle');
  const lastPayloadRef = useRef<any | null>(null);

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

  // 🔥 Initial savedMeta comes from navigation params (session only)
  const [savedMeta, setSavedMeta] = useState<Array<SavedMeta>>(() => {
    if (
      initialStrokesFromParams &&
      initialStrokesFromParams.length === IMAGES.length
    ) {
      return initialStrokesFromParams.map((m: any) => ({
        bitmapPath: m?.bitmapPath ?? null,
      }));
    }
    return IMAGES.map(() => ({ bitmapPath: null }));
  });

  // stable ref setter array (store refs directly for imperative calls)
  const refSetters = useRef<Array<(r: DrawingRef | null) => void>>(
    useMemo(
      () =>
        IMAGES.map((_img, i) => (r: DrawingRef | null) => {
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

  // RIGHT handle code (keeps scrolling via handle)
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

  const MIN_HANDLE_TOP = (insets.top ?? 0) + 130;
  const MAX_HANDLE_TOP =
    SCREEN_H - RIGHT_HANDLE_HEIGHT - (insets.bottom ?? 0) - 8;

  const clampRightTop = (val: number) => {
    const minTop = MIN_HANDLE_TOP;
    const maxTop = MAX_HANDLE_TOP;
    return Math.max(minTop, Math.min(maxTop, val));
  };

  const rightTopToScroll = (top: number) => {
    const minTop = MIN_HANDLE_TOP;
    const maxTop = MAX_HANDLE_TOP;
    const tRange = Math.max(1, maxTop - minTop);
    const sRange = Math.max(1, maxScrollY);
    const normalized = Math.max(minTop, Math.min(maxTop, top));
    const progress = (normalized - minTop) / tRange;
    return progress * sRange;
  };

  const scrollToRightTop = (sY: number) => {
    const minTop = MIN_HANDLE_TOP;
    const maxTop = MAX_HANDLE_TOP;
    const tRange = Math.max(1, maxTop - minTop);
    const sRange = Math.max(1, maxScrollY);
    const progress = Math.max(0, Math.min(sRange, sY)) / sRange;
    return progress * tRange + minTop;
  };

  useEffect(() => {
    const id = rightTopAnim.addListener(() => {});
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
      onPanResponderGrant: () => {
        try {
          rightStartTopRef.current = (rightTopAnim as any).__getValue
            ? (rightTopAnim as any).__getValue()
            : (SCREEN_H - RIGHT_HANDLE_HEIGHT) / 2;
        } catch (e) {
          rightStartTopRef.current = (SCREEN_H - RIGHT_HANDLE_HEIGHT) / 2;
        }
      },
      onPanResponderMove: (_evt: GestureResponderEvent, gs: PanResponderGestureState) => {
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
      onPanResponderRelease: (_evt, gs) => {
        const finalTop = clampRightTop(rightStartTopRef.current + gs.dy);
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

  // ---------------------------
  // IMAGE + DRAWING PINCH ZOOM
  // ---------------------------

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const lastScaleRef = useRef(1);
  const pinchStateRef = useRef<{
    initialDistance: number;
    startScale: number;
  } | null>(null);

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 3;

  const pinchResponder = useRef(
    PanResponder.create({
      // Only respond to 2-finger gestures
      onStartShouldSetPanResponder: (evt) =>
        evt.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (evt) =>
        evt.nativeEvent.touches.length === 2,

      onPanResponderGrant: (evt) => {
        if (saveStatus === 'saving') return;
        if (evt.nativeEvent.touches.length === 2) {
          const [t1, t2] = evt.nativeEvent.touches;
          const dx = t1.pageX - t2.pageX;
          const dy = t1.pageY - t2.pageY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          pinchStateRef.current = {
            initialDistance: dist,
            startScale: lastScaleRef.current,
          };
        }
      },

      onPanResponderMove: (evt) => {
        if (saveStatus === 'saving') return;
        if (
          evt.nativeEvent.touches.length === 2 &&
          pinchStateRef.current
        ) {
          const [t1, t2] = evt.nativeEvent.touches;
          const dx = t1.pageX - t2.pageX;
          const dy = t1.pageY - t2.pageY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          const factor =
            dist / Math.max(1, pinchStateRef.current.initialDistance);
          let newScale = pinchStateRef.current.startScale * factor;
          if (newScale < MIN_ZOOM) newScale = MIN_ZOOM;
          if (newScale > MAX_ZOOM) newScale = MAX_ZOOM;

          scaleAnim.setValue(newScale);
        }
      },

      onPanResponderRelease: () => {
        try {
          const val = (scaleAnim as any).__getValue
            ? (scaleAnim as any).__getValue()
            : 1;
          lastScaleRef.current = val;
        } catch (e) {
          lastScaleRef.current = 1;
          scaleAnim.setValue(1);
        }
        pinchStateRef.current = null;
      },

      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        pinchStateRef.current = null;
      },
    })
  ).current;

  // We DO NOT depend on AsyncStorage anymore for restoring strokes.
  // (You can keep your old AsyncStorage loading if you want,
  // but it's clearly not available in your logs.)

  const APP_FILES_DIR = '/data/data/com.doctor/files';

  const onSaveAll = async () => {
    if (saveStatus === 'saving') return; // avoid double taps

    console.log('[onSaveAll] START');
    setSaveStatus('saving');

    const allMeta: SavedMeta[] = IMAGES.map(() => ({ bitmapPath: null }));

    for (let i = 0; i < IMAGES.length; i++) {
      const c = canvasRefs.current[i];
      if (!c || typeof c.saveToFile !== 'function') {
        console.log('[onSaveAll] page', i, 'no canvas ref or no saveToFile');
        allMeta[i] = savedMeta[i] || { bitmapPath: null };
        continue;
      }

      const filename = `drawing_page_${i + 1}.png`;
      const path = `${APP_FILES_DIR}/${filename}`;

      try {
        const result = await c.saveToFile(path);
        console.log('[onSaveAll] page', i, 'saveToFile result =', result);

        if (typeof result === 'string') {
          allMeta[i] = { bitmapPath: result };
        } else if (result === true) {
          allMeta[i] = { bitmapPath: path };
        } else {
          allMeta[i] = savedMeta[i] || { bitmapPath: null };
        }
      } catch (e) {
        console.warn('saveToFile failed for page', i, e);
        allMeta[i] = savedMeta[i] || { bitmapPath: null };
      }
    }

    console.log('[onSaveAll] allMeta =', allMeta);

    const uiPayload = { color, strokeWidth };

    try {
      if (AsyncStorage) {
        await AsyncStorage.setItem(
          STORAGE_UI_KEY,
          JSON.stringify(uiPayload)
        );
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allMeta));
        console.log('[onSaveAll] wrote to AsyncStorage key =', STORAGE_KEY);
      } else {
        console.log('AsyncStorage not available — session-only.');
      }

      // 🔥 Editor now knows the saved paths immediately
      setSavedMeta(allMeta);

      const payload = {
        savedStrokes: allMeta,
        editorUI: uiPayload,
        editorSavedAt: Date.now(),
        storageKey: STORAGE_KEY,
        formName: route.params?.formName,
      };
      console.log('[onSaveAll] payload for navigation =', payload);
      lastPayloadRef.current = payload;

      setSaveStatus('success');
    } catch (err) {
      console.error('Failed to save editor state:', err);
      setSaveStatus('error');
    }
  };

  const handleSaveOk = () => {
    const payload = lastPayloadRef.current || {
      savedStrokes: savedMeta,
      editorUI: { color, strokeWidth },
      editorSavedAt: Date.now(),
      storageKey: STORAGE_KEY,
      formName: route.params?.formName,
    };

    console.log('[handleSaveOk] payload =', payload);

    setSaveStatus('idle');

    try {
      if (returnScreen && typeof navigation.navigate === 'function') {
        navigation.navigate(returnScreen as never, payload as never);
      } else {
        navigation.navigate('FormImageScreen' as never, payload as never);
      }
    } catch (e) {
      console.warn('handleSaveOk navigation failed', e);
    }
  };

  const handleSaveErrorOk = () => {
    setSaveStatus('idle');
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          disabled={saveStatus === 'saving'}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          onPress={performUndo}
          style={styles.iconBtn}
          disabled={saveStatus === 'saving'}
        >
          <Ionicons name="arrow-undo" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={performRedo}
          style={styles.iconBtn}
          disabled={saveStatus === 'saving'}
        >
          <Ionicons name="arrow-redo" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={performClear}
          style={styles.iconBtn}
          disabled={saveStatus === 'saving'}
        >
          <MaterialCommunityIcons name="broom" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={activatePen}
          style={[
            styles.iconBtn,
            tool === 'pen' ? styles.iconActive : undefined,
          ]}
          disabled={saveStatus === 'saving'}
        >
          <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={activateEraser}
          style={[
            styles.iconBtn,
            tool === 'eraser' ? styles.iconActive : undefined,
          ]}
          disabled={saveStatus === 'saving'}
        >
          <MaterialCommunityIcons name="eraser" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setColorPanelOpen((v) => !v)}
          style={[styles.iconBtn, { marginLeft: 6 }]}
          disabled={saveStatus === 'saving'}
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
          disabled={saveStatus === 'saving'}
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
          disabled={saveStatus === 'saving'}
        />
      </View>

      {/* Wrapper that handles pinch zoom (2-fingers) */}
      <View style={{ flex: 1 }} {...pinchResponder.panHandlers}>
        <ScrollView
          ref={(r) => (scrollRef.current = r)}
          style={{ flex: 1 }}
          contentContainerStyle={{
            alignItems: 'center',
          }}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
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
          {IMAGES.map((src, pageIndex) => {
            const savedPath = savedMeta[pageIndex]?.bitmapPath ?? null;
            return (
              <View key={`page-${pageIndex}`} style={styles.pageWrap}>
                <View style={styles.pageInner}>
                  {/* ZOOMED GROUP: image + drawing view together */}
                  <Animated.View
                    style={[
                      styles.zoomGroup,
                      { transform: [{ scale: scaleAnim }] },
                    ]}
                  >
                    {/* Image fills entire area */}
                    <Image
                      source={src}
                      style={styles.pageImage}
                      resizeMode="stretch"
                    />

                    {/* Drawing overlay fills exactly the same area */}
                    <View
                      style={styles.canvasContainer}
                      pointerEvents="box-none"
                    >
                      <DrawingCanvas
                        index={pageIndex}
                        savedPath={savedPath}
                        ref={(r) => refSetters.current[pageIndex](r)}
                      />
                    </View>
                  </Animated.View>
                </View>

                <View style={styles.pageLabelCompact} />
              </View>
            );
          })}
        </ScrollView>
      </View>

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
                disabled={saveStatus === 'saving'}
              >
                <View
                  style={[styles.gridSwatch, { backgroundColor: c }]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Saving / Saved overlay */}
      {saveStatus !== 'idle' && (
        <View style={styles.saveOverlay}>
          <View style={styles.saveDialog}>
            {saveStatus === 'saving' && (
              <>
                <ActivityIndicator size="large" />
                <Text style={styles.saveTitle}>Saving...</Text>
                <Text style={styles.saveMessage}>
                  Please wait while we save your changes.
                </Text>
              </>
            )}

            {saveStatus === 'success' && (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={52}
                  color="#16a34a"
                  style={{ marginBottom: 8 }}
                />
                <Text style={styles.saveTitle}>Changes saved</Text>
                <Text style={styles.saveMessage}>
                  Your changes have been saved successfully.
                </Text>
                <TouchableOpacity
                  style={styles.saveOkButton}
                  onPress={handleSaveOk}
                >
                  <Text style={styles.saveOkButtonText}>OK</Text>
                </TouchableOpacity>
              </>
            )}

            {saveStatus === 'error' && (
              <>
                <Ionicons
                  name="alert-circle"
                  size={52}
                  color="#dc2626"
                  style={{ marginBottom: 8 }}
                />
                <Text style={styles.saveTitle}>Save failed</Text>
                <Text style={styles.saveMessage}>
                  Could not save changes. Please try again.
                </Text>
                <TouchableOpacity
                  style={styles.saveOkButton}
                  onPress={handleSaveErrorOk}
                >
                  <Text style={styles.saveOkButtonText}>OK</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0EA5A4' },
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
    backgroundColor: '#eee',
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
    overflow: 'hidden', // important: clip zoom so next page doesn't overlap
  },
  zoomGroup: {
    width: '100%',
    height: '100%',
  },
  pageImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  canvasContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
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

  // Saving overlay styles
  saveOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  saveDialog: {
    width: SCREEN_W * 0.78,
    paddingHorizontal: 24,
    paddingVertical: 28,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  saveTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  saveMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
  },
  saveOkButton: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#0EA5A4',
    minWidth: 120,
    alignItems: 'center',
  },
  saveOkButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
