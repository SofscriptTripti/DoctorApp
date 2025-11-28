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
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import NativeDrawingView, { DrawingRef } from './components/NativeDrawingView';

// 🔊 VoiceKit
import { useVoice, VoiceMode } from 'react-native-voicekit';

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

// Voice text note type
type VoiceNote = {
  id: string;
  pageIndex: number;
  text: string;
  color: string;
  x: number;
  y: number;
  scale: number; // 🔍 per-note scale
};

// --- stable memoized drawing canvas that forwards ref reliably
const DrawingCanvas = React.memo(
  forwardRef(function DrawingCanvasInternal(
    { index, savedPath }: DrawingCanvasProps,
    forwardedRef: React.Ref<DrawingRef | null>
  ) {
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

// Draggable + double-tap-to-edit + corner-resize voice text component
function DraggableVoiceText({
  note,
  isEditing,
  onToggleEdit,
  onPositionChange,
  onScaleChange,
  onDelete,
}: {
  note: VoiceNote;
  isEditing: boolean;
  onToggleEdit: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  onScaleChange: (id: string, scale: number) => void;
  onDelete: (id: string) => void;
}) {
  const pan = useRef(
    new Animated.ValueXY({ x: note.x, y: note.y })
  ).current;

  const scaleAnim = useRef(new Animated.Value(note.scale ?? 1)).current;

  const startPosRef = useRef({ x: note.x, y: note.y });
  const scaleStartRef = useRef(1);
  const lastTapRef = useRef(0);

  const MIN_TEXT_SCALE = 0.6;
  const MAX_TEXT_SCALE = 2.8;

  // sync external updates (if any)
  useEffect(() => {
    pan.setValue({ x: note.x, y: note.y });
  }, [note.x, note.y, pan]);

  useEffect(() => {
    scaleAnim.setValue(note.scale ?? 1);
  }, [note.scale, scaleAnim]);

  // Drag / tap handler (for moving + double-tap detection)
  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        startPosRef.current = { x: note.x, y: note.y };
      },

      onPanResponderMove: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        const nx = startPosRef.current.x + gestureState.dx;
        const ny = startPosRef.current.y + gestureState.dy;
        pan.setValue({ x: nx, y: ny });
      },

      onPanResponderRelease: (_evt, gestureState) => {
        const dx = gestureState.dx;
        const dy = gestureState.dy;
        const moveDist = Math.sqrt(dx * dx + dy * dy);

        const now = Date.now();
        const delta = now - lastTapRef.current;
        lastTapRef.current = now;

        const isTap =
          moveDist < 5 &&
          Math.abs(gestureState.vx) < 0.3 &&
          Math.abs(gestureState.vy) < 0.3;

        // Double tap => toggle edit mode, but don't move text
        if (isTap && delta < 280) {
          onToggleEdit(note.id);
          // reset visual position back to model, so no accidental move
          pan.setValue({ x: note.x, y: note.y });
          return;
        }

        // Single tap (no move) => just reset position, do nothing
        if (isTap) {
          pan.setValue({ x: note.x, y: note.y });
          return;
        }

        // Real drag => commit new position
        const nx = startPosRef.current.x + dx;
        const ny = startPosRef.current.y + dy;
        onPositionChange(note.id, nx, ny);
      },

      onPanResponderTerminate: (_evt, gestureState) => {
        const nx = startPosRef.current.x + gestureState.dx;
        const ny = startPosRef.current.y + gestureState.dy;
        onPositionChange(note.id, nx, ny);
      },
    })
  ).current;

  // Resize handles pan (shared by all 4 dots)
  const resizePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        let current = 1;
        try {
          const v = (scaleAnim as any).__getValue?.();
          if (typeof v === 'number') current = v;
        } catch (e) {}
        scaleStartRef.current = current;
      },

      onPanResponderMove: (_evt, gestureState) => {
        // Use dx + dy to change size (simple controlled factor)
        const factor = 1 + (gestureState.dx + gestureState.dy) / 220;
        let newScale = scaleStartRef.current * factor;
        if (newScale < MIN_TEXT_SCALE) newScale = MIN_TEXT_SCALE;
        if (newScale > MAX_TEXT_SCALE) newScale = MAX_TEXT_SCALE;
        scaleAnim.setValue(newScale);
      },

      onPanResponderRelease: (_evt, gestureState) => {
        const factor = 1 + (gestureState.dx + gestureState.dy) / 220;
        let newScale = scaleStartRef.current * factor;
        if (newScale < MIN_TEXT_SCALE) newScale = MIN_TEXT_SCALE;
        if (newScale > MAX_TEXT_SCALE) newScale = MAX_TEXT_SCALE;
        onScaleChange(note.id, newScale);
      },

      onPanResponderTerminate: (_evt, gestureState) => {
        const factor = 1 + (gestureState.dx + gestureState.dy) / 220;
        let newScale = scaleStartRef.current * factor;
        if (newScale < MIN_TEXT_SCALE) newScale = MIN_TEXT_SCALE;
        if (newScale > MAX_TEXT_SCALE) newScale = MAX_TEXT_SCALE;
        onScaleChange(note.id, newScale);
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.voiceTextDragWrapper,
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      {/* Delete cross (only when NOT editing) */}
      {!isEditing && (
        <TouchableOpacity
          style={styles.voiceDeleteButton}
          onPress={() => onDelete(note.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={18} color={note.color} />
        </TouchableOpacity>
      )}

      {/* Main touch area: drag / double tap */}
      <View
        {...dragPan.panHandlers}
        style={[
          styles.voiceTextHitBox,
          isEditing && { borderColor: note.color, borderWidth: 1 },
        ]}
      >
        <Text style={[styles.voiceTextDrag, { color: note.color }]}>
          {note.text}
        </Text>
      </View>

      {/* 4 corner resize handles: only visible in edit mode */}
      {isEditing && (
        <>
          {/* top-left */}
          <View
            style={[
              styles.voiceResizeHandle,
              { top: -8, left: -8, borderColor: note.color },
            ]}
            {...resizePan.panHandlers}
          />
          {/* top-right */}
          <View
            style={[
              styles.voiceResizeHandle,
              { top: -8, right: -8, borderColor: note.color },
            ]}
            {...resizePan.panHandlers}
          />
          {/* bottom-left */}
          <View
            style={[
              styles.voiceResizeHandle,
              { bottom: -8, left: -8, borderColor: note.color },
            ]}
            {...resizePan.panHandlers}
          />
          {/* bottom-right */}
          <View
            style={[
              styles.voiceResizeHandle,
              { bottom: -8, right: -8, borderColor: note.color },
            ]}
            {...resizePan.panHandlers}
          />
        </>
      )}
    </Animated.View>
  );
}

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
  const [penWidth, setPenWidth] = useState(4);
  const [eraserWidth, setEraserWidth] = useState(20); // default eraser thicker
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [colorPanelOpen, setColorPanelOpen] = useState(false);
  // which tool's thickness panel is open: 'pen' | 'eraser' | null
  const [thicknessTool, setThicknessTool] = useState<'pen' | 'eraser' | null>(
    null
  );
  const thicknessPanelOpen = thicknessTool !== null;

  // derived: current active stroke width (used for preview + syncing)
  const activeStrokeWidth =
    tool === 'eraser' ? eraserWidth : penWidth;

  // save status for overlay UI
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'success' | 'error'
  >('idle');
  const lastPayloadRef = useRef<any | null>(null);

  const colorRef = useRef(color);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);

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

  // voice notes on pages
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // simple redo stack for deleted notes per page
  const voiceRedoStackRef = useRef<Record<number, VoiceNote[]>>({});

  // stable ref setter array (store refs directly for imperative calls)
  const refSetters = useRef<Array<(r: DrawingRef | null) => void>>(
    useMemo(
      () =>
        IMAGES.map((_img, i) => (r: DrawingRef | null) => {
          canvasRefs.current[i] = r;
        }),
      []
    )
  );

  const scrollRef = useRef<ScrollView | null>(null);
  const scrollY = useRef(0);
  const topPadding = Math.max(8, insets.top + 6);

  // NO touch scrolling (only via right handle)
  const [scrollEnabled] = useState(false);

  // -----------------------------
  // VoiceKit: state + hook usage
  // -----------------------------
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const {
    available: voiceAvailable,
    listening: voiceListening,
    transcript: voiceTranscript,
    startListening,
    stopListening,
  } = useVoice({
    locale: 'en-US',
    mode: VoiceMode.Continuous,
    enablePartialResults: true,
  });

  // Update local text whenever transcript changes
  useEffect(() => {
    if (voiceTranscript != null && voiceTranscript !== '') {
      setVoiceText(voiceTranscript);
    }
  }, [voiceTranscript]);

  // ask for mic permission on Android
  const ensureMicPermission = async () => {
    if (Platform.OS !== 'android') return true;

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone permission',
        message: 'This app needs microphone access for voice input.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  // current page index helper (uses scrollY)
  function getCurrentPageIndex() {
    const CONTENT_TOP_PADDING = Math.max(
      24,
      (insets.top ?? 0) + PAGE_SPACING + 8
    );
    const effective = Math.max(0, scrollY.current - CONTENT_TOP_PADDING);
    return Math.max(
      0,
      Math.min(
        IMAGES.length - 1,
        Math.round(effective / (PAGE_HEIGHT + PAGE_SPACING))
      )
    );
  }

  // create a new voice note on current page
  const addVoiceNote = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const pageIndex = getCurrentPageIndex();

    const newNote: VoiceNote = {
      id: `${Date.now()}-${Math.random()}`,
      pageIndex,
      text: trimmed,
      color, // use current pen color
      x: SCREEN_W * 0.15, // initial relative position
      y: PAGE_HEIGHT * 0.15,
      scale: 1,
    };

    setVoiceNotes((prev) => [...prev, newNote]);
  };

  // update note position after drag
  const handleVoiceNotePositionChange = (
    id: string,
    x: number,
    y: number
  ) => {
    setVoiceNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, x, y } : n))
    );
  };

  // update note scale after resize
  const handleVoiceNoteScaleChange = (id: string, scale: number) => {
    setVoiceNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, scale } : n))
    );
  };

  // delete note via small cross icon
  const handleVoiceNoteDelete = (id: string) => {
    setVoiceNotes((prev) => {
      const note = prev.find((n) => n.id === id);
      if (!note) return prev;

      const pageIndex = note.pageIndex;
      const stack = voiceRedoStackRef.current[pageIndex] ?? [];
      voiceRedoStackRef.current[pageIndex] = [...stack, note];

      return prev.filter((n) => n.id !== id);
    });

    setEditingNoteId((prev) => (prev === id ? null : prev));
  };

  const handleVoiceFabPress = async () => {
    if (saveStatus === 'saving') return;

    if (!voiceAvailable) {
      setVoiceError('Speech recognition is not available on this device.');
      setVoiceVisible(true);
      return;
    }

    try {
      const ok = await ensureMicPermission();
      if (!ok) {
        setVoiceError('Microphone permission denied.');
        setVoiceVisible(true);
        return;
      }

      setVoiceError(null);
      setVoiceText('');
      setVoiceVisible(true);
      await startListening();
    } catch (e: any) {
      setVoiceError(
        e?.message || e?.toString() || 'Could not start listening.'
      );
      setVoiceVisible(true);
    }
  };

  const handleVoiceStopPress = async () => {
    try {
      await stopListening();
    } catch (e) {
      // ignore
    } finally {
      // when user stops, create a note from latest text
      if (voiceText && voiceText.trim()) {
        addVoiceNote(voiceText);
      }
      setVoiceVisible(false);
      setVoiceText('');
    }
  };

  // 🔧 sync brush + eraser with native drawing views
  useEffect(() => {
    const activeWidth = tool === 'eraser' ? eraserWidth : penWidth;

    canvasRefs.current.forEach((c) => {
      if (!c) return;

      if (typeof c.setBrushSize === 'function') {
        c.setBrushSize(activeWidth);
      }

      if (tool === 'eraser') {
        if (typeof c.setEraser === 'function') {
          c.setEraser(true);
        }
      } else {
        if (typeof c.setEraser === 'function') {
          c.setEraser(false);
        }
        if (typeof c.setColor === 'function') {
          c.setColor(color);
        }
      }
    });
  }, [tool, color, penWidth, eraserWidth]);

  const performUndo = () => {
    const idx = getCurrentPageIndex();
    const c = canvasRefs.current[idx];
    if (c && typeof c.undo === 'function') c.undo();

    // also undo last text note on this page
    let undoneNote: VoiceNote | null = null;

    setVoiceNotes((prev) => {
      const notesForPage = prev.filter((n) => n.pageIndex === idx);
      if (notesForPage.length === 0) return prev;

      undoneNote = notesForPage[notesForPage.length - 1];
      return prev.filter((n) => n.id !== undoneNote!.id);
    });

    if (undoneNote) {
      const stack = voiceRedoStackRef.current[idx] ?? [];
      voiceRedoStackRef.current[idx] = [...stack, undoneNote];
      if (editingNoteId === undoneNote.id) {
        setEditingNoteId(null);
      }
    }
  };

  const performRedo = () => {
    const idx = getCurrentPageIndex();
    const c = canvasRefs.current[idx];
    if (c && typeof c.redo === 'function') c.redo();

    // also redo last undone text note on this page
    const stack = voiceRedoStackRef.current[idx] ?? [];
    if (stack.length === 0) return;

    const restored = stack[stack.length - 1];
    voiceRedoStackRef.current[idx] = stack.slice(0, -1);

    setVoiceNotes((prev) => [...prev, restored]);
  };

  const clearNotesForPage = (pageIndex: number) => {
    setVoiceNotes((prev) => prev.filter((n) => n.pageIndex !== pageIndex));
    voiceRedoStackRef.current[pageIndex] = [];
  };

  const performClear = () => {
    const idx = getCurrentPageIndex();
    const c = canvasRefs.current[idx];
    if (c && typeof c.clear === 'function') c.clear();

    // also clear all text notes on this page
    clearNotesForPage(idx);
    setEditingNoteId(null);
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
          backgroundColor: tool === 'eraser' ? '#ffffff' : color,
          borderWidth: tool === 'eraser' ? 1 : 0,
          borderColor: '#d1d5db',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: Math.max(
              4,
              Math.round((activeStrokeWidth / 30) * size)
            ),
            height: Math.max(
              4,
              Math.round((activeStrokeWidth / 30) * size)
            ),
            borderRadius: 100,
            backgroundColor: tool === 'eraser' ? '#94a3b8' : '#ffffff',
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
  const progress = Math.max(0, Math.min(sY, sRange)) / sRange;
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
      onPanResponderMove: (
        _evt: GestureResponderEvent,
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

  const APP_FILES_DIR = '/data/data/com.doctor/files';

  const onSaveAll = async () => {
    if (saveStatus === 'saving') return; // avoid double taps

    setSaveStatus('saving');

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
        const result = await c.saveToFile(path);

        if (result) {
          allMeta[i] = { bitmapPath: path };
        } else {
          allMeta[i] = savedMeta[i] || { bitmapPath: null };
        }
      } catch (e) {
        allMeta[i] = savedMeta[i] || { bitmapPath: null };
      }
    }

    console.log('[onSaveAll] allMeta =', allMeta);

    const uiPayload = {
      color,
      penWidth,
      eraserWidth,
    };

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
        console.log('[onSaveAll] wrote to AsyncStorage key =', STORAGE_KEY);
      } else {
        console.log('AsyncStorage not available — session-only.');
      }

      setSavedMeta(allMeta);

      const payload = {
        savedStrokes: allMeta,
        editorUI: uiPayload,
        editorSavedAt: Date.now(),
        storageKey: STORAGE_KEY,
        formName: route.params?.formName,
      };
      lastPayloadRef.current = payload;

      setSaveStatus('success');
    } catch (err) {
      setSaveStatus('error');
    }
  };

  // ✅ IMPORTANT: update existing FormImageScreen instead of pushing new one
  const handleSaveOk = () => {
    const payload = lastPayloadRef.current || {
      savedStrokes: savedMeta,
      editorUI: { color, penWidth, eraserWidth },
      editorSavedAt: Date.now(),
      storageKey: STORAGE_KEY,
      formName: route.params?.formName,
    };

    setSaveStatus('idle');

    const targetName = (returnScreen as string) || 'FormImageScreen';

    try {
      // Try to MERGE params into existing screen (so its useEffect sees new savedStrokes)
      navigation.navigate({
        name: targetName,
        params: payload,
        // merge: true ensures existing route is reused when possible
        merge: true,
      } as any);
    } catch (e) {
      console.warn('handleSaveOk navigation (merge) failed, fallback', e);
      try {
        navigation.navigate(targetName as never, payload as never);
      } catch (e2) {
        console.warn('handleSaveOk fallback navigation failed', e2);
      }
    }
  };

  const handleSaveErrorOk = () => {
    setSaveStatus('idle');
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* HEADER / TOOLBAR */}
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        {/* Back */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          disabled={saveStatus === 'saving'}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* Undo / Redo / Clear group */}
        <View style={styles.historyGroup}>
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
            <MaterialCommunityIcons
              name="broom"
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* Pen / Eraser grouped nicely */}
        <View style={styles.toolGroupRow}>
          {/* Pen group */}
          <View
            style={[
              styles.toolChip,
              tool === 'pen' && styles.toolChipActive,
            ]}
          >
            <TouchableOpacity
              onPress={activatePen}
              style={styles.toolChipIcon}
              disabled={saveStatus === 'saving'}
            >
              <MaterialCommunityIcons
                name="pencil"
                size={18}
                color={tool === 'pen' ? '#0EA5A4' : '#ffffff'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                setThicknessTool((prev) =>
                  prev === 'pen' ? null : 'pen'
                )
              }
              style={styles.toolChipIcon}
              disabled={saveStatus === 'saving'}
            >
              <Ionicons
                name={
                  thicknessPanelOpen && thicknessTool === 'pen'
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={16}
                color={tool === 'pen' ? '#0EA5A4' : '#ffffff'}
              />
            </TouchableOpacity>
          </View>

          {/* Eraser group */}
          <View
            style={[
              styles.toolChip,
              tool === 'eraser' && styles.toolChipActive,
            ]}
          >
            <TouchableOpacity
              onPress={activateEraser}
              style={styles.toolChipIcon}
              disabled={saveStatus === 'saving'}
            >
              <MaterialCommunityIcons
                name="eraser"
                size={18}
                color={tool === 'eraser' ? '#0EA5A4' : '#ffffff'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                setThicknessTool((prev) =>
                  prev === 'eraser' ? null : 'eraser'
                )
              }
              style={styles.toolChipIcon}
              disabled={saveStatus === 'saving'}
            >
              <Ionicons
                name={
                  thicknessPanelOpen && thicknessTool === 'eraser'
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={16}
                color={tool === 'eraser' ? '#0EA5A4' : '#ffffff'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Color + Save */}
        <TouchableOpacity
          onPress={() => setColorPanelOpen((v) => !v)}
          style={[styles.iconBtn, { marginLeft: 4 }]}
          disabled={saveStatus === 'saving'}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: color,
              borderWidth: 1,
              borderColor: '#eee',
            }}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSaveAll}
          style={[styles.iconBtn, { marginLeft: 4 }]}
          disabled={saveStatus === 'saving'}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Compact bar showing current tool + active thickness */}
      <View style={styles.controlsCompact}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flex: 1,
          }}
        >
          <View>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>
              {tool === 'eraser'
                ? 'Eraser thickness'
                : 'Pen thickness'}
            </Text>
            <Text
              style={{
                marginTop: 2,
                fontSize: 16,
                fontWeight: '600',
                color: '#111827',
              }}
            >
              {activeStrokeWidth}px
            </Text>
          </View>
          <NibPreview size={28} />
        </View>
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
            const notesForPage = voiceNotes.filter(
              (n) => n.pageIndex === pageIndex
            );
            return (
              <View key={`page-${pageIndex}`} style={styles.pageWrap}>
                <View style={styles.pageInner}>
                  {/* ZOOMED GROUP: image + drawing + text together */}
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

                    {/* Drawing overlay - disable touches while editing text */}
                    <View
                      style={styles.canvasContainer}
                      pointerEvents={editingNoteId ? 'none' : 'box-none'}
                    >
                      <DrawingCanvas
                        index={pageIndex}
                        savedPath={savedPath}
                        ref={(r) => refSetters.current[pageIndex](r)}
                      />
                    </View>

                    {/* Voice notes (draggable + double-tap edit + corner resize) */}
                    {notesForPage.map((note) => (
                      <DraggableVoiceText
                        key={note.id}
                        note={note}
                        isEditing={editingNoteId === note.id}
                        onToggleEdit={(id) =>
                          setEditingNoteId((prev) =>
                            prev === id ? null : id
                          )
                        }
                        onPositionChange={handleVoiceNotePositionChange}
                        onScaleChange={handleVoiceNoteScaleChange}
                        onDelete={handleVoiceNoteDelete}
                      />
                    ))}
                  </Animated.View>
                </View>

                <View style={styles.pageLabelCompact} />
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Right scroll handle */}
      <Animated.View
        style={[styles.rightHandle, { top: rightTopAnim, right: 6 }]}
        {...rightPanResponder.panHandlers}
        pointerEvents="auto"
      >
        <View style={styles.rightHandleInner}>
          <View style={styles.rightGrip} />
        </View>
      </Animated.View>

      {/* 🔊 floating mic FAB */}
      <TouchableOpacity
        style={[
          styles.voiceFab,
          { bottom: (insets.bottom ?? 0) + 24 },
        ]}
        activeOpacity={0.8}
        onPress={handleVoiceFabPress}
        disabled={saveStatus === 'saving'}
      >
        <Ionicons name="mic" size={24} color="#fff" />
      </TouchableOpacity>

      {/* 🔽 Thickness dropdown panel (one tool at a time, HORIZONTAL slider) */}
      {thicknessPanelOpen && thicknessTool && (
        <View
          style={[
            styles.thicknessPanel,
            { top: topPadding + 46 },
          ]}
        >
          <View style={styles.thicknessHeaderRow}>
            <Text style={styles.thicknessTitle}>
              {thicknessTool === 'pen'
                ? 'Pen thickness'
                : 'Eraser thickness'}
            </Text>
            <TouchableOpacity onPress={() => setThicknessTool(null)}>
              <Ionicons
                name="chevron-up"
                size={18}
                color="#111827"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.thicknessContentRow}>
            <Text style={styles.thicknessBigValue}>
              {thicknessTool === 'pen' ? penWidth : eraserWidth}px
            </Text>

            <Slider
              style={styles.thicknessSlider}
              minimumValue={thicknessTool === 'pen' ? 1 : 4}
              maximumValue={thicknessTool === 'pen' ? 40 : 50}
              step={1}
              value={thicknessTool === 'pen' ? penWidth : eraserWidth}
              onValueChange={(v) => {
                const val = Math.round(v);
                if (thicknessTool === 'pen') {
                  setPenWidth(val);
                } else {
                  setEraserWidth(val);
                }
              }}
              disabled={saveStatus === 'saving'}
            />
          </View>
        </View>
      )}

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

      {/* 🔊 voice popup overlay */}
      {voiceVisible && (
        <View style={styles.voiceOverlay}>
          <View style={styles.voiceDialog}>
            <Text style={styles.voiceTitle}>Google</Text>
            <Text style={styles.voiceSubtitle}>
              {voiceListening ? 'Listening…' : 'Processing…'}
            </Text>

            <View style={styles.voiceDotsRow}>
              <View style={styles.voiceDot} />
              <View style={styles.voiceDot} />
              <View style={styles.voiceDot} />
              <View style={styles.voiceDot} />
            </View>

            {voiceError ? (
              <Text style={styles.voiceErrorText}>{voiceError}</Text>
            ) : null}

            <TouchableOpacity
              style={styles.voiceMicButton}
              onPress={handleVoiceStopPress}
              activeOpacity={0.8}
            >
              <Ionicons
                name={voiceListening ? 'mic' : 'mic-off'}
                size={32}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
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
  iconBtn: { padding: 6, borderRadius: 18, marginLeft: 6 },
  controlsCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#eee',
  },

  historyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },

  toolGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginHorizontal: 2,
  },
  toolChipActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  toolChipIcon: {
    paddingHorizontal: 4,
    paddingVertical: 4,
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
    overflow: 'hidden',
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

  // Thickness dropdown (horizontal slider)
  thicknessPanel: {
    position: 'absolute',
    right: 12,
    left: 70,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 80,
  },
  thicknessHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  thicknessTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  thicknessContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thicknessBigValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 12,
    minWidth: 64,
  },
  thicknessSlider: {
    flex: 1,
  },

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
    backgroundColor: '#266433ff',
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

  // 🔊 voice FAB
  voiceFab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0EA5A4',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 70,
  },

  // draggable voice text on page
  voiceTextDragWrapper: {
    position: 'absolute',
  },
  voiceTextHitBox: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  voiceTextDrag: {
    fontSize: 16,
    fontWeight: '500',
    backgroundColor: 'transparent',
  },
  voiceResizeHandle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    borderWidth: 1.5,
  },
  voiceDeleteButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    zIndex: 5,
    backgroundColor: '#ffffffee',
    borderRadius: 10,
    padding: 1,
  },

  // 🔊 voice overlay styles
  voiceOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 90,
  },
  voiceDialog: {
    width: SCREEN_W,
    paddingTop: 26,
    paddingBottom: 42,
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
  },
  voiceTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f9fafb',
  },
  voiceSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#9ca3af',
  },
  voiceDotsRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  voiceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
    backgroundColor: '#9ca3af',
  },
  voiceMicButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  voiceErrorText: {
    marginTop: 10,
    fontSize: 12,
    color: '#fecaca',
    textAlign: 'center',
    paddingHorizontal: 16,
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
