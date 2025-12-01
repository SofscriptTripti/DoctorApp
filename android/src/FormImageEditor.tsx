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
  Modal,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
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

// 👉 Sticker image (local asset)
const STICKER_IMAGE_SOURCE = require('./Images/NameStick.jpeg');

type SavedMeta = { bitmapPath?: string | null };

type DrawingCanvasProps = {
  index: number;
  savedPath?: string | null;
};

// Voice text note type
export type VoiceNote = {
  id: string;
  pageIndex: number;
  text: string;
  color: string;
  x: number;
  y: number;
  scale: number; // per-note scale
};

// Image sticker type
export type ImageSticker = {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  scale: number;
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
  // Internal source-of-truth for position to avoid jumping
  const currentPosRef = useRef<{ x: number; y: number }>({
    x: note.x,
    y: note.y,
  });

  const pan = useRef(
    new Animated.ValueXY({ x: note.x, y: note.y })
  ).current;

  const scaleAnim = useRef(new Animated.Value(note.scale ?? 1)).current;

  const startPosRef = useRef({ x: note.x, y: note.y });
  const scaleStartRef = useRef(1);
  const lastTapRef = useRef(0);

  const MIN_TEXT_SCALE = 0.6;
  const MAX_TEXT_SCALE = 2.8;

  // sync external scale if it changes (e.g. from undo/redo)
  useEffect(() => {
    scaleAnim.setValue(note.scale ?? 1);
  }, [note.scale, scaleAnim]);

  // Drag / tap handler (for moving + double-tap detection)
  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        // use current animated position as the start, not props
        try {
          const v = (pan as any).__getValue?.();
          if (v && typeof v.x === 'number' && typeof v.y === 'number') {
            startPosRef.current = { x: v.x, y: v.y };
          } else {
            startPosRef.current = { ...currentPosRef.current };
          }
        } catch (e) {
          startPosRef.current = { ...currentPosRef.current };
        }
      },

      onPanResponderMove: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        const nx = startPosRef.current.x + gestureState.dx;
        const ny = startPosRef.current.y + gestureState.dy;
        pan.setValue({ x: nx, y: ny });
        // live-update internal ref so we always know latest visual position
        currentPosRef.current = { x: nx, y: ny };
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

        // final position from currentPosRef
        const { x: finalX, y: finalY } = currentPosRef.current;

        // Double tap => toggle edit mode, but DO NOT jump
        if (isTap && delta < 280) {
          onPositionChange(note.id, finalX, finalY); // commit where it visually is
          onToggleEdit(note.id);
          return;
        }

        // Single tap (no move) => commit current pos but don't move
        if (isTap) {
          onPositionChange(note.id, finalX, finalY);
          return;
        }

        // Real drag => commit new position
        onPositionChange(note.id, finalX, finalY);
      },

      onPanResponderTerminate: (_evt, gestureState) => {
        const nx = startPosRef.current.x + gestureState.dx;
        const ny = startPosRef.current.y + gestureState.dy;
        pan.setValue({ x: nx, y: ny });
        currentPosRef.current = { x: nx, y: ny };
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

      onPanResponderMove: (_evt: GestureResponderEvent, gestureState) => {
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

// 🧩 Draggable image sticker (drag + double-tap edit + resize like voice text)
function DraggableImageSticker({
  sticker,
  imageSource,
  isEditing,
  onToggleEdit,
  onPositionChange,
  onScaleChange,
  onDelete,
}: {
  sticker: ImageSticker;
  imageSource: any;
  isEditing: boolean;
  onToggleEdit: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  onScaleChange: (id: string, scale: number) => void;
  onDelete: (id: string) => void;
}) {
  const currentPosRef = useRef<{ x: number; y: number }>({
    x: sticker.x,
    y: sticker.y,
  });

  const pan = useRef(
    new Animated.ValueXY({ x: sticker.x, y: sticker.y })
  ).current;

  const scaleAnim = useRef(new Animated.Value(sticker.scale ?? 1)).current;

  const startPosRef = useRef({ x: sticker.x, y: sticker.y });
  const scaleStartRef = useRef(1);
  const lastTapRef = useRef(0);

  const MIN_SCALE = 0.6;
  const MAX_SCALE = 3;

  // keep external scale in sync
  useEffect(() => {
    scaleAnim.setValue(sticker.scale ?? 1);
  }, [sticker.scale, scaleAnim]);

  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        try {
          const v = (pan as any).__getValue?.();
          if (v && typeof v.x === 'number' && typeof v.y === 'number') {
            startPosRef.current = { x: v.x, y: v.y };
          } else {
            startPosRef.current = { ...currentPosRef.current };
          }
        } catch (e) {
          startPosRef.current = { ...currentPosRef.current };
        }
      },

      onPanResponderMove: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        const nx = startPosRef.current.x + gestureState.dx;
        const ny = startPosRef.current.y + gestureState.dy;
        pan.setValue({ x: nx, y: ny });
        currentPosRef.current = { x: nx, y: ny };
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

        const { x: finalX, y: finalY } = currentPosRef.current;

        // Double tap => toggle edit mode, keep current position
        if (isTap && delta < 280) {
          onPositionChange(sticker.id, finalX, finalY);
          onToggleEdit(sticker.id);
          return;
        }

        // Single tap => commit but don't move
        if (isTap) {
          onPositionChange(sticker.id, finalX, finalY);
          return;
        }

        // Real drag
        onPositionChange(sticker.id, finalX, finalY);
      },

      onPanResponderTerminate: (_evt, gestureState) => {
        const nx = startPosRef.current.x + gestureState.dx;
        const ny = startPosRef.current.y + gestureState.dy;
        pan.setValue({ x: nx, y: ny });
        currentPosRef.current = { x: nx, y: ny };
        onPositionChange(sticker.id, nx, ny);
      },
    })
  ).current;

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

      onPanResponderMove: (_evt: GestureResponderEvent, gestureState) => {
        const factor = 1 + (gestureState.dx + gestureState.dy) / 220;
        let newScale = scaleStartRef.current * factor;
        if (newScale < MIN_SCALE) newScale = MIN_SCALE;
        if (newScale > MAX_SCALE) newScale = MAX_SCALE;
        scaleAnim.setValue(newScale);
      },

      onPanResponderRelease: (_evt, gestureState) => {
        const factor = 1 + (gestureState.dx + gestureState.dy) / 220;
        let newScale = scaleStartRef.current * factor;
        if (newScale < MIN_SCALE) newScale = MIN_SCALE;
        if (newScale > MAX_SCALE) newScale = MAX_SCALE;
        onScaleChange(sticker.id, newScale);
      },

      onPanResponderTerminate: (_evt, gestureState) => {
        const factor = 1 + (gestureState.dx + gestureState.dy) / 220;
        let newScale = scaleStartRef.current * factor;
        if (newScale < MIN_SCALE) newScale = MIN_SCALE;
        if (newScale > MAX_SCALE) newScale = MAX_SCALE;
        onScaleChange(sticker.id, newScale);
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.stickerWrapper,
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      {!isEditing && (
        <TouchableOpacity
          style={styles.voiceDeleteButton}
          onPress={() => onDelete(sticker.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={18} color="#0EA5A4" />
        </TouchableOpacity>
      )}

      <View
        {...dragPan.panHandlers}
        style={[
          styles.stickerHitBox,
          isEditing && { borderWidth: 1, borderColor: '#0EA5A4' },
        ]}
      >
        <Image
          source={imageSource}
          style={styles.stickerImage}
          resizeMode="contain"
        />
      </View>

      {isEditing && (
        <>
          {/* top-left */}
          <View
            style={[
              styles.voiceResizeHandle,
              { top: -8, left: -8, borderColor: '#0EA5A4' },
            ]}
            {...resizePan.panHandlers}
          />
          {/* top-right */}
          <View
            style={[
              styles.voiceResizeHandle,
              { top: -8, right: -8, borderColor: '#0EA5A4' },
            ]}
            {...resizePan.panHandlers}
          />
          {/* bottom-left */}
          <View
            style={[
              styles.voiceResizeHandle,
              { bottom: -8, left: -8, borderColor: '#0EA5A4' },
            ]}
            {...resizePan.panHandlers}
          />
          {/* bottom-right */}
          <View
            style={[
              styles.voiceResizeHandle,
              { bottom: -8, right: -8, borderColor: '#0EA5A4' },
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

  // 🔹 Load overlays from params if present (so they persist when you come back)
  const initialVoiceNotesFromParams: VoiceNote[] = Array.isArray(
    route.params?.voiceNotes
  )
    ? route.params.voiceNotes
    : [];

  const initialImageStickersFromParams: ImageSticker[] = Array.isArray(
    route.params?.imageStickers
  )
    ? route.params.imageStickers
    : [];

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

  // ✏️ writing on/off
  const [writingEnabled, setWritingEnabled] = useState(true);
  const writingEnabledRef = useRef(writingEnabled);
  useEffect(() => {
    writingEnabledRef.current = writingEnabled;
  }, [writingEnabled]);

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

  // 🔔 temporary "Editing mode Off" hint above mic / sticker / text
  const [editingOffHintVisible, setEditingOffHintVisible] = useState(false);
  const editingOffHintTimeoutRef = useRef<any>(null);
  useEffect(() => {
    return () => {
      if (editingOffHintTimeoutRef.current) {
        clearTimeout(editingOffHintTimeoutRef.current);
      }
    };
  }, []);

  // when writing disabled, close panels
  useEffect(() => {
    if (!writingEnabled) {
      setThicknessTool(null);
      setColorPanelOpen(false);
    }
  }, [writingEnabled]);

  // stable storage for canvas refs
  const canvasRefs = useRef<Array<DrawingRef | null>>(
    useMemo(() => IMAGES.map(() => null), [])
  );

  // Initial savedMeta from params or blank
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

  // voice notes on pages (initialised from route params)
  const [voiceNotes, setVoiceNotes] =
    useState<VoiceNote[]>(initialVoiceNotesFromParams);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // image stickers on pages (initialised from route params)
  const [imageStickers, setImageStickers] =
    useState<ImageSticker[]>(initialImageStickersFromParams);
  const [editingStickerId, setEditingStickerId] = useState<string | null>(
    null
  );

  // simple redo stack for deleted notes per page
  const voiceRedoStackRef = useRef<Record<number, VoiceNote[]>>({});

  // sticker modal
  const [stickerModalVisible, setStickerModalVisible] = useState(false);

  // text modal (for manual typed text)
  const [textModalVisible, setTextModalVisible] = useState(false);
  const [typedText, setTypedText] = useState('');

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

  // NO touch scrolling (only via right handle) while writing is ON.
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

  // 🔄 Load persisted drawings + overlays (if editor opened fresh via storageKey)
  useEffect(() => {
    if (!AsyncStorage) return;

    const loadPersisted = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          console.warn('[FormImageEditor] Failed to parse STORAGE_KEY JSON', e);
          return;
        }

        const paramsObj = route.params || {};

        // Backwards compatibility: old version stored just an array of bitmaps
        if (Array.isArray(parsed)) {
          if (!initialStrokesFromParams) {
            const metaArr: SavedMeta[] = IMAGES.map((_, idx) => {
              const m = parsed[idx];
              return { bitmapPath: m?.bitmapPath ?? null };
            });
            setSavedMeta(metaArr);
          }
          return;
        }

        // New structure: { bitmaps, voiceNotes, imageStickers }
        if (Array.isArray(parsed.bitmaps) && !initialStrokesFromParams) {
          const metaArr: SavedMeta[] = IMAGES.map((_, idx) => {
            const m = parsed.bitmaps[idx];
            return { bitmapPath: m?.bitmapPath ?? null };
          });
          setSavedMeta(metaArr);
        }

        if (
          (!Array.isArray(paramsObj.voiceNotes) ||
            paramsObj.voiceNotes.length === 0) &&
          Array.isArray(parsed.voiceNotes)
        ) {
          setVoiceNotes(parsed.voiceNotes);
        }

        if (
          (!Array.isArray(paramsObj.imageStickers) ||
            paramsObj.imageStickers.length === 0) &&
          Array.isArray(parsed.imageStickers)
        ) {
          setImageStickers(parsed.imageStickers);
        }

        // Optionally restore brush UI
        try {
          const uiRaw = await AsyncStorage.getItem(STORAGE_UI_KEY);
          if (uiRaw) {
            const ui = JSON.parse(uiRaw);
            if (ui.color) setColor(ui.color);
            if (typeof ui.penWidth === 'number') setPenWidth(ui.penWidth);
            if (typeof ui.eraserWidth === 'number')
              setEraserWidth(ui.eraserWidth);
          }
        } catch (e) {
          console.warn('[FormImageEditor] Failed to parse UI JSON', e);
        }
      } catch (err) {
        console.warn('[FormImageEditor] Failed to load persisted data', err);
      }
    };

    loadPersisted();
  }, [STORAGE_KEY, STORAGE_UI_KEY, route.params, initialStrokesFromParams]);

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

  // create a new image sticker on current page
  const addImageSticker = () => {
    const pageIndex = getCurrentPageIndex();

    const newSticker: ImageSticker = {
      id: `${Date.now()}-${Math.random()}`,
      pageIndex,
      x: SCREEN_W * 0.2,
      y: PAGE_HEIGHT * 0.2,
      scale: 1,
    };

    setImageStickers((prev) => [...prev, newSticker]);
  };

  const showEditingOffHint = () => {
    setEditingOffHintVisible(true);
    if (editingOffHintTimeoutRef.current) {
      clearTimeout(editingOffHintTimeoutRef.current);
    }
    editingOffHintTimeoutRef.current = setTimeout(() => {
      setEditingOffHintVisible(false);
      editingOffHintTimeoutRef.current = null;
    }, 2000);
  };

  const handleAddStickerIconPress = () => {
    if (saveStatus === 'saving') return;

    // When writing is OFF, just show short hint "Editing mode Off"
    if (!writingEnabled) {
      showEditingOffHint();
      return;
    }

    setStickerModalVisible(true);
  };

  const handleAddTextIconPress = () => {
    if (saveStatus === 'saving') return;

    // When writing is OFF, just show short hint "Editing mode Off"
    if (!writingEnabled) {
      showEditingOffHint();
      return;
    }

    setTypedText('');
    setTextModalVisible(true);
  };

  const handleTextModalAdd = () => {
    const trimmed = typedText.trim();
    if (trimmed) {
      addVoiceNote(trimmed);
    }
    setTextModalVisible(false);
    setTypedText('');
  };

  // update note position after drag / double-tap
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

  // update sticker position after drag / double-tap
  const handleStickerPositionChange = (
    id: string,
    x: number,
    y: number
  ) => {
    setImageStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, x, y } : s))
    );
  };

  // update sticker scale after resize
  const handleStickerScaleChange = (id: string, scale: number) => {
    setImageStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, scale } : s))
    );
  };

  // delete sticker
  const handleStickerDelete = (id: string) => {
    setImageStickers((prev) => prev.filter((s) => s.id !== id));
    setEditingStickerId((prev) => (prev === id ? null : prev));
  };

  const handleVoiceFabPress = async () => {
    if (saveStatus === 'saving') return;

    // When writing is OFF, just show short hint "Editing mode Off"
    if (!writingEnabled) {
      showEditingOffHint();
      return;
    }

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
    if (!writingEnabled) return;
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
    if (!writingEnabled) return;
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
    setImageStickers((prev) =>
      prev.filter((s) => s.pageIndex !== pageIndex)
    );
  };

  const performClear = () => {
    if (!writingEnabled) return;
    const idx = getCurrentPageIndex();
    const c = canvasRefs.current[idx];
    if (c && typeof c.clear === 'function') c.clear();

    // also clear all text notes & stickers on this page
    clearNotesForPage(idx);
    setEditingNoteId(null);
    setEditingStickerId(null);
  };

  const activatePen = () => {
    if (!writingEnabled) return;
    setTool('pen');
  };
  const activateEraser = () => {
    if (!writingEnabled) return;
    setTool('eraser');
  };

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
  // IMAGE + DRAWING PINCH ZOOM + PAN (per-page)
  // ---------------------------

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 3;

  // per-page animated values
  const pageScaleAnimsRef = useRef(
    IMAGES.map(() => new Animated.Value(1))
  ).current;
  const pageTranslateXRef = useRef(
    IMAGES.map(() => new Animated.Value(0))
  ).current;
  const pageTranslateYRef = useRef(
    IMAGES.map(() => new Animated.Value(0))
  ).current;

  // per-page numeric scale + pan start
  const lastScalePerPageRef = useRef(IMAGES.map(() => 1)).current;
  const panStartPerPageRef = useRef(
    IMAGES.map(() => ({ x: 0, y: 0 }))
  ).current;

  const pinchStateRef = useRef<{
    initialDistance: number;
    startScale: number;
    pageIndex: number;
  } | null>(null);

  const activePanPageRef = useRef<number | null>(null);

  const pinchResponder = useRef(
    PanResponder.create({
      // Decide when to capture gestures
      onStartShouldSetPanResponder: (evt) => {
        const touches = evt.nativeEvent.touches || [];
        const count = touches.length;
        const pageIndex = getCurrentPageIndex();
        const currentScale = lastScalePerPageRef[pageIndex] ?? 1;

        // 2-finger => always for pinch
        if (count === 2) return true;

        // When writing is OFF and that page is zoomed in, 1-finger drag pans the page
        if (
          !writingEnabledRef.current &&
          count === 1 &&
          currentScale > 1.01
        ) {
          return true;
        }

        return false;
      },
      onMoveShouldSetPanResponder: (evt) => {
        const touches = evt.nativeEvent.touches || [];
        const count = touches.length;
        const pageIndex = getCurrentPageIndex();
        const currentScale = lastScalePerPageRef[pageIndex] ?? 1;

        if (count === 2) return true;

        if (
          !writingEnabledRef.current &&
          count === 1 &&
          currentScale > 1.01
        ) {
          return true;
        }

        return false;
      },

      onPanResponderGrant: (evt) => {
        if (saveStatus === 'saving') return;

        const touches = evt.nativeEvent.touches || [];
        const count = touches.length;
        const pageIndex = getCurrentPageIndex();

        if (count === 2) {
          // start pinch zoom for this page
          const [t1, t2] = touches;
          const dx = t1.pageX - t2.pageX;
          const dy = t1.pageY - t2.pageY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          pinchStateRef.current = {
            initialDistance: dist,
            startScale: lastScalePerPageRef[pageIndex] ?? 1,
            pageIndex,
          };
          activePanPageRef.current = null;
        } else if (
          !writingEnabledRef.current &&
          count === 1 &&
          (lastScalePerPageRef[pageIndex] ?? 1) > 1.01
        ) {
          // start panning this page
          activePanPageRef.current = pageIndex;
          try {
            const currX = (pageTranslateXRef[pageIndex] as any).__getValue
              ? (pageTranslateXRef[pageIndex] as any).__getValue()
              : 0;
            const currY = (pageTranslateYRef[pageIndex] as any).__getValue
              ? (pageTranslateYRef[pageIndex] as any).__getValue()
              : 0;
            panStartPerPageRef[pageIndex] = { x: currX, y: currY };
          } catch (e) {
            panStartPerPageRef[pageIndex] = { x: 0, y: 0 };
          }
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        if (saveStatus === 'saving') return;

        const touches = evt.nativeEvent.touches || [];
        const count = touches.length;

        if (count === 2) {
          // If we don't have an active pinch (e.g. user was panning, then adds a 2nd finger),
          // initialise pinchState here so pinch-out works after pan.
          if (!pinchStateRef.current) {
            const pageIndex = getCurrentPageIndex();
            const [t1, t2] = touches;
            const dx = t1.pageX - t2.pageX;
            const dy = t1.pageY - t2.pageY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            pinchStateRef.current = {
              initialDistance: dist,
              startScale: lastScalePerPageRef[pageIndex] ?? 1,
              pageIndex,
            };
            // stop any pan in progress
            activePanPageRef.current = null;
          }

          const { pageIndex, initialDistance, startScale } =
            pinchStateRef.current!;
          const [t1, t2] = touches;
          const dx = t1.pageX - t2.pageX;
          const dy = t1.pageY - t2.pageY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          const factor = dist / Math.max(1, initialDistance);
          let newScale = startScale * factor;
          if (newScale < MIN_ZOOM) newScale = MIN_ZOOM;
          if (newScale > MAX_ZOOM) newScale = MAX_ZOOM;

          pageScaleAnimsRef[pageIndex].setValue(newScale);
        } else if (
          !writingEnabledRef.current &&
          count === 1 &&
          activePanPageRef.current !== null
        ) {
          // Pan the zoomed page
          const pageIndex = activePanPageRef.current;
          if ((lastScalePerPageRef[pageIndex] ?? 1) <= 1.01) return;

          const start = panStartPerPageRef[pageIndex];
          const newX = start.x + gestureState.dx;
          const newY = start.y + gestureState.dy;
          pageTranslateXRef[pageIndex].setValue(newX);
          pageTranslateYRef[pageIndex].setValue(newY);
        }
      },

      onPanResponderRelease: () => {
        // finish pinch
        if (pinchStateRef.current) {
          const pageIndex = pinchStateRef.current.pageIndex;
          let finalScale = lastScalePerPageRef[pageIndex] ?? 1;
          try {
            const v = (pageScaleAnimsRef[pageIndex] as any).__getValue
              ? (pageScaleAnimsRef[pageIndex] as any).__getValue()
              : 1;
            if (typeof v === 'number') finalScale = v;
          } catch (e) {
            finalScale = 1;
          }

          lastScalePerPageRef[pageIndex] = finalScale;

          // if zoomed back to ~1, reset transform for that page
          if (finalScale <= 1.01) {
            lastScalePerPageRef[pageIndex] = 1;
            pageScaleAnimsRef[pageIndex].setValue(1);
            pageTranslateXRef[pageIndex].setValue(0);
            pageTranslateYRef[pageIndex].setValue(0);
          }

          pinchStateRef.current = null;
        }

        // finish pan
        activePanPageRef.current = null;
      },

      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        pinchStateRef.current = null;
        activePanPageRef.current = null;
      },
    })
  ).current;

  const ZOOM_STEP = 0.25;

  // Helper for zoom buttons: apply target scale to current page
  const applyZoomForPage = (pageIndex: number, requestedScale: number) => {
    let newScale = requestedScale;
    if (newScale < MIN_ZOOM) newScale = MIN_ZOOM;
    if (newScale > MAX_ZOOM) newScale = MAX_ZOOM;

    lastScalePerPageRef[pageIndex] = newScale;

    if (newScale <= 1.01) {
      lastScalePerPageRef[pageIndex] = 1;
      pageScaleAnimsRef[pageIndex].setValue(1);
      pageTranslateXRef[pageIndex].setValue(0);
      pageTranslateYRef[pageIndex].setValue(0);
    } else {
      pageScaleAnimsRef[pageIndex].setValue(newScale);
    }
  };

  const handleZoomInPress = () => {
    if (saveStatus === 'saving') return;
    const pageIndex = getCurrentPageIndex();
    const current = lastScalePerPageRef[pageIndex] ?? 1;
    applyZoomForPage(pageIndex, current + ZOOM_STEP);
  };

  const handleZoomOutPress = () => {
    if (saveStatus === 'saving') return;
    const pageIndex = getCurrentPageIndex();
    const current = lastScalePerPageRef[pageIndex] ?? 1;
    applyZoomForPage(pageIndex, current - ZOOM_STEP);
  };

  const APP_FILES_DIR = '/data/data/com.doctor/files';

  // ✅ Helper to make per-patient + per-form file paths
  const makePageFilePath = (pageIndex: number) => {
    const safeKey = (STORAGE_KEY || DEFAULT_STORAGE_KEY).replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );
    const filename = `drawing_${safeKey}_page_${pageIndex + 1}.png`;
    return `${APP_FILES_DIR}/${filename}`;
  };

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

      const path = makePageFilePath(i);

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

    // Brush UI settings (no overlays here)
    const uiPayload = {
      color,
      penWidth,
      eraserWidth,
    };

    // ✅ FULL persisted blob: drawings + overlays
    const fullSaveBlob = {
      bitmaps: allMeta,
      voiceNotes,
      imageStickers,
    };

    try {
      if (AsyncStorage) {
        // UI stuff
        await AsyncStorage.setItem(
          STORAGE_UI_KEY,
          JSON.stringify(uiPayload)
        );

        // Main content: pen drawings + voice text + stickers
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(fullSaveBlob)
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
        // 🔥 Also send overlays as top-level fields for FormImageScreen
        voiceNotes,
        imageStickers,
      };
      lastPayloadRef.current = payload;

      setSaveStatus('success');
    } catch (err) {
      console.warn('[onSaveAll] Error saving', err);
      setSaveStatus('error');
    }
  };

  // ✅ IMPORTANT: update existing FormImageScreen instead of pushing new one
  const handleSaveOk = () => {
    const payload =
      lastPayloadRef.current || {
        savedStrokes: savedMeta,
        editorUI: {
          color,
          penWidth,
          eraserWidth,
        },
        editorSavedAt: Date.now(),
        storageKey: STORAGE_KEY,
        formName: route.params?.formName,
        voiceNotes,
        imageStickers,
      };

    setSaveStatus('idle');

    // Always go back directly to FormImageScreen
    navigation.navigate('FormImageScreen', payload);
  };

  const handleSaveErrorOk = () => {
    setSaveStatus('idle');
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* TOP ROW: Back + DONE */}
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          disabled={saveStatus === 'saving'}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* DONE button on right */}
        <TouchableOpacity
          onPress={onSaveAll}
          style={styles.doneButton}
          disabled={saveStatus === 'saving'}
        >
          <Text style={styles.doneButtonText}>DONE</Text>
        </TouchableOpacity>
      </View>

      {/* SECOND ROW: Tools (scrollable horizontally) */}
      <View style={styles.topBarTools}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topBarToolsScroll}
        >
          {/* Writing ON/OFF toggle */}
          <TouchableOpacity
            onPress={() => setWritingEnabled((prev) => !prev)}
            style={[
              styles.iconBtn,
              !writingEnabled && styles.writeToggleActive,
            ]}
            disabled={saveStatus === 'saving'}
          >
            <FontAwesome
              name="pencil-square-o"
              size={20}
              // When writing is OFF, highlight this icon strongly
              color={writingEnabled ? 'rgba(255,255,255,0.6)' : '#ffffff'}
            />
          </TouchableOpacity>

          {/* ➕ Add Image Sticker icon (just after writing icon) */}
          <TouchableOpacity
            onPress={handleAddStickerIconPress}
            style={styles.iconBtn}
            disabled={saveStatus === 'saving'}
          >
            <Ionicons name="image" size={20} color="#ffffff" />
          </TouchableOpacity>

          {/* ➕ Add Text icon (typed text) */}
          <TouchableOpacity
            onPress={handleAddTextIconPress}
            style={styles.iconBtn}
            disabled={saveStatus === 'saving'}
          >
            <MaterialCommunityIcons
              name="format-text"
              size={20}
              color="#ffffff"
            />
          </TouchableOpacity>

          <View style={{ width: 8 }} />

          {/* Undo / Redo / Clear group */}
          <View
            style={[
              styles.historyGroup,
              !writingEnabled && styles.toolsDisabled,
            ]}
          >
            <TouchableOpacity
              onPress={performUndo}
              style={styles.iconBtn}
              disabled={saveStatus === 'saving' || !writingEnabled}
            >
              <Ionicons name="arrow-undo" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={performRedo}
              style={styles.iconBtn}
              disabled={saveStatus === 'saving' || !writingEnabled}
            >
              <Ionicons name="arrow-redo" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={performClear}
              style={styles.iconBtn}
              disabled={saveStatus === 'saving' || !writingEnabled}
            >
              <MaterialCommunityIcons
                name="broom"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {/* Pen / Eraser grouped nicely */}
          <View
            style={[
              styles.toolGroupRow,
              !writingEnabled && styles.toolsDisabled,
            ]}
          >
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
                disabled={saveStatus === 'saving' || !writingEnabled}
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
                disabled={saveStatus === 'saving' || !writingEnabled}
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
                disabled={saveStatus === 'saving' || !writingEnabled}
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
                disabled={saveStatus === 'saving' || !writingEnabled}
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

          {/* Color picker circle */}
          <TouchableOpacity
            onPress={() => setColorPanelOpen((v) => !v)}
            style={[
              styles.iconBtn,
              { marginLeft: 4 },
              !writingEnabled && styles.toolsDisabled,
            ]}
            disabled={saveStatus === 'saving' || !writingEnabled}
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
        </ScrollView>
      </View>

      {/* Wrapper that handles pinch zoom / pan */}
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
          // when writing is OFF, enable normal vertical scroll
          scrollEnabled={!writingEnabled ? true : scrollEnabled}
        >
          {IMAGES.map((src, pageIndex) => {
            const savedPath = savedMeta[pageIndex]?.bitmapPath ?? null;
            const notesForPage = voiceNotes.filter(
              (n) => n.pageIndex === pageIndex
            );
            const stickersForPage = imageStickers.filter(
              (s) => s.pageIndex === pageIndex
            );
            return (
              <View key={`page-${pageIndex}`} style={styles.pageWrap}>
                <View style={styles.pageInner}>
                  {/* ZOOMED GROUP: image + drawing + text + stickers together */}
                  <Animated.View
                    style={[
                      styles.zoomGroup,
                      {
                        transform: [
                          { translateX: pageTranslateXRef[pageIndex] },
                          { translateY: pageTranslateYRef[pageIndex] },
                          { scale: pageScaleAnimsRef[pageIndex] },
                        ],
                      },
                    ]}
                  >
                    {/* Image fills entire area */}
                    <Image
                      source={src}
                      style={styles.pageImage}
                      resizeMode="stretch"
                    />

                    <View
                      style={styles.canvasContainer}
                      pointerEvents={
                        editingNoteId || editingStickerId || !writingEnabled
                          ? 'none'
                          : 'box-none'
                      }
                    >
                      <DrawingCanvas
                        index={pageIndex}
                        savedPath={savedPath}
                        ref={(r) => refSetters.current[pageIndex](r)}
                      />
                    </View>

                    {/* Voice / typed notes (draggable + double-tap edit + corner resize) */}
                    {notesForPage.map((note) => (
                      <DraggableVoiceText
                        key={note.id}
                        note={note}
                        isEditing={editingNoteId === note.id}
                        onToggleEdit={(id) => {
                          setEditingNoteId((prev) =>
                            prev === id ? null : id
                          );
                          setEditingStickerId(null);
                        }}
                        onPositionChange={handleVoiceNotePositionChange}
                        onScaleChange={handleVoiceNoteScaleChange}
                        onDelete={handleVoiceNoteDelete}
                      />
                    ))}

                    {/* Image stickers (drag + double-tap edit + resize) */}
                    {stickersForPage.map((sticker) => (
                      <DraggableImageSticker
                        key={sticker.id}
                        sticker={sticker}
                        imageSource={STICKER_IMAGE_SOURCE}
                        isEditing={editingStickerId === sticker.id}
                        onToggleEdit={(id) => {
                          setEditingStickerId((prev) =>
                            prev === id ? null : id
                          );
                          setEditingNoteId(null);
                        }}
                        onPositionChange={handleStickerPositionChange}
                        onScaleChange={handleStickerScaleChange}
                        onDelete={handleStickerDelete}
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

      {/* 🔍 Zoom +/- buttons just above mic (never faded) */}
      <View
        style={[
          styles.zoomFabContainer,
          { bottom: (insets.bottom ?? 0) + 24 + 72 },
        ]}
      >
        <TouchableOpacity
          style={styles.zoomFabButton}
          activeOpacity={0.8}
          onPress={handleZoomInPress}
          disabled={saveStatus === 'saving'}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.zoomFabButton, { marginTop: 8 }]}
          activeOpacity={0.8}
          onPress={handleZoomOutPress}
          disabled={saveStatus === 'saving'}
        >
          <Ionicons name="remove" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 🔊 floating mic FAB (no fade; click shows hint when editing off) */}
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

      {/* "Editing mode Off" bubble above mic when tapped while writing OFF */}
      {editingOffHintVisible && (
        <View
          style={[
            styles.writingOffBanner,
            { bottom: (insets.bottom ?? 0) + 24 + 56 + 8 },
          ]}
        >
          <Text style={styles.writingOffText}>Editing mode Off</Text>
        </View>
      )}

      <Modal
        visible={stickerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStickerModalVisible(false)}
      >
        <View style={styles.stickerModalBackdrop}>
          <View style={styles.stickerModalContent}>
            <Text style={styles.stickerModalTitle}>Add image sticker</Text>
            <Image
              source={STICKER_IMAGE_SOURCE}
              style={styles.stickerModalImage}
              resizeMode="contain"
            />
            <View style={styles.stickerModalButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.stickerModalButton,
                  { backgroundColor: '#e5e7eb' },
                ]}
                onPress={() => setStickerModalVisible(false)}
              >
                <Text
                  style={[
                    styles.stickerModalButtonText,
                    { color: '#111827' },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.stickerModalButton,
                  { backgroundColor: '#0EA5A4' },
                ]}
                onPress={() => {
                  setStickerModalVisible(false);
                  addImageSticker();
                }}
              >
                <Text
                  style={[
                    styles.stickerModalButtonText,
                    { color: '#ffffff' },
                  ]}
                >
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 📝 Typed Text Modal */}
      <Modal
        visible={textModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTextModalVisible(false)}
      >
        <View style={styles.stickerModalBackdrop}>
          <View style={styles.stickerModalContent}>
            <Text style={styles.stickerModalTitle}>Add text</Text>
            <TextInput
              style={styles.textModalInput}
              placeholder="Type text to add on image"
              placeholderTextColor="#9ca3af"
              multiline
              value={typedText}
              onChangeText={setTypedText}
            />
            <View style={styles.stickerModalButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.stickerModalButton,
                  { backgroundColor: '#e5e7eb' },
                ]}
                onPress={() => {
                  setTextModalVisible(false);
                  setTypedText('');
                }}
              >
                <Text
                  style={[
                    styles.stickerModalButtonText,
                    { color: '#111827' },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.stickerModalButton,
                  { backgroundColor: '#0EA5A4' },
                ]}
                onPress={handleTextModalAdd}
              >
                <Text
                  style={[
                    styles.stickerModalButtonText,
                    { color: '#ffffff' },
                  ]}
                >
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔽 Thickness dropdown panel (one tool at a time, HORIZONTAL slider) */}
      {thicknessPanelOpen && thicknessTool && writingEnabled && (
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
              disabled={saveStatus === 'saving' || !writingEnabled}
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
                disabled={saveStatus === 'saving' || !writingEnabled}
              >
                <View
                  style={[styles.gridSwatch, { backgroundColor: c }]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

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

  // TOP ROW (Back + DONE)
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#0EA5A4',
  },

  // SECOND ROW (tools)
  topBarTools: {
    backgroundColor: '#0EA5A4',
    paddingBottom: 6,
    paddingTop: 4,
  },
  topBarToolsScroll: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  iconBtn: { padding: 6, borderRadius: 18, marginLeft: 6 },

  doneButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#000000',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

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

  zoomFabContainer: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    zIndex: 71,
  },
  zoomFabButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0EA5A4',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

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

  // Sticker
  stickerWrapper: {
    position: 'absolute',
  },
  stickerHitBox: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  stickerImage: {
    width: 140,
    height: 90,
    borderRadius: 8,
  },

  // Sticker modal
  stickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerModalContent: {
    width: SCREEN_W * 0.8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  stickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  stickerModalImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginBottom: 18,
  },
  stickerModalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stickerModalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  stickerModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Typed text modal input
  textModalInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 16,
    color: '#111827',
    textAlignVertical: 'top',
    fontSize: 14,
  },

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

  // 🔆 Visual state styles
  toolsDisabled: {
    opacity: 0.35,
  },
  writeToggleActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  writingOffBanner: {
    position: 'absolute',
    right: 16,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 72,
  },
  writingOffText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '500',
  },
});
