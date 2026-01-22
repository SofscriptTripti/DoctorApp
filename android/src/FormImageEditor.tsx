import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useCallback,
} from 'react';
import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';
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
  LayoutRectangle,
  Alert,
  FlatList,
  Pressable,
} from 'react-native';
import Feather from "react-native-vector-icons/Feather";
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LayoutChangeEvent } from 'react-native';

import NativeDrawingView, { DrawingRef } from './components/NativeDrawingView';

// 🔊 VoiceKit
import { useVoice, VoiceMode } from 'react-native-voicekit';

// Import APIs - UPDATED
import {
  savePageOverlay
} from './api/patientDocumentsApi';

// Import getpagewiseoverlay API
import { getpagewiseoverlay } from './api/patientDocumentsApi';

// We TRY AsyncStorage, but we don't depend on it.
let AsyncStorage: any = null;
try {
  AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAGE_HEIGHT = Math.round(SCREEN_H * 0.83);
const PAGE_SPACING = 16;
const DEFAULT_STORAGE_KEY = 'DoctorApp:pagesBitmaps:v1';
const DEFAULT_UI_KEY = 'DoctorApp:editorUI:v1';

// 👉 Sticker images (local assets)
import PATIENT_STICKER_SOURCE from './Images/NameStick.jpg';
import DOCTOR_STICKER_SOURCE from './Images/Doctor_Sticker.jpg';

type SavedMeta = { bitmapPath?: string | null };

const STORAGE_KEYS = {
  patientId: 'patientId',
  admissionNo: 'admissionNo',
  documentId: 'documentId'
};

// Voice text note type
export type VoiceNote = {
  id: string;
  pageId?: string;
  pageIndex: number;
  text: string;
  color: string;
  x: number;
  y: number;
  boxWidth?: number;
  boxHeight?: number;
  fontSize?: number;
};

// Image sticker type
export type ImageSticker = {
  id: string;
  pageId?: string;
  pageIndex: number;
  x: number;
  y: number;
  scale: number;
  width?: number;
  height?: number;
  stickerType: 'patient' | 'doctor';
};

const tryParseStrokesJson = (base64?: string): string | null => {
  if (!base64) return null;
  try {
    // Attempt decoding
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    // Simple heuristic: if it starts with '[', assuming it's our JSON array
    if (decoded.trim().startsWith('[')) {
      return decoded;
    }
  } catch (e) {
    // If it fails, likely a binary PNG that doesn't decode to text nicely
  }
  return null;
};

// Page type matching FormImageScreen
type PageData = {
  pageId: string;
  displayOrderNo: number;
  imageData?: string;
  overlayData?: string; // Previous overlay from API
};

// --- stable memoized drawing canvas
type DrawingCanvasProps = {
  index: number;
  savedPath?: string | null;
  strokesJson?: string | null;
  drawingEnabled?: boolean;
};

// --- stable memoized drawing canvas
const DrawingCanvas = React.memo(
  forwardRef(function DrawingCanvasInternal(
    { index, savedPath, strokesJson, drawingEnabled = true }: DrawingCanvasProps,
    forwardedRef: React.Ref<DrawingRef | null>
  ) {
    return (
      <NativeDrawingView
        ref={forwardedRef}
        style={styles.canvasOverlay}
        savedPath={savedPath ?? undefined}
        strokesJson={strokesJson ?? undefined}
      />
    );
  }),
  (prev, next) =>
    prev.index === next.index &&
    prev.savedPath === next.savedPath &&
    prev.strokesJson === next.strokesJson &&
    prev.drawingEnabled === next.drawingEnabled
);

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

/**
 * 📝 Draggable + resizable voice/typed text WITH IMAGE BOUNDARIES
 */
function DraggableVoiceText({
  note,
  isEditing,
  onToggleEdit,
  onPositionChange,
  onBoxSizeChange,
  onDelete,
  onChangeText,
  onChangeFontSize,
  pageScale = 1,
  writingEnabled = true,
  onResizeStart,
  onResizeEnd,
}: {
  note: VoiceNote;
  isEditing: boolean;
  onToggleEdit: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  onBoxSizeChange: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
  onChangeText: (id: string, text: string) => void;
  onChangeFontSize: (id: string, fontSize: number) => void;
  pageScale?: number;
  writingEnabled?: boolean;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}) {
  const DEFAULT_WIDTH = 180;
  const DEFAULT_HEIGHT = 60;
  const DEFAULT_FONT_SIZE = 14;

  const IMAGE_WIDTH = SCREEN_W;
  const IMAGE_HEIGHT = PAGE_HEIGHT;

  const MIN_WIDTH = 40;
  const MIN_HEIGHT = 30;

  const MIN_FONT_SIZE = 10;
  const MAX_FONT_SIZE = 36;

  const PADDING_H = 12;
  const PADDING_V = 8;

  const currentPosRef = useRef<{ x: number; y: number }>(
    { x: note.x, y: note.y }
  );

  const pan = useRef(
    new Animated.ValueXY({ x: note.x, y: note.y })
  ).current;

  const widthAnim = useRef(
    new Animated.Value(note.boxWidth ?? DEFAULT_WIDTH)
  ).current;
  const heightAnim = useRef(
    new Animated.Value(note.boxHeight ?? DEFAULT_HEIGHT)
  ).current;

  const currentWidthRef = useRef(note.boxWidth ?? DEFAULT_WIDTH);
  const currentHeightRef = useRef(note.boxHeight ?? DEFAULT_HEIGHT);

  const isUserResizingRef = useRef(false);
  const [isTextInputFocused, setIsTextInputFocused] = useState(false);
  const [manualResizeFlag, setManualResizeFlag] = useState(0);

  // Hover states for resize handles
  const [hoveringRight, setHoveringRight] = useState(false);
  const [hoveringBottom, setHoveringBottom] = useState(false);

  const startPosRef = useRef({ x: note.x, y: note.y });
  const lastTapRef = useRef(0);

  const sizeStartRef = useRef<{ width: number; height: number; x: number; y: number }>(
    {
      width: currentWidthRef.current,
      height: currentHeightRef.current,
      x: note.x,
      y: note.y,
    }
  );


  const [currentFontSize, setCurrentFontSize] = useState(note.fontSize ?? DEFAULT_FONT_SIZE);
  const startFontSizeRef = useRef(currentFontSize);

  useEffect(() => {
    setCurrentFontSize(note.fontSize ?? DEFAULT_FONT_SIZE);
  }, [note.fontSize]);

  const measuredContentSizeRef = useRef<{ w: number; h: number } | null>(null);
  const [measuredFlag, setMeasuredFlag] = useState(0);
  const resizeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const textInputRef = useRef<TextInput>(null);
  const pageScaleRef = useRef(pageScale);

  const isResizingRef = useRef(false);

  const calculateDynamicMaximums = (x: number, y: number) => {
    const maxAvailableWidth = IMAGE_WIDTH - x - 10;
    const maxAvailableHeight = IMAGE_HEIGHT - y - 10;

    return {
      maxWidth: Math.max(MIN_WIDTH, Math.min(maxAvailableWidth, IMAGE_WIDTH * 0.8)),
      maxHeight: Math.max(MIN_HEIGHT, Math.min(maxAvailableHeight, IMAGE_HEIGHT * 0.8))
    };
  };

  useEffect(() => {
    pageScaleRef.current = pageScale || 1;
  }, [pageScale]);

  useEffect(() => {
    const w = note.boxWidth ?? DEFAULT_WIDTH;
    const h = note.boxHeight ?? DEFAULT_HEIGHT;
    currentWidthRef.current = w;
    currentHeightRef.current = h;
    widthAnim.setValue(w);
    heightAnim.setValue(h);
  }, [note.boxWidth, note.boxHeight, widthAnim, heightAnim]);

  useEffect(() => {
    pan.setValue({ x: note.x, y: note.y });
    currentPosRef.current = { x: note.x, y: note.y };
  }, [note.x, note.y, pan]);

  useEffect(() => {
    if (isEditing && isTextInputFocused && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  }, [isEditing, isTextInputFocused]);

  useEffect(() => {
    if (!isEditing) {
      isUserResizingRef.current = false;
      isResizingRef.current = false;
    }
  }, [isEditing]);

  useEffect(() => {
    // If content measurement changes AND user is NOT currently manually resizing,
    // we assume we should auto-fit the box to the content.
    // This supports "default border adopt same enter text height and width"
    // and allows expansion while typing.
    if (measuredContentSizeRef.current && !isUserResizingRef.current) {
      const c = measuredContentSizeRef.current;

      const { maxWidth, maxHeight } = calculateDynamicMaximums(note.x, note.y);

      // Only add buffer if we are in auto-fit mode (no manual width set).
      // If manual width is set, we want to respect it exactly without drift found in a loop.
      const buffer = note.boxWidth ? 0 : 16;
      const contentW = clamp(Math.round(c.w + PADDING_H * 2 + buffer), MIN_WIDTH, maxWidth);
      const contentH = clamp(Math.round(c.h + PADDING_V * 2 + buffer), MIN_HEIGHT, maxHeight);

      // Current manual size (fallback to MIN if undefined to allow shrink-to-fit)
      const manualW = note.boxWidth ?? MIN_WIDTH;
      const manualH = note.boxHeight ?? MIN_HEIGHT;

      // We want the box to be AT LEAST the size of the content, but we ALSO want to respect
      // any larger manual resizing the user has done.
      // So we take the MAX of manual size and content size.
      // And finally clamp to screen limits.
      const autoW = clamp(Math.max(manualW, contentW), MIN_WIDTH, maxWidth);
      const autoH = clamp(Math.max(manualH, contentH), MIN_HEIGHT, maxHeight);

      // Only update if dimensions differ significantly to avoid loops
      if (Math.abs(currentWidthRef.current - autoW) > 2 || Math.abs(currentHeightRef.current - autoH) > 2) {
        currentWidthRef.current = autoW;
        currentHeightRef.current = autoH;
        widthAnim.setValue(autoW);
        heightAnim.setValue(autoH);
        onBoxSizeChange(note.id, autoW, autoH);
      }
    }
  }, [measuredFlag, note.id, onBoxSizeChange, measuredContentSizeRef]);

  const handleContentLayout = (layout: LayoutRectangle) => {
    measuredContentSizeRef.current = {
      w: layout.width,
      h: layout.height
    };
    setMeasuredFlag((v) => v + 1);
  };

  const handleTextAreaPress = () => {
    if (!writingEnabled) return;
    if (!isEditing) {
      onToggleEdit(note.id);
    }
  };

  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt: GestureResponderEvent) => {
        if (!writingEnabled) return false;
        const touches = (evt.nativeEvent && (evt.nativeEvent as any).touches) || [];
        if (touches.length !== 1) return false;
        if (isResizingRef.current) return false;
        return true;
      },

      onMoveShouldSetPanResponder: (evt: GestureResponderEvent) => {
        if (!writingEnabled) return false;
        const touches = (evt.nativeEvent && (evt.nativeEvent as any).touches) || [];
        if (touches.length !== 1) return false;
        if (isResizingRef.current) return false;
        return true;
      },

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        if (!writingEnabled) return;
        const touches = (evt.nativeEvent && (evt.nativeEvent as any).touches) || [];
        if (touches.length !== 1) return;

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
        evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        if (!writingEnabled) return;
        const touches = (evt.nativeEvent && (evt.nativeEvent as any).touches) || [];
        if (touches.length !== 1) return;

        const scale = pageScaleRef.current || 1;

        let nx = startPosRef.current.x + gestureState.dx / scale;
        let ny = startPosRef.current.y + gestureState.dy / scale;

        const maxX = IMAGE_WIDTH - currentWidthRef.current - 5;
        const maxY = IMAGE_HEIGHT - currentHeightRef.current - 5;

        nx = clamp(nx, 5, maxX);
        ny = clamp(ny, 5, maxY);

        pan.setValue({ x: nx, y: ny });
        currentPosRef.current = { x: nx, y: ny };
      },

      onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (!writingEnabled) return;
        const touches = (evt.nativeEvent && (evt.nativeEvent as any).touches) || [];
        if (touches.length > 1) {
          return;
        }

        const dx = gestureState.dx;
        const dy = gestureState.dy;
        const moveDist = Math.sqrt(dx * dx + dy * dy);

        const now = Date.now();
        const delta = now - lastTapRef.current;
        lastTapRef.current = now;

        const isTap = moveDist < 5 &&
          Math.abs(gestureState.vx) < 0.3 &&
          Math.abs(gestureState.vy) < 0.3;

        const { x: finalX, y: finalY } = currentPosRef.current;

        if (isTap && delta < 280) {
          onPositionChange(note.id, finalX, finalY);
          onToggleEdit(note.id);
          return;
        }

        onPositionChange(note.id, finalX, finalY);
      },

      onPanResponderTerminate: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (!writingEnabled) return;
        const touches = (evt.nativeEvent && (evt.nativeEvent as any).touches) || [];
        if (touches.length !== 1) {
        }

        const scale = pageScaleRef.current || 1;
        let nx = startPosRef.current.x + gestureState.dx / scale;
        let ny = startPosRef.current.y + gestureState.dy / scale;

        const maxX = IMAGE_WIDTH - currentWidthRef.current - 5;
        const maxY = IMAGE_HEIGHT - currentHeightRef.current - 5;

        nx = clamp(nx, 5, maxX);
        ny = clamp(ny, 5, maxY);

        pan.setValue({ x: nx, y: ny });
        currentPosRef.current = { x: nx, y: ny };
        onPositionChange(note.id, nx, ny);
      },
    })
  ).current;

  const createResizePan = (opts: {
    signX: -1 | 0 | 1;
    signY: -1 | 0 | 1;
  }) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        if (!writingEnabled) return false;
        // Check if we hit the handle directly
        return true;
      },
      onMoveShouldSetPanResponder: (evt) => {
        if (!writingEnabled) return false;
        return true;
      },
      onStartShouldSetPanResponderCapture: (evt) => {
        if (!writingEnabled) return false;
        isResizingRef.current = true;
        // Return true to CAPTURE the touch and prevent parent (drawing) from getting it
        return true;
      },
      onMoveShouldSetPanResponderCapture: (evt) => {
        if (!writingEnabled) return false;
        isResizingRef.current = true;
        return true;
      },

      onPanResponderGrant: () => {
        if (!writingEnabled) return;
        isUserResizingRef.current = true;
        isResizingRef.current = true;
        if (onResizeStart) onResizeStart();
        startFontSizeRef.current = currentFontSize;
        sizeStartRef.current = {
          width: currentWidthRef.current,
          height: currentHeightRef.current,
          x: currentPosRef.current.x,
          y: currentPosRef.current.y,
        };
      },

      onPanResponderMove: (_evt: GestureResponderEvent, gs) => {
        if (!writingEnabled) return;

        let newWidth = sizeStartRef.current.width;
        let newHeight = sizeStartRef.current.height;
        let newX = currentPosRef.current.x;
        let newY = currentPosRef.current.y;

        const scale = pageScaleRef.current || 1;

        const { maxWidth, maxHeight } = calculateDynamicMaximums(currentPosRef.current.x, currentPosRef.current.y);

        if (opts.signX !== 0) {
          const deltaX = (gs.dx / scale) * opts.signX;
          newWidth = clamp(
            Math.round(sizeStartRef.current.width + deltaX),
            MIN_WIDTH,
            maxWidth
          );

          // If resizing from left, we need to adjust X to keep right side stationary
          if (opts.signX === -1) {
            const widthDifference = newWidth - sizeStartRef.current.width;
            newX = sizeStartRef.current.x - widthDifference;
          }

          widthAnim.setValue(newWidth);
          // currentWidthRef will be updated by listener, but we can set it for consistency if needed.
          // However, listener is source of truth.
        }

        if (opts.signY !== 0) {
          const deltaY = (gs.dy / scale) * opts.signY;
          newHeight = clamp(
            Math.round(sizeStartRef.current.height + deltaY),
            MIN_HEIGHT,
            maxHeight
          );

          // If resizing from top, we need to adjust Y to keep bottom side stationary
          if (opts.signY === -1) {
            const heightDifference = newHeight - sizeStartRef.current.height;
            newY = sizeStartRef.current.y - heightDifference;
          }

          heightAnim.setValue(newHeight);
        }

        // Also update position if changed
        if (newX !== currentPosRef.current.x || newY !== currentPosRef.current.y) {
          pan.setValue({ x: newX, y: newY });
        }

        // 🔹 Auto-scale Font if dragging CORNER (both X and Y change)
        if (opts.signX !== 0 && opts.signY !== 0) {
          const heightRatio = newHeight / sizeStartRef.current.height;
          const newFS = Math.max(MIN_FONT_SIZE, Math.round(startFontSizeRef.current * heightRatio));
          if (newFS !== currentFontSize) {
            setCurrentFontSize(newFS);
          }
        }

        // Remove manual overwrites of currentRefs here. Let listeners or specific setters handle it.
        // currentWidthRef.current = newWidth; 
        // currentHeightRef.current = newHeight;
      },

      onPanResponderRelease: () => {
        if (!writingEnabled) return;

        // Finalize values
        const finalWidth = currentWidthRef.current;
        const finalHeight = currentHeightRef.current;

        // Use the animated value for X/Y which tracks the visual position
        // currentPosRef was NOT updated in move for optimization in my proposed change above,
        // but pan.setValue was called. We should read from pan or track it.
        // Actually, let's track newX/newY in a ref or just recalculate.
        // Better to be consistent.

        // Let's recalculate final X/Y based on the final Width/Height change if necessary.
        // Or simply enable onPositionChange call.

        // Retrieve final X/Y from pan listener or calculate? 
        // pan is Animated.ValueXY.
        // Accessing value synchronously is tricky without a listener.
        // Re-calculate:
        let finalX = currentPosRef.current.x;
        let finalY = currentPosRef.current.y;

        if (opts.signX === -1) {
          const widthDifference = finalWidth - sizeStartRef.current.width;
          finalX = sizeStartRef.current.x - widthDifference;
        }
        if (opts.signY === -1) {
          const heightDifference = finalHeight - sizeStartRef.current.height;
          finalY = sizeStartRef.current.y - heightDifference;
        }

        onBoxSizeChange(
          note.id,
          finalWidth,
          finalHeight
        );
        onPositionChange(note.id, finalX, finalY);

        if (opts.signX !== 0 && opts.signY !== 0) {
          onChangeFontSize(note.id, currentFontSize);
        }

        setManualResizeFlag(v => v + 1);
        isResizingRef.current = false;
        if (onResizeEnd) onResizeEnd();

        // Update currentRefs for next interaction
        currentPosRef.current = { x: finalX, y: finalY };
      },

      onPanResponderTerminate: () => {
        if (!writingEnabled) return;

        // Revert or commit? Usually commit what we have.
        const finalWidth = currentWidthRef.current;
        const finalHeight = currentHeightRef.current;

        let finalX = currentPosRef.current.x;
        let finalY = currentPosRef.current.y;

        if (opts.signX === -1) {
          const widthDifference = finalWidth - sizeStartRef.current.width;
          finalX = sizeStartRef.current.x - widthDifference;
        }
        if (opts.signY === -1) {
          const heightDifference = finalHeight - sizeStartRef.current.height;
          finalY = sizeStartRef.current.y - heightDifference;
        }

        onBoxSizeChange(
          note.id,
          finalWidth,
          finalHeight
        );
        onPositionChange(note.id, finalX, finalY);

        setManualResizeFlag(v => v + 1);
        isResizingRef.current = false;
        if (onResizeEnd) onResizeEnd();
        currentPosRef.current = { x: finalX, y: finalY };
      },
    });
  };

  const tlResizePan = useRef(
    createResizePan({ signX: -1, signY: -1 })
  ).current;
  const trResizePan = useRef(
    createResizePan({ signX: 1, signY: -1 })
  ).current;
  const blResizePan = useRef(
    createResizePan({ signX: -1, signY: 1 })
  ).current;
  const brResizePan = useRef(
    createResizePan({ signX: 1, signY: 1 })
  ).current;

  const mlResizePan = useRef(
    createResizePan({ signX: -1, signY: 0 })
  ).current;
  const mrResizePan = useRef(
    createResizePan({ signX: 1, signY: 0 })
  ).current;
  const mtResizePan = useRef(
    createResizePan({ signX: 0, signY: -1 })
  ).current;
  const mbResizePan = useRef(
    createResizePan({ signX: 0, signY: 1 })
  ).current;

  useEffect(() => {
    const widthListener = widthAnim.addListener(({ value }) => {
      currentWidthRef.current = value;
    });

    const heightListener = heightAnim.addListener(({ value }) => {
      currentHeightRef.current = value;
    });

    return () => {
      widthAnim.removeListener(widthListener);
      heightAnim.removeListener(heightListener);
    };
  }, [widthAnim, heightAnim]);

  const autoResizeForFontSize = (newFontSize: number) => {
    if (!writingEnabled || !measuredContentSizeRef.current) return;

    const measured = measuredContentSizeRef.current;
    if (!measured) return;

    const { maxWidth, maxHeight } = calculateDynamicMaximums(note.x, note.y);

    const oldFontSize = note.fontSize || DEFAULT_FONT_SIZE;
    const sizeRatio = newFontSize / oldFontSize;

    const buffer = 16;
    const neededWidth = Math.round((measured.w * sizeRatio) + PADDING_H * 2 + buffer);
    const neededHeight = Math.round((measured.h * sizeRatio) + PADDING_V * 2 + buffer);

    const newWidth = clamp(neededWidth, MIN_WIDTH, maxWidth);
    const newHeight = clamp(neededHeight, MIN_HEIGHT, maxHeight);

    widthAnim.setValue(newWidth);
    heightAnim.setValue(newHeight);
    currentWidthRef.current = newWidth;
    currentHeightRef.current = newHeight;

    onBoxSizeChange(note.id, newWidth, newHeight);
  };

  const increaseFontSize = () => {
    if (!writingEnabled) return;
    const newSize = clamp(currentFontSize + 2, MIN_FONT_SIZE, MAX_FONT_SIZE);
    onChangeFontSize(note.id, newSize);
    // Let useEffect handle resizing based on new measurement
  };

  const decreaseFontSize = () => {
    if (!writingEnabled) return;
    const newSize = clamp(currentFontSize - 2, MIN_FONT_SIZE, MAX_FONT_SIZE);
    onChangeFontSize(note.id, newSize);
    // Let useEffect handle resizing based on new measurement
  };

  const handleTextInputFocus = () => {
    setIsTextInputFocused(true);
  };

  const handleTextInputBlur = () => {
    setIsTextInputFocused(false);
  };

  const handleTextChange = (text: string) => {
    onChangeText(note.id, text);
  };



  const handleContentSizeChange = (e: any) => {
    const { width, height } = e.nativeEvent.contentSize;
    const measuredH = Math.ceil(height + PADDING_V * 2);

    // If content + padding exceeds current height, expand
    if (measuredH > currentHeightRef.current) {
      const { maxHeight } = calculateDynamicMaximums(note.x, note.y);
      const newHeight = clamp(measuredH, MIN_HEIGHT, maxHeight);

      if (newHeight > currentHeightRef.current) {
        heightAnim.setValue(newHeight);
        currentHeightRef.current = newHeight;
        onBoxSizeChange(note.id, currentWidthRef.current, newHeight);
      }
    }
  };

  const handleManualResize = () => {
    if (!writingEnabled) return;

    const measured = measuredContentSizeRef.current;
    if (!measured) return;

    const { maxWidth, maxHeight } = calculateDynamicMaximums(note.x, note.y);

    const buffer = 16;
    const neededWidth = Math.round(measured.w + PADDING_H * 2 + buffer);
    const neededHeight = Math.round(measured.h + PADDING_V * 2 + buffer);

    const newWidth = clamp(neededWidth, MIN_WIDTH, maxWidth);
    const newHeight = clamp(neededHeight, MIN_HEIGHT, maxHeight);

    widthAnim.setValue(newWidth);
    heightAnim.setValue(newHeight);
    currentWidthRef.current = newWidth;
    currentHeightRef.current = newHeight;

    onBoxSizeChange(note.id, newWidth, newHeight);
  };

  useEffect(() => {
    return () => {
      if (resizeDebounceRef.current) {
        clearTimeout(resizeDebounceRef.current);
      }
    };
  }, []);

  return (
    <Animated.View
      style={[
        styles.voiceTextDragWrapper,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
          overflow: 'visible',
          zIndex: 1000,
        },
      ]}
    >
      {isEditing && writingEnabled && (
        <>
          <View style={styles.fontSizeControls}>
            <TouchableOpacity
              style={[styles.fontSizeButton, { borderColor: note.color }]}
              onPress={decreaseFontSize}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              disabled={!writingEnabled}
            >
              <Ionicons name="remove" size={18} color={note.color} />
            </TouchableOpacity>
            <Text style={[styles.fontSizeText, { color: note.color }]}>
              {currentFontSize}px
            </Text>
            <TouchableOpacity
              style={[styles.fontSizeButton, { borderColor: note.color }]}
              onPress={increaseFontSize}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              disabled={!writingEnabled}
            >
              <Ionicons name="add" size={18} color={note.color} />
            </TouchableOpacity>
          </View>

          {/* Floating Close Button at Top-Right Corner */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: -12,
              right: -12,
              backgroundColor: '#fff',
              borderRadius: 12,
              width: 24,
              height: 24,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: note.color,
              zIndex: 102,
              elevation: 5
            }}
            onPress={() => onDelete(note.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={!writingEnabled}
          >
            <Ionicons name="close" size={16} color={note.color} />
          </TouchableOpacity>
        </>
      )}

      <Animated.View
        {...dragPan.panHandlers}
        style={[
          styles.voiceTextHitBox,
          {
            width: widthAnim,
            height: heightAnim,
            paddingHorizontal: PADDING_H,
            paddingVertical: PADDING_V,
          },
          isEditing && writingEnabled && {
            borderColor: note.color,
            borderWidth: 3,
          },
        ]}
      >
        {/* Helper: Invisible Thick Border for easier grabbing/safety */}
        {isEditing && writingEnabled && (
          <View
            style={{
              position: 'absolute',
              top: -12,
              left: -12,
              right: -12,
              bottom: -12,
              borderWidth: 12,
              borderColor: 'transparent',
              zIndex: 0,
            }}
          />
        )}
        {isEditing ? (
          <TextInput
            ref={textInputRef}
            style={[
              styles.voiceTextInput,
              {
                color: note.color,
                width: '100%',
                height: '100%',
                textAlignVertical: 'top',
                fontSize: currentFontSize,
                flex: 1,
                padding: 0,
                margin: 0,
                textAlign: 'left',
                includeFontPadding: false,
                overflow: 'visible',
              },
            ]}
            multiline={true}
            value={note.text}
            onChangeText={handleTextChange}
            onContentSizeChange={handleContentSizeChange}
            onFocus={handleTextInputFocus}
            onBlur={handleTextInputBlur}
            textBreakStrategy="highQuality"
            underlineColorAndroid="transparent"
            placeholder=""
            allowFontScaling={false}
            scrollEnabled={true}
            autoFocus={false}
            onTouchStart={(e) => e.stopPropagation()}
            editable={writingEnabled}
            textAlign="left"
            textAlignVertical="top"
            autoCorrect={true}
            spellCheck={true}
          />
        ) : (
          <TouchableOpacity
            onPress={handleTextAreaPress}
            style={styles.textTouchArea}
            activeOpacity={0.7}
            disabled={!writingEnabled}
          >
            <Text
              style={[
                styles.voiceTextDrag,
                {
                  color: note.color,
                  fontSize: currentFontSize,
                  flexWrap: 'wrap',
                  width: '100%',
                }
              ]}
              numberOfLines={0}
            >
              {note.text}
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      <>
        {isEditing && writingEnabled && (
          <>
            {/* Top Center Dot */}
            <Animated.View
              style={{
                position: 'absolute',
                top: -9,
                left: '50%',
                marginLeft: -9,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: note.color,
                zIndex: 110,
              }}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              {...mtResizePan.panHandlers}
            />

            {/* Bottom Center Dot */}
            <Animated.View
              style={{
                position: 'absolute',
                bottom: -9,
                left: '50%',
                marginLeft: -9,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: note.color,
                zIndex: 110,
              }}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              {...mbResizePan.panHandlers}
            />

            {/* Left Center Dot */}
            <Animated.View
              style={{
                position: 'absolute',
                top: '50%',
                left: -9,
                marginTop: -9,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: note.color,
                zIndex: 110,
              }}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              {...mlResizePan.panHandlers}
            />

            {/* Right Center Dot */}
            <Animated.View
              style={{
                position: 'absolute',
                top: '50%',
                right: -9,
                marginTop: -9,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: note.color,
                zIndex: 110,
              }}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              {...mrResizePan.panHandlers}
            />
          </>
        )}


      </>

      <View
        style={styles.measureContainer}
        pointerEvents="none"
      >
        <Text
          style={[
            styles.voiceTextDrag,
            {
              position: 'absolute',
              opacity: 0,
              left: -10000,
              width: note.boxWidth ? (note.boxWidth - PADDING_H * 2) : undefined,
              maxWidth: note.boxWidth ? undefined : Math.min(SCREEN_W - 40, 1000),
              includeFontPadding: false,
              fontSize: currentFontSize,
              textAlign: 'left',
              flexWrap: 'wrap',
            },
          ]}
          onLayout={(e) => {
            handleContentLayout(e.nativeEvent.layout);
          }}
        >
          {note.text || ''}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * 🧩 Draggable + resizable image sticker
 */
function DraggableImageSticker({
  sticker,
  isEditing,
  onToggleEdit,
  onPositionChange,
  onSizeChange,
  onDelete,
  pageScale = 1,
  writingEnabled = true,
}: {
  sticker: ImageSticker;
  isEditing: boolean;
  onToggleEdit: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  onSizeChange: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
  pageScale?: number;
  writingEnabled?: boolean;
}) {
  const DEFAULT_WIDTH = 140;
  const DEFAULT_HEIGHT = 90;
  const RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT;
  const MIN_WIDTH = 40;

  const IMAGE_WIDTH = SCREEN_W;
  const IMAGE_HEIGHT = PAGE_HEIGHT;

  // Calculate initial dimensions based on props
  const initWidth = sticker.width ?? (DEFAULT_WIDTH * (sticker.scale ?? 1));
  const initHeight = sticker.height ?? (DEFAULT_HEIGHT * (sticker.scale ?? 1));

  const currentPosRef = useRef<{ x: number; y: number }>(
    {
      x: sticker.x,
      y: sticker.y,
    }
  );

  const pan = useRef(
    new Animated.ValueXY({ x: sticker.x, y: sticker.y })
  ).current;

  // We animate width/height directly instead of scale
  const widthAnim = useRef(new Animated.Value(initWidth)).current;
  const heightAnim = useRef(new Animated.Value(initHeight)).current;

  const currentSizeRef = useRef<{ width: number; height: number }>(
    {
      width: initWidth,
      height: initHeight,
    }
  );

  const startPosRef = useRef({ x: sticker.x, y: sticker.y });
  const startSizeRef = useRef({ width: initWidth, height: initHeight, x: sticker.x, y: sticker.y });
  const lastTapRef = useRef(0);

  const isResizingRef = useRef(false);

  const pageScaleRef = useRef(pageScale);
  useEffect(() => {
    pageScaleRef.current = pageScale || 1;
  }, [pageScale]);

  useEffect(() => {
    // Sync external prop changes
    if (Math.abs(currentPosRef.current.x - sticker.x) > 0.1 || Math.abs(currentPosRef.current.y - sticker.y) > 0.1) {
      pan.setValue({ x: sticker.x, y: sticker.y });
      currentPosRef.current = { x: sticker.x, y: sticker.y };
    }

    const targetW = sticker.width ?? (DEFAULT_WIDTH * (sticker.scale ?? 1));
    const targetH = sticker.height ?? (DEFAULT_HEIGHT * (sticker.scale ?? 1));

    if (Math.abs(currentSizeRef.current.width - targetW) > 0.1) {
      widthAnim.setValue(targetW);
      heightAnim.setValue(targetH);
      currentSizeRef.current = { width: targetW, height: targetH };
    }
  }, [sticker.x, sticker.y, sticker.scale, sticker.width, sticker.height, pan, widthAnim, heightAnim]);

  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => writingEnabled && !isResizingRef.current,
      onMoveShouldSetPanResponder: () => writingEnabled && !isResizingRef.current,

      onPanResponderGrant: () => {
        if (!writingEnabled) return;
        try {
          const v = (pan as any).__getValue?.();
          if (v) startPosRef.current = { x: v.x, y: v.y };
        } catch (e) {
          startPosRef.current = { ...currentPosRef.current };
        }
      },

      onPanResponderMove: (_evt, gestureState) => {
        if (!writingEnabled) return;
        const scale = pageScaleRef.current || 1;
        let nx = startPosRef.current.x + gestureState.dx / scale;
        let ny = startPosRef.current.y + gestureState.dy / scale;

        const maxX = IMAGE_WIDTH - currentSizeRef.current.width - 5;
        const maxY = IMAGE_HEIGHT - currentSizeRef.current.height - 5;

        nx = clamp(nx, 5, maxX);
        ny = clamp(ny, 5, maxY);

        pan.setValue({ x: nx, y: ny });
        currentPosRef.current = { x: nx, y: ny };
      },

      onPanResponderRelease: (_evt, gestureState) => {
        if (!writingEnabled) return;

        const moveDist = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
        const isTap = moveDist < 5 && Math.abs(gestureState.vx) < 0.3 && Math.abs(gestureState.vy) < 0.3;

        const { x: finalX, y: finalY } = currentPosRef.current;
        onPositionChange(sticker.id, finalX, finalY);

        const now = Date.now();
        if (isTap && (now - lastTapRef.current) < 280) {
          onToggleEdit(sticker.id);
        }
        lastTapRef.current = now;
      },
      onPanResponderTerminate: () => {
        const { x, y } = currentPosRef.current;
        onPositionChange(sticker.id, x, y);
      },
    })
  ).current;

  // Resizing logic with Aspect Ratio Lock + Position Compensation
  const createResizePan = (opts: {
    signX: -1 | 0 | 1;
    signY: -1 | 0 | 1;
  }) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => writingEnabled,
      onMoveShouldSetPanResponder: () => writingEnabled,

      onPanResponderGrant: () => {
        if (!writingEnabled) return;
        isResizingRef.current = true;
        startSizeRef.current = {
          width: currentSizeRef.current.width,
          height: currentSizeRef.current.height,
          x: currentPosRef.current.x,
          y: currentPosRef.current.y
        };
      },

      onPanResponderMove: (_evt, gestureState) => {
        if (!writingEnabled) return;
        const scale = pageScaleRef.current || 1;

        // Calculate raw change based on primary sign
        // We prioritize the axis that matches the sign. 
        // For corners (both signs non-zero), we can take projection or max.
        // Simple accurate approach: Use X change to drive Width, then derive Height from ratio.

        let dx = (gestureState.dx / scale) * opts.signX;
        let dy = (gestureState.dy / scale) * opts.signY;

        // Use the larger delta to drive resizing for better responsiveness? 
        // Or just X? X is usually fine for aspect ratio resizing.
        // Let's take the max of dx/dy to allow "pulling" in either direction
        let delta = dx > dy ? dx : dy;
        // BUT if signX is 0 (Top/Bottom handle), we must use dy. 
        if (opts.signX !== 0 && opts.signY !== 0) {
          // Diagonal - use average or max? Max feels best.
          delta = Math.max(dx, dy);
        } else if (opts.signX !== 0) {
          delta = dx;
        } else {
          delta = dy;
        }

        let newWidth = startSizeRef.current.width + delta;
        // Enforce aspect ratio
        // If we are resizing Height-only? Stickers are aspect locked usually. 
        // Assuming locked ratio for stickers:
        let newHeight = newWidth / RATIO;

        if (newWidth < MIN_WIDTH) {
          newWidth = MIN_WIDTH;
          newHeight = newWidth / RATIO;
        }

        // Position Compensation
        let newX = startSizeRef.current.x;
        let newY = startSizeRef.current.y;

        if (opts.signX === -1) {
          newX = startSizeRef.current.x - (newWidth - startSizeRef.current.width);
        }
        // If resizing Top-Right, Y needs to shift by height difference IF aspect ratio forces height change?
        // YES. If width changes, height changes. If we are dragging Top handle (signY=-1), Y must shift.
        if (opts.signY === -1) {
          newY = startSizeRef.current.y - (newHeight - startSizeRef.current.height);
        }

        widthAnim.setValue(newWidth);
        heightAnim.setValue(newHeight);
        pan.setValue({ x: newX, y: newY });

        currentSizeRef.current = { width: newWidth, height: newHeight };
        currentPosRef.current = { x: newX, y: newY };
      },

      onPanResponderRelease: () => {
        if (!writingEnabled) return;
        const { width, height } = currentSizeRef.current;
        const { x, y } = currentPosRef.current;

        onSizeChange(sticker.id, width, height);
        onPositionChange(sticker.id, x, y);
        isResizingRef.current = false;
      },
      onPanResponderTerminate: () => {
        isResizingRef.current = false;
      }
    });
  };

  const tlResizePan = useRef(createResizePan({ signX: -1, signY: -1 })).current;
  const trResizePan = useRef(createResizePan({ signX: 1, signY: -1 })).current;
  const blResizePan = useRef(createResizePan({ signX: -1, signY: 1 })).current;
  const brResizePan = useRef(createResizePan({ signX: 1, signY: 1 })).current;

  const stickerImageSource = sticker.stickerType === 'doctor'
    ? DOCTOR_STICKER_SOURCE
    : PATIENT_STICKER_SOURCE;

  return (
    <Animated.View
      style={[
        styles.stickerWrapper,
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            // NO SCALE TRANSFORM - handled by width/height
          ],
        },
      ]}
    >
      {!isEditing && writingEnabled && (
        <TouchableOpacity
          style={styles.stickerDeleteButton}
          onPress={() => onDelete(sticker.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={!writingEnabled}
        >
          <Ionicons name="close-circle" size={18} color="#0EA5A4" />
        </TouchableOpacity>
      )}

      <Animated.View
        {...dragPan.panHandlers}
        style={[
          styles.stickerHitBox,
          isEditing && writingEnabled && { borderWidth: 1, borderColor: '#0EA5A4' },
          { width: widthAnim, height: heightAnim }
        ]}
      >
        <Image
          source={stickerImageSource}
          style={[
            styles.stickerImage,
            { width: '100%', height: '100%' }
          ]} // Fill the animated wrapper
          resizeMode="contain"
        />
      </Animated.View>

      {isEditing && writingEnabled && (
        <>
          <View
            style={[styles.stickerResizeHandle, { top: -8, left: -8, borderColor: '#0EA5A4' }]}
            {...tlResizePan.panHandlers}
          />
          <View
            style={[styles.stickerResizeHandle, { top: -8, right: -8, borderColor: '#0EA5A4' }]}
            {...trResizePan.panHandlers}
          />
          <View
            style={[styles.stickerResizeHandle, { bottom: -8, left: -8, borderColor: '#0EA5A4' }]}
            {...blResizePan.panHandlers}
          />
          <View
            style={[styles.stickerResizeHandle, { bottom: -8, right: -8, borderColor: '#0EA5A4' }]}
            {...brResizePan.panHandlers}
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

  const formKeyParam = route.params?.formKey as string | undefined;
  const apiPages = route.params?.apiPages as PageData[] | undefined;
  const documentId = route.params?.documentId as string | undefined;
  const documentInstanceId = route.params?.documentInstanceId as string | undefined;

  const storageKeyParam = route.params?.storageKey as string | undefined;
  const uiKeyParam = route.params?.uiStorageKey as string | undefined;
  const STORAGE_KEY = storageKeyParam ?? DEFAULT_STORAGE_KEY;
  const STORAGE_UI_KEY = uiKeyParam ?? DEFAULT_UI_KEY;

  const initialStrokesFromParams = Array.isArray(route.params?.savedStrokes)
    ? route.params.savedStrokes
    : null;

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

  const [color, setColor] = useState('#073694ff');
  const [penWidth, setPenWidth] = useState(4);
  const [eraserWidth, setEraserWidth] = useState(20);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [colorPanelOpen, setColorPanelOpen] = useState(false);
  const [thicknessTool, setThicknessTool] = useState<'pen' | 'eraser' | null>(null);
  const thicknessPanelOpen = thicknessTool !== null;

  const [writingEnabled, setWritingEnabled] = useState(true);
  const writingEnabledRef = useRef(writingEnabled);
  const multiTouchActiveRef = useRef(false);
  const [multiTouchActive, setMultiTouchActive] = useState(false);
  useEffect(() => {
    writingEnabledRef.current = writingEnabled;
  }, [writingEnabled]);

  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'success' | 'error'
  >('idle');
  const lastPayloadRef = useRef<any | null>(null);
  const [saveMessage, setSaveMessage] = useState<string>('');

  const colorRef = useRef(color);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  const [editingOffHintVisible, setEditingOffHintVisible] = useState(false);
  const editingOffHintTimeoutRef = useRef<any>(null);
  useEffect(() => {
    return () => {
      if (editingOffHintTimeoutRef.current) {
        clearTimeout(editingOffHintTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!writingEnabled) {
      setThicknessTool(null);
      setColorPanelOpen(false);
      setEditingNoteId(null);
      setEditingStickerId(null);
    }
  }, [writingEnabled]);

  // Use apiPages directly
  const IMAGES: PageData[] = useMemo(() => {
    if (Array.isArray(apiPages) && apiPages.length > 0) {
      return apiPages;
    }
    return [];
  }, [apiPages]);

  const canvasRefs = useRef<Array<DrawingRef | null>>(
    IMAGES.map(() => null)
  );

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

  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>(initialVoiceNotesFromParams);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const [imageStickers, setImageStickers] = useState<ImageSticker[]>(initialImageStickersFromParams);
  const [editingStickerId, setEditingStickerId] = useState<string | null>(null);

  const voiceRedoStackRef = useRef<Record<number, VoiceNote[]>>({});

  const [stickerModalVisible, setStickerModalVisible] = useState(false);
  const [selectedStickerType, setSelectedStickerType] = useState<'patient' | 'doctor' | null>(null);
  const [textModalVisible, setTextModalVisible] = useState(false);
  const [typedText, setTypedText] = useState('');

  // State for previous overlays
  const [previousOverlays, setPreviousOverlays] = useState<Map<string, string>>(new Map());
  const [loadingPreviousOverlays, setLoadingPreviousOverlays] = useState(false);
  const previousOverlaysLoadedRef = useRef(false);

  const refSetters = useRef<Array<(r: DrawingRef | null) => void>>(
    IMAGES.map((_img, i) => (r: DrawingRef | null) => {
      canvasRefs.current[i] = r;
    })
  );

  // Horizontal scroll tracking
  const scrollX = useRef(0);

  // Unified Undo/Redo Stack
  // Tracks the order of operations for each page: "stroke" | "voice"
  const actionStackRef = useRef<{ [pageIndex: number]: { type: 'voice' | 'stroke'; id?: string }[] }>({});

  const scrollRef = useRef<ScrollView | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const topPadding = Math.max(8, insets.top + 6);

  // Helper to scroll to specific page
  const scrollToPage = (index: number) => {
    if (!scrollRef.current) return;
    const x = index * SCREEN_W;
    (scrollRef.current as any).scrollTo({ x, y: 0, animated: true });
    setCurrentPageIndex(index);
    scrollX.current = x;
  };

  const [scrollEnabled] = useState(false);

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

  useEffect(() => {
    if (voiceTranscript != null && voiceTranscript !== '') {
      setVoiceText(voiceTranscript);
    }
  }, [voiceTranscript]);

  // =============================================
  // 🔄 NEW: Load previous overlays on mount
  // =============================================
  useEffect(() => {
    const loadPreviousOverlays = async () => {
      if (!documentInstanceId || previousOverlaysLoadedRef.current) {
        console.log('Skipping previous overlay load:', {
          documentInstanceId,
          alreadyLoaded: previousOverlaysLoadedRef.current
        });
        return;
      }

      console.log('🔄 Loading previous overlays for document instance:', documentInstanceId);
      setLoadingPreviousOverlays(true);

      try {
        const overlayData = await getpagewiseoverlay(documentInstanceId);
        console.log('📥 Previous overlays API response:', overlayData);

        const overlayMap = new Map<string, string>();

        if (Array.isArray(overlayData)) {
          overlayData.forEach((item: any) => {
            if (item.pageId && item.overlayDataBase64 && item.hasOverlay) {
              console.log(`✅ Found previous overlay for page ${item.pageId} (${item.overlayDataBase64.length} chars)`);
              overlayMap.set(item.pageId, item.overlayDataBase64);
            } else if (item.pageId) {
              console.log(`📭 No overlay for page ${item.pageId} (hasOverlay: ${item.hasOverlay})`);
            }
          });
        }

        setPreviousOverlays(overlayMap);
        previousOverlaysLoadedRef.current = true;
        console.log(`📊 Loaded ${overlayMap.size} previous overlays`);

      } catch (error: any) {
        console.error('❌ Error loading previous overlays:', error);
        Alert.alert('Warning', 'Could not load previous overlays. You can still add new drawings.');
      } finally {
        setLoadingPreviousOverlays(false);
      }
    };

    if (documentInstanceId) {
      loadPreviousOverlays();
    }
  }, [documentInstanceId]);

  // =============================================
  // 🎯 NEW: Combine previous + new overlays
  // =============================================
  const combineOverlays = useCallback(async (
    canvas: DrawingRef | null,
    pageId: string
  ): Promise<string | null> => {
    console.log(`🔄 Combining overlays for page ${pageId}`);

    // Get previous overlay base64
    const previousOverlayBase64 = previousOverlays.get(pageId);

    // Get new drawing as base64
    const newDrawingBase64 = await getDrawingAsBase64(canvas);

    if (!previousOverlayBase64 && !newDrawingBase64) {
      console.log(`📭 No overlays to combine for page ${pageId}`);
      return null;
    }

    if (previousOverlayBase64 && !newDrawingBase64) {
      // Only previous overlay exists - keep it as is
      console.log(`📋 Only previous overlay exists for page ${pageId}`);
      return previousOverlayBase64;
    }

    if (!previousOverlayBase64 && newDrawingBase64) {
      // Only new drawing exists
      console.log(`🆕 Only new drawing exists for page ${pageId}`);
      return newDrawingBase64;
    }

    // Both exist - we need to combine them
    console.log(`🔗 Combining previous overlay + new drawing for page ${pageId}`);

    // Note: In this implementation, we're just returning the new drawing
    // because the API should handle combining. If you need to combine locally,
    // you would need an image processing library.

    // For now, return new drawing (or you could return previous + new if your API expects both)
    return newDrawingBase64;

  }, [previousOverlays]);

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
          const notesWithFontSize = parsed.voiceNotes.map((note: any) => ({
            ...note,
            fontSize: note.fontSize || 14,
          }));
          setVoiceNotes(notesWithFontSize);
        }

        if (
          (!Array.isArray(paramsObj.imageStickers) ||
            paramsObj.imageStickers.length === 0) &&
          Array.isArray(parsed.imageStickers)
        ) {
          setImageStickers(parsed.imageStickers);
        }

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
  }, [STORAGE_KEY, STORAGE_UI_KEY, route.params, initialStrokesFromParams, IMAGES.length]);

  function getCurrentPageIndex() {
    const effective = Math.max(0, scrollX.current);
    return Math.max(
      0,
      Math.min(IMAGES.length - 1, Math.round(effective / SCREEN_W))
    );
  }

  const addVoiceNote = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const pageIndex = getCurrentPageIndex();
    const currentPage = IMAGES[pageIndex];

    const newNote: VoiceNote = {
      id: `${Date.now()}-${Math.random()}`,
      pageId: currentPage?.pageId,
      pageIndex,
      text: trimmed,
      color: color,
      x: SCREEN_W * 0.15,
      y: PAGE_HEIGHT * 0.15,
      fontSize: 14,
    };

    // Push to unified undo stack
    if (!actionStackRef.current[pageIndex]) actionStackRef.current[pageIndex] = [];
    actionStackRef.current[pageIndex].push({ type: 'voice', id: newNote.id });

    setVoiceNotes((prev) => [...prev, newNote]);
  };

  const addImageSticker = (stickerType: 'patient' | 'doctor') => {
    const pageIndex = getCurrentPageIndex();
    const currentPage = IMAGES[pageIndex];

    let x = SCREEN_W * 0.7;
    let y;

    if (stickerType === 'patient') {
      y = PAGE_HEIGHT * 0.05 + 20;
    } else {
      y = PAGE_HEIGHT * 0.75 - 20;
    }

    const newSticker: ImageSticker = {
      id: `${Date.now()}-${Math.random()}`,
      pageId: currentPage?.pageId,
      pageIndex,
      x,
      y,
      scale: 1,
      width: 140,
      height: 90,
      stickerType,
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

  const handlePatientStickerPress = () => {
    if (saveStatus === 'saving') return;

    if (!writingEnabled) {
      showEditingOffHint();
      return;
    }

    setSelectedStickerType('patient');
    setStickerModalVisible(true);
  };

  const handleDoctorStickerPress = () => {
    if (saveStatus === 'saving') return;

    if (!writingEnabled) {
      showEditingOffHint();
      return;
    }

    setSelectedStickerType('doctor');
    setStickerModalVisible(true);
  };

  const handleAddTextIconPress = () => {
    if (saveStatus === 'saving') return;

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

  const handleVoiceNotePositionChange = (id: string, x: number, y: number) => {
    setVoiceNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, x, y } : n))
    );
  };

  const handleVoiceNoteBoxChange = (id: string, width: number, height: number) => {
    setVoiceNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, boxWidth: width, boxHeight: height } : n
      )
    );
  };

  const handleVoiceNoteTextChange = (id: string, text: string) => {
    setVoiceNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, text } : n))
    );
  };

  const handleVoiceNoteFontSizeChange = (id: string, fontSize: number) => {
    setVoiceNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, fontSize } : n))
    );
  };

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

  const handleStickerPositionChange = (id: string, x: number, y: number) => {
    setImageStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, x, y } : s))
    );
  };

  const handleStickerSizeChange = (id: string, width: number, height: number) => {
    const scale = width / 140;
    setImageStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, scale, width, height } : s))
    );
  };

  const handleStickerDelete = (id: string) => {
    setImageStickers((prev) => prev.filter((s) => s.id !== id));
    setEditingStickerId((prev) => (prev === id ? null : prev));
  };

  const handleVoiceFabPress = async () => {
    if (saveStatus === 'saving') return;

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
      if (voiceText && voiceText.trim()) {
        addVoiceNote(voiceText);
      }
      setVoiceVisible(false);
      setVoiceText('');
    }
  };

  const handleVoiceClose = () => {
    if (voiceListening) {
      stopListening();
    }
    setVoiceVisible(false);
    setVoiceText('');
  };

  useEffect(() => {
    const activeWidth = tool === 'eraser' ? eraserWidth : penWidth;

    canvasRefs.current.forEach((c) => {
      if (!c) return;

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

      if (typeof c.setBrushSize === 'function') {
        c.setBrushSize(activeWidth);
      }
    });
  }, [tool, color, penWidth, eraserWidth]);



  // Unified Undo Helper for Strokes (called on touch end if drawing)
  const registerStrokeAction = (pageIndex: number) => {
    if (!actionStackRef.current[pageIndex]) actionStackRef.current[pageIndex] = [];
    actionStackRef.current[pageIndex].push({ type: 'stroke' });
    // Clear Redo stack for consistency? Native usually clears redo on new action.
    // If we want to be strict, we can try to clear voiceRedoStackRef, but native stroke redo is internal.
  };

  const performUndo = () => {
    if (!writingEnabled) return;
    const idx = getCurrentPageIndex();

    // Check unified stack
    const stack = actionStackRef.current[idx] ?? [];
    const lastAction = stack.pop(); // Pop LAST action

    if (!lastAction) {
      // Fallback: If stack is empty (e.g. from existing strokes before this update, or missed events)
      // Try undoing native stroke just in case?
      const c = canvasRefs.current[idx];
      if (c && typeof c.undo === 'function') c.undo();
      return;
    }

    if (lastAction.type === 'stroke') {
      const c = canvasRefs.current[idx];
      if (c && typeof c.undo === 'function') c.undo();
    } else if (lastAction.type === 'voice') {
      let undoneNote: VoiceNote | null = null;
      setVoiceNotes((prev) => {
        // Find note by ID if possible, or just last one?
        // Using ID is safer if supported by stack.
        if (lastAction.id) {
          undoneNote = prev.find(n => n.id === lastAction.id) || null;
          return prev.filter(n => n.id !== lastAction.id);
        } else {
          // Fallback to "last on page" logic
          const notesForPage = prev.filter((n) => n.pageIndex === idx);
          if (notesForPage.length === 0) return prev;
          undoneNote = notesForPage[notesForPage.length - 1];
          return prev.filter((n) => n.id !== undoneNote!.id);
        }
      });

      if (undoneNote) {
        const stackRedo = voiceRedoStackRef.current[idx] ?? [];
        voiceRedoStackRef.current[idx] = [...stackRedo, undoneNote];
        if (editingNoteId === undoneNote.id) {
          setEditingNoteId(null);
        }
      }
    }
  };



  const performRedo = () => {
    if (!writingEnabled) return;
    const idx = getCurrentPageIndex();
    const c = canvasRefs.current[idx];
    if (c && typeof c.redo === 'function') c.redo();

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

  const [confirmClearVisible, setConfirmClearVisible] = useState(false);

  const performClearConfirmed = () => {
    setConfirmClearVisible(false);

    const idx = getCurrentPageIndex();
    const c = canvasRefs.current[idx];
    if (c && typeof c.clear === 'function') c.clear();

    clearNotesForPage(idx);
    setEditingNoteId(null);
    setEditingStickerId(null);
  };

  const performClear = () => {
    if (!writingEnabled) return;
    const idx = getCurrentPageIndex();
    const c = canvasRefs.current[idx];
    if (c && typeof c.clear === 'function') c.clear();

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

  const CONTENT_TOP_PADDING = Math.max(24, (insets.top ?? 0) + PAGE_SPACING + 8);
  const CONTENT_BOTTOM_PADDING = Math.max(160, SCREEN_H - PAGE_HEIGHT + PAGE_SPACING + 24);

  const PALETTE = [
    '#073694ff',

    '#066666',
    '#B13120',
    '#CC3F5C',
    '#B45A73',
    '#C97A3A',
    '#C8A31F',
    '#4F8B45',
    '#008080',
    '#0069A8',
    '#5870C2',
    '#7A52B3',
    '#555555',
    '#000000',
  ];

  // ========== Scroll handle positioning ==========
  const COMBINED_HEADER_PADDING_TOP = 8;
  const COMBINED_HEADER_PADDING_BOTTOM = 6;
  const TOP_ROW_PADDING_BOTTOM = 6;
  const TOOLS_ROW_HEIGHT = 50;

  const HEADER_TOTAL_HEIGHT =
    COMBINED_HEADER_PADDING_TOP +
    TOP_ROW_PADDING_BOTTOM +
    TOOLS_ROW_HEIGHT +
    COMBINED_HEADER_PADDING_BOTTOM;

  const RIGHT_HANDLE_WIDTH = 36;
  const RIGHT_HANDLE_HEIGHT = 100;

  const MIN_HANDLE_TOP = HEADER_TOTAL_HEIGHT + (insets.top ?? 0) + 20;
  const MAX_HANDLE_TOP = SCREEN_H - RIGHT_HANDLE_HEIGHT - (insets.bottom ?? 0) - 8;

  // Vertical sidebar logic REMOVED


  const MIN_ZOOM = 1;
  const MAX_ZOOM = 3;

  const pageScaleAnimsRef = useRef(
    IMAGES.map(() => new Animated.Value(1))
  ).current;
  const pageTranslateXRef = useRef(
    IMAGES.map(() => new Animated.Value(0))
  ).current;
  const pageTranslateYRef = useRef(
    IMAGES.map(() => new Animated.Value(0))
  ).current;

  const lastScalePerPageRef = useRef(IMAGES.map(() => 1)).current;
  const panStartPerPageRef = useRef(
    IMAGES.map(() => ({ x: 0, y: 0 }))
  ).current;

  const pinchStateRef = useRef<{
    initialDistance: number;
    initialMidX: number;
    initialMidY: number;
    startScale: number;
    pageIndex: number;
  } | null>(null);

  const activePanPageRef = useRef<number | null>(null);

  const clampPanForPage = (pageIndex: number, tx: number, ty: number, scale: number) => {
    if (scale <= 1.01) {
      return { clampedX: 0, clampedY: 0 };
    }
    // Relaxed clamping (1.5x) to allow reaching corners easily
    const maxOffsetX = ((SCREEN_W * (scale - 1)) / 2) * 1.5;
    const maxOffsetY = ((PAGE_HEIGHT * (scale - 1)) / 2) * 1.5;

    const clampedX = clamp(tx, -maxOffsetX, maxOffsetX);
    const clampedY = clamp(ty, -maxOffsetY, maxOffsetY);
    return { clampedX, clampedY };
  };

  const disableDrawingImmediately = (disable: boolean) => {
    try {
      multiTouchActiveRef.current = disable;
      canvasRefs.current.forEach((c) => {
        if (!c) return;
        if (typeof (c as any).setDrawingEnabled === 'function') {
          (c as any).setDrawingEnabled(!disable ? true : false);
        }
        if (disable) {
          if (typeof (c as any).cancelStroke === 'function') {
            (c as any).cancelStroke();
          }
          if (typeof (c as any).endStroke === 'function') {
            (c as any).endStroke();
          }
          if (typeof (c as any).finishStroke === 'function') {
            (c as any).finishStroke();
          }
          if (typeof (c as any).abortCurrentStroke === 'function') {
            (c as any).abortCurrentStroke();
          }
        } else {
          if (typeof (c as any).setDrawingEnabled === 'function') {
            (c as any).setDrawingEnabled(true);
          }
        }
      });
    } catch (e) {
      console.warn('[FormImageEditor] disableDrawingImmediately error', e);
    }

    setMultiTouchActive(disable);
  };

  const pinchResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        if (editingNoteId || editingStickerId) return false;
        const touches = evt.nativeEvent.touches || [];
        const count = touches.length;
        const pageIndex = getCurrentPageIndex();
        const currentScale = lastScalePerPageRef[pageIndex] ?? 1;

        if (count === 2) return true;
        if (count === 1 && currentScale > 1.01) return !writingEnabled;
        return false;
      },

      onMoveShouldSetPanResponder: (evt) => {
        if (editingNoteId || editingStickerId) return false;
        const touches = evt.nativeEvent.touches || [];
        const count = touches.length;
        const pageIndex = getCurrentPageIndex();
        const currentScale = lastScalePerPageRef[pageIndex] ?? 1;

        if (count === 2) return true;
        if (count === 1 && currentScale > 1.01) return !writingEnabled;
        return false;
      },

      onMoveShouldSetPanResponderCapture: (evt) => {
        const touches = evt.nativeEvent.touches || [];
        if (touches.length === 2) {
          disableDrawingImmediately(true);
          return true;
        }
        return false;
      },

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches || [];
        const pageIndex = getCurrentPageIndex();
        const currentScale = lastScalePerPageRef[pageIndex] ?? 1;

        if (touches.length === 2) {
          disableDrawingImmediately(true);
        }

        if (touches.length === 2) {
          const [t1, t2] = touches;
          const dx = t1.pageX - t2.pageX;
          const dy = t1.pageY - t2.pageY;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const midX = (t1.pageX + t2.pageX) / 2;
          const midY = (t1.pageY + t2.pageY) / 2;

          pinchStateRef.current = {
            initialDistance: distance,
            initialMidX: midX,
            initialMidY: midY,
            startScale: currentScale,
            pageIndex,
          };



          try {
            panStartPerPageRef[pageIndex] = {
              x: (pageTranslateXRef[pageIndex] as any).__getValue?.() ?? 0,
              y: (pageTranslateYRef[pageIndex] as any).__getValue?.() ?? 0,
            };
          } catch (e) {
            panStartPerPageRef[pageIndex] = { x: 0, y: 0 };
          }

          activePanPageRef.current = null;
        } else if (touches.length === 1 && currentScale > 1.01 && !writingEnabled) {
          activePanPageRef.current = pageIndex;
          try {
            panStartPerPageRef[pageIndex] = {
              x: (pageTranslateXRef[pageIndex] as any).__getValue?.() ?? 0,
              y: (pageTranslateYRef[pageIndex] as any).__getValue?.() ?? 0,
            };
          } catch (e) {
            panStartPerPageRef[pageIndex] = { x: 0, y: 0 };
          }
        } else {
          activePanPageRef.current = null;
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches || [];
        const pageIndex = getCurrentPageIndex();
        const currentScale = lastScalePerPageRef[pageIndex] ?? 1;

        if (touches.length === 2) {
          const [t1, t2] = touches;
          const dx = t1.pageX - t2.pageX;
          const dy = t1.pageY - t2.pageY;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const midX = (t1.pageX + t2.pageX) / 2;
          const midY = (t1.pageY + t2.pageY) / 2;

          if (!pinchStateRef.current || pinchStateRef.current.pageIndex !== pageIndex) {
            pinchStateRef.current = {
              initialDistance: distance,
              initialMidX: midX,
              initialMidY: midY,
              startScale: currentScale,
              pageIndex,
            };
            try {
              panStartPerPageRef[pageIndex] = {
                x: (pageTranslateXRef[pageIndex] as any).__getValue?.() ?? 0,
                y: (pageTranslateYRef[pageIndex] as any).__getValue?.() ?? 0,
              };
            } catch (e) {
              panStartPerPageRef[pageIndex] = { x: 0, y: 0 };
            }
          }

          const { initialDistance, initialMidX, initialMidY, startScale } = pinchStateRef.current;
          const scaleFactor = distance / (initialDistance || 1);
          let requestedScale = startScale * scaleFactor;
          if (requestedScale < MIN_ZOOM) requestedScale = MIN_ZOOM;
          if (requestedScale > MAX_ZOOM) requestedScale = MAX_ZOOM;
          lastScalePerPageRef[pageIndex] = requestedScale;

          if (requestedScale <= 1.01) {
            lastScalePerPageRef[pageIndex] = 1;
            pageScaleAnimsRef[pageIndex].setValue(1);
            pageTranslateXRef[pageIndex].setValue(0);
            pageTranslateYRef[pageIndex].setValue(0);
          } else {
            pageScaleAnimsRef[pageIndex].setValue(requestedScale);
          }

          const panStart = panStartPerPageRef[pageIndex] ?? { x: 0, y: 0 };
          const deltaX = midX - initialMidX;
          const deltaY = midY - initialMidY;

          const rawTx = panStart.x + deltaX;
          const rawTy = panStart.y + deltaY;

          const { clampedX, clampedY } = clampPanForPage(pageIndex, rawTx, rawTy, requestedScale);
          pageTranslateXRef[pageIndex].setValue(clampedX);
          pageTranslateYRef[pageIndex].setValue(clampedY);

          return;
        }

        if (touches.length === 1 && currentScale > 1.01 && !writingEnabled) {
          const pIndex = activePanPageRef.current ?? pageIndex;
          const start = panStartPerPageRef[pIndex];
          const rawTx = start.x + gestureState.dx;
          const rawTy = start.y + gestureState.dy;
          const { clampedX, clampedY } = clampPanForPage(pIndex, rawTx, rawTy, currentScale);
          pageTranslateXRef[pIndex].setValue(clampedX);
          pageTranslateYRef[pIndex].setValue(clampedY);
        }
      },

      onPanResponderRelease: () => {
        const pageIndex = getCurrentPageIndex();
        const currentScale = lastScalePerPageRef[pageIndex] ?? 1;

        // ENABLE AGAIN
        disableDrawingImmediately(false);

        if (currentScale <= 1.01) {
          lastScalePerPageRef[pageIndex] = 1;
          pageScaleAnimsRef[pageIndex].setValue(1);
          pageTranslateXRef[pageIndex].setValue(0);
          pageTranslateYRef[pageIndex].setValue(0);
        } else {
          try {
            const tx = (pageTranslateXRef[pageIndex] as any).__getValue?.() ?? 0;
            const ty = (pageTranslateYRef[pageIndex] as any).__getValue?.() ?? 0;
            const { clampedX, clampedY } = clampPanForPage(pageIndex, tx, ty, currentScale);
            pageTranslateXRef[pageIndex].setValue(clampedX);
            pageTranslateYRef[pageIndex].setValue(clampedY);
          } catch (e) { }
        }

        pinchStateRef.current = null;
        activePanPageRef.current = null;
      },

      onPanResponderTerminationRequest: () => true,

      onPanResponderTerminate: () => {
        const pageIndex = getCurrentPageIndex();
        const currentScale = lastScalePerPageRef[pageIndex] ?? 1;

        // ENABLE AGAIN
        disableDrawingImmediately(false);

        if (currentScale <= 1.01) {
          lastScalePerPageRef[pageIndex] = 1;
          pageScaleAnimsRef[pageIndex].setValue(1);

          pageTranslateXRef[pageIndex].setValue(0);
          pageTranslateYRef[pageIndex].setValue(0);
        } else {
          try {
            const tx = (pageTranslateXRef[pageIndex] as any).__getValue?.() ?? 0;
            const ty = (pageTranslateYRef[pageIndex] as any).__getValue?.() ?? 0;
            const { clampedX, clampedY } = clampPanForPage(pageIndex, tx, ty, currentScale);
            pageTranslateXRef[pageIndex].setValue(clampedX);
            pageTranslateYRef[pageIndex].setValue(clampedY);
          } catch (e) { }
        }

        pinchStateRef.current = null;
        activePanPageRef.current = null;
      },
    })
  ).current;

  const ZOOM_STEP = 0.25;

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
  }

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

  const APP_FILES_DIR = RNFS.DocumentDirectoryPath;

  const makePageFilePath = (pageIndex: number) => {
    const safeKey = (STORAGE_KEY || DEFAULT_STORAGE_KEY).replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );
    const filename = `drawing_${safeKey}_page_${pageIndex + 1}.png`;
    return `${APP_FILES_DIR}/${filename}`;
  };

  // =============================================
  // ✅ Enhanced getDrawingAsBase64
  // =============================================
  const getDrawingAsBase64 = async (
    canvas: DrawingRef | null
  ): Promise<string | null> => {
    if (!canvas) {
      console.log('❌ [BASE64] No canvas available');
      return null;
    }

    console.log('🟢 [BASE64] START extracting drawing');

    const waitForFile = async (
      filePath: string,
      timeoutMs = 8000,
      intervalMs = 100
    ): Promise<boolean> => {
      const startTime = Date.now();
      let attempts = 0;

      console.log(`⏳ [BASE64] Waiting for file: ${filePath}`);

      while (Date.now() - startTime < timeoutMs) {
        attempts++;
        try {
          const exists = await RNFS.exists(filePath);
          if (exists) {
            console.log(
              `✅ [BASE64] File exists after ${attempts} attempts (${Date.now() - startTime}ms)`
            );
            return true;
          }
          await new Promise(res => setTimeout(res, intervalMs));
        } catch (e) {
          console.warn(`⚠️ [BASE64] Attempt ${attempts} error`, e);
        }
      }

      console.error('⛔ [BASE64] Timeout waiting for file');
      return false;
    };

    /* ======================================================
     * 1️⃣ METHOD 1: Native getBase64 (BEST)
     * ====================================================== */
    if (typeof (canvas as any).getBase64 === 'function') {
      try {
        console.log('📱 [BASE64] Using canvas.getBase64()');

        const base64Raw = await (canvas as any).getBase64();

        console.log('🔗 [BASE64] Full base64 image link:', `data:image/png;base64,${base64Raw}`);

        console.log(
          '📥 [BASE64] Raw base64 preview:',
          base64Raw?.slice(0, 80)
        );
        console.log(
          '📏 [BASE64] Raw base64 length:',
          base64Raw?.length
        );

        if (typeof base64Raw === 'string' && base64Raw.length > 0) {
          const cleaned = base64Raw.startsWith('data:image')
            ? base64Raw.replace(/^data:image\/\w+;base64,/, '')
            : base64Raw;

          console.log(
            '🧼 [BASE64] Cleaned base64 preview:',
            cleaned.slice(0, 80)
          );
          console.log(
            '📏 [BASE64] Cleaned base64 length:',
            cleaned.length
          );

          console.log('✅ [BASE64] Returning BASE64 (native)');
          return cleaned;
        }

        console.warn('⚠️ [BASE64] getBase64 returned empty string');
      } catch (err) {
        console.warn(
          '❌ [BASE64] getBase64 failed → fallback to file',
          err
        );
      }
    }

    /* ======================================================
     * 2️⃣ METHOD 2: saveToFile → readFile (FALLBACK)
     * ====================================================== */
    let tempFilePath = '';

    try {
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2);

      tempFilePath = `${RNFS.DocumentDirectoryPath}/overlay_${timestamp}_${random}.png`;

      console.log('📁 [BASE64] Saving drawing to file:');
      console.log('📂 [BASE64] FILE PATH →', tempFilePath);

      console.log('🎨 [BASE64] Calling canvas.saveToFile()');
      const saved = await canvas.saveToFile(tempFilePath);

      if (!saved) {
        console.error('⛔ [BASE64] saveToFile returned false');
        return null;
      }

      const fileExists = await waitForFile(tempFilePath);
      if (!fileExists) {
        console.error('⛔ [BASE64] File never appeared:', tempFilePath);
        return null;
      }

      const stat = await RNFS.stat(tempFilePath);
      console.log(
        `📊 [BASE64] File confirmed | size=${stat.size} bytes`
      );

      if (stat.size === 0) {
        console.error('⛔ [BASE64] File size is 0 bytes');
        return null;
      }

      console.log('📖 [BASE64] Reading file as base64');
      const base64FromFile = await RNFS.readFile(tempFilePath, 'base64');

      console.log('🔗 [BASE64] Full base64 image link:', `data:image/png;base64,${base64FromFile}`);

      console.log(
        '📥 [BASE64] File base64 preview:',
        base64FromFile.slice(0, 80)
      );
      console.log(
        '📏 [BASE64] File base64 length:',
        base64FromFile.length
      );

      console.log('🧹 [BASE64] Deleting temp file');
      await RNFS.unlink(tempFilePath);

      console.log('✅ [BASE64] Returning BASE64 (file)');
      return base64FromFile;

    } catch (err: any) {
      console.error('❌ [BASE64] File fallback failed', err);

      if (tempFilePath) {
        try {
          const exists = await RNFS.exists(tempFilePath);
          if (exists) {
            await RNFS.unlink(tempFilePath);
          }
        } catch { }
      }

      return null;
    }
  };

  // =============================================
  // 🎯 UPDATED: onSaveAll function that combines overlays
  // =============================================
  const onSaveAll = async () => {
    if (saveStatus === 'saving') return;

    console.log('💾 Starting save process...');
    console.log('📋 Document Instance ID:', documentInstanceId);
    console.log('📄 Pages count:', IMAGES.length);

    setSaveStatus('saving');
    setSaveMessage('Starting save process...');

    if (!documentInstanceId) {
      console.error('❌ No document instance ID provided');
      setSaveStatus('error');
      setSaveMessage('No document instance ID. Please go back and try again.');
      return;
    }

    try {
      // ✅ STEP 1: Save overlays for each page (combining with previous overlays)
      console.log(`🎨 Saving overlays for ${IMAGES.length} pages...`);
      setSaveMessage(`Preparing overlays (0/${IMAGES.length})...`);

      const overlayResults = [];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < IMAGES.length; i++) {
        const page = IMAGES[i];
        const canvas = canvasRefs.current[i];

        setSaveMessage(`Processing page ${i + 1}/${IMAGES.length}...`);

        console.log(`\n📄 Processing page ${i + 1}/${IMAGES.length}: ${page.pageId}`);

        // Combine previous overlay with new drawing
        const combinedBase64Data = await combineOverlays(canvas, page.pageId);

        if (combinedBase64Data) {
          try {
            console.log(`📤 Sending overlay for page ${i} (${combinedBase64Data.length} chars)...`);
            setSaveMessage(`Uploading page ${i + 1}/${IMAGES.length}...`);

            // ✅ Use the combined base64 data (previous + new)
            const result = await savePageOverlay(
              documentInstanceId,
              page.pageId,
              combinedBase64Data
            );

            console.log(`✅ Overlay saved for page ${i}`);
            successCount++;

            overlayResults.push({
              pageId: page.pageId,
              pageIndex: i,
              success: true,
              message: result?.message || 'Overlay saved successfully',
            });
          } catch (error: any) {
            const apiMessage =
              error?.response?.data?.message ||
              error?.message ||
              'Failed to save overlay';

            console.error(`❌ Failed to save overlay for page ${i}:`, apiMessage);
            failCount++;

            overlayResults.push({
              pageId: page.pageId,
              pageIndex: i,
              success: false,
              error: apiMessage,
            });
          }
        } else {
          console.log(`📝 No drawing data for page ${i}, skipping overlay save`);
          overlayResults.push({
            pageId: page.pageId,
            pageIndex: i,
            success: true,
            message: 'No overlay data to save',
          });
        }
      }

      // --------------------------------------------------
      // ⬇️ Save local copy
      // --------------------------------------------------
      console.log('\n💾 Saving local copy...');
      setSaveMessage('Saving local copy...');
      const bitmapsToSave = [];

      for (let i = 0; i < IMAGES.length; i++) {
        const canvas = canvasRefs.current[i];
        if (canvas) {
          try {
            // Save current page drawing to file
            const filePath = makePageFilePath(i);
            console.log(`💾 Saving local copy for page ${i}: ${filePath}`);

            const saved = await canvas.saveToFile(filePath);

            if (saved) {
              bitmapsToSave.push({
                pageIndex: i,
                bitmapPath: filePath,
              });
              // Update savedMeta state
              setSavedMeta(prev => {
                const newMeta = [...prev];
                newMeta[i] = { ...newMeta[i], bitmapPath: filePath };
                return newMeta;
              });
              console.log(`📁 Local copy saved for page ${i}`);
            }
          } catch (err) {
            console.warn(`Failed to save local copy for page ${i}:`, err);
          }
        }
      }

      // Prepare payload
      const payload = {
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
        documentInstanceId,
        overlaySaveResults: overlayResults,
        overlayStats: {
          totalPages: IMAGES.length,
          successful: successCount,
          failed: failCount
        }
      };

      lastPayloadRef.current = payload;

      // Save to AsyncStorage
      if (AsyncStorage) {
        try {
          console.log('💾 Saving to AsyncStorage...');
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
          await AsyncStorage.setItem(STORAGE_UI_KEY, JSON.stringify(payload.editorUI));
          console.log('✅ Local data saved to AsyncStorage');
        } catch (storageErr) {
          console.warn('Failed to save to AsyncStorage:', storageErr);
        }
      }

      // Show success
      console.log('\n🎉 Save completed successfully!');
      setSaveStatus('success');

      if (failCount > 0) {
        setSaveMessage(`Saved ${successCount} of ${IMAGES.length} overlays. ${failCount} failed.`);
      } else if (successCount > 0) {
        setSaveMessage(`All ${successCount} overlays saved successfully!`);
      } else {
        setSaveMessage('No changes to save.');
      }

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        if (saveStatus === 'success') {
          console.log('🚀 Navigating back...');
          handleSaveOk();
        }
      }, 3000);

    } catch (error: any) {
      console.error('\n❌ Save failed:', error);
      setSaveStatus('error');

      let errorMessage = 'Could not save changes. Please try again.';

      if (error.message?.includes('Missing patient/document context')) {
        errorMessage = 'Missing patient information. Please go back and try again.';
      } else if (error.message?.includes('documentInstanceId')) {
        errorMessage = 'Failed to create document. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setSaveMessage(errorMessage);

      // Show error details for debugging
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      // Auto-dismiss error after 5 seconds
      setTimeout(() => {
        handleSaveOk();
      }, 5000);
    }
  };

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

    navigation.navigate('FormImageScreen', {
      savedStrokes: savedMeta,
      voiceNotes,
      imageStickers,
      storageKey: STORAGE_KEY,
      formName: route.params?.formName,
      formKey: formKeyParam,
      documentInstanceId: payload.documentInstanceId,
      overlayStats: payload.overlayStats
    });
  };

  const handleSaveErrorOk = () => {
    setSaveStatus('idle');
  };

  const getStickerImageSource = (stickerType: 'patient' | 'doctor') => {
    return stickerType === 'doctor' ? DOCTOR_STICKER_SOURCE : PATIENT_STICKER_SOURCE;
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Loading indicator for previous overlays */}
      {loadingPreviousOverlays && (
        <View style={styles.previousOverlaysLoading}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.previousOverlaysText}>Loading previous overlays...</Text>
        </View>
      )}

      {/* Combined Header - Back + Tools + SAVE */}
      <View style={styles.combinedHeader}>
        {/* Top row: Back button on left, SAVE on right */}
        <View style={styles.topRow}>
          {/* Back button on left */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            disabled={saveStatus === 'saving'}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          {/* SAVE button on right */}
          {/* Right Side: SAVE + Home */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={onSaveAll}
              style={[styles.saveButton, { marginRight: 10 }]}
              disabled={saveStatus === 'saving'}
            >
              <Text style={styles.saveButtonText}>SAVE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('PatientScreen')}
              style={{
                width: 38,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.18)',
                borderRadius: 19
              }}
              disabled={saveStatus === 'saving'}
            >
              <Ionicons name="home" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom row: Tools */}
        <View style={styles.toolsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolsScrollContent}
          >
            {/* Writing ON/OFF toggle */}
            <TouchableOpacity
              onPress={() => setWritingEnabled((prev) => !prev)}
              style={[
                styles.toolButton,
                !writingEnabled && styles.writeToggleActive,
              ]}
              disabled={saveStatus === 'saving'}
            >
              <FontAwesome
                name="pencil-square-o"
                size={20}
                color={writingEnabled ? 'rgba(255,255,255,0.6)' : '#ffffff'}
              />
              <Text style={styles.toolButtonText}>
                {writingEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>

            {/* Color picker circle */}
            <TouchableOpacity
              onPress={() => setColorPanelOpen((v) => !v)}
              style={[
                styles.toolButton,
                !writingEnabled && styles.toolsDisabled,
              ]}
              disabled={saveStatus === 'saving' || !writingEnabled}
            >
              <View style={[styles.colorCircle, { backgroundColor: color }]} />
              <Text style={styles.toolButtonText}>Color</Text>
            </TouchableOpacity>

            {/* ➕ Add Text icon (typed text) */}
            <TouchableOpacity
              onPress={handleAddTextIconPress}
              style={[styles.toolButton, !writingEnabled && styles.toolsDisabled]}
              disabled={saveStatus === 'saving' || !writingEnabled}
            >
              <MaterialCommunityIcons
                name="format-text"
                size={20}
                color={writingEnabled ? '#ffffff' : 'rgba(255,255,255,0.6)'}
              />
              <Text style={styles.toolButtonText}>Text</Text>
            </TouchableOpacity>

            {/* Undo / Redo / Clear group */}
            <View style={styles.toolGroup}>
              <TouchableOpacity
                onPress={performUndo}
                style={[styles.toolButton, !writingEnabled && styles.toolsDisabled]}
                disabled={saveStatus === 'saving' || !writingEnabled}
              >
                <Ionicons
                  name="arrow-undo"
                  size={20}
                  color={writingEnabled ? '#fff' : 'rgba(255,255,255,0.6)'}
                />
                <Text style={styles.toolButtonText}>Undo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={performRedo}
                style={[styles.toolButton, !writingEnabled && styles.toolsDisabled]}
                disabled={saveStatus === 'saving' || !writingEnabled}
              >
                <Ionicons
                  name="arrow-redo"
                  size={20}
                  color={writingEnabled ? '#fff' : 'rgba(255,255,255,0.6)'}
                />
                <Text style={styles.toolButtonText}>Redo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (saveStatus === 'saving') return;
                  if (!writingEnabled) {
                    showEditingOffHint();
                    return;
                  }
                  setConfirmClearVisible(true);
                }}
                style={[styles.toolButton, !writingEnabled && styles.toolsDisabled]}
                disabled={saveStatus === 'saving' || !writingEnabled}
              >
                <MaterialCommunityIcons
                  name="broom"
                  size={20}
                  color={writingEnabled ? '#fff' : 'rgba(255,255,255,0.6)'}
                />
                <Text style={styles.toolButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {/* Patient Sticker */}
            <TouchableOpacity
              onPress={handlePatientStickerPress}
              style={[styles.toolButton, !writingEnabled && styles.toolsDisabled]}
              disabled={saveStatus === 'saving' || !writingEnabled}
            >
              <Ionicons
                name="person"
                size={20}
                color={writingEnabled ? '#ffffff' : 'rgba(255,255,255,0.6)'}
              />
              <Text style={styles.toolButtonText}>Patient Sticker</Text>
            </TouchableOpacity>

            {/* Doctor Sticker */}
            <TouchableOpacity
              onPress={handleDoctorStickerPress}
              style={[styles.toolButton, !writingEnabled && styles.toolsDisabled]}
              disabled={saveStatus === 'saving' || !writingEnabled}
            >
              <FontAwesome6
                name="user-doctor"
                size={20}
                color={writingEnabled ? '#ffffff' : 'rgba(255,255,255,0.6)'}
              />
              <Text style={styles.toolButtonText}>Doctor Sticker</Text>
            </TouchableOpacity>

            {/* Pen / Eraser group */}
            <View style={styles.toolGroup}>
              {/* Pen */}
              <TouchableOpacity
                onPress={activatePen}
                style={[styles.toolChip, tool === 'pen' && styles.toolChipActive, !writingEnabled && styles.toolsDisabled]}
                disabled={saveStatus === 'saving' || !writingEnabled}
              >
                <MaterialCommunityIcons
                  name="pencil"
                  size={18}
                  color={tool === 'pen' ? '#0EA5A4' : (writingEnabled ? '#ffffff' : 'rgba(255,255,255,0.6)')}
                />
                <Text style={[
                  styles.toolChipText,
                  tool === 'pen' && styles.toolChipTextActive,
                  !writingEnabled && { color: 'rgba(255,255,255,0.6)' }
                ]}>
                  Pen
                </Text>
                <TouchableOpacity
                  onPress={() => setThicknessTool((prev) => (prev === 'pen' ? null : 'pen'))}
                  style={styles.thicknessToggle}
                  disabled={saveStatus === 'saving' || !writingEnabled}
                >
                  <Ionicons
                    name={thicknessPanelOpen && thicknessTool === 'pen' ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={tool === 'pen' ? '#0EA5A4' : (writingEnabled ? '#ffffff' : 'rgba(255,255,255,0.6)')}
                  />
                </TouchableOpacity>
              </TouchableOpacity>

              {/* Eraser */}
              <TouchableOpacity
                onPress={activateEraser}
                style={[styles.toolChip, tool === 'eraser' && styles.toolChipActive, !writingEnabled && styles.toolsDisabled]}
                disabled={saveStatus === 'saving' || !writingEnabled}
              >
                <MaterialCommunityIcons
                  name="eraser"
                  size={18}
                  color={tool === 'eraser' ? '#0EA5A4' : (writingEnabled ? '#ffffff' : 'rgba(255,255,255,0.6)')}
                />
                <Text style={[
                  styles.toolChipText,
                  tool === 'eraser' && styles.toolChipTextActive,
                  !writingEnabled && { color: 'rgba(255,255,255,0.6)' }
                ]}>
                  Eraser
                </Text>
                <TouchableOpacity
                  onPress={() => setThicknessTool((prev) => (prev === 'eraser' ? null : 'eraser'))}
                  style={styles.thicknessToggle}
                  disabled={saveStatus === 'saving' || !writingEnabled}
                >
                  <Ionicons
                    name={thicknessPanelOpen && thicknessTool === 'eraser' ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={tool === 'eraser' ? '#0EA5A4' : (writingEnabled ? '#ffffff' : 'rgba(255,255,255,0.6)')}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>

      {/* Color palette panel */}
      {colorPanelOpen && (
        <Animated.View style={[styles.colorPanel, { top: topPadding + 150 }]}>
          {/* Close Icon */}
          <TouchableOpacity
            onPress={() => setColorPanelOpen(false)}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: 6,
              zIndex: 50,
            }}
          >
            <Feather name="x" size={22} color="#333" />
          </TouchableOpacity>

          <View style={styles.paletteGrid}>
            {PALETTE.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => {
                  setColor(c);
                  setColorPanelOpen(false);

                  if (tool === 'eraser') {
                    setTool('pen');

                    canvasRefs.current.forEach((canvas) => {
                      if (!canvas) return;

                      if (typeof canvas.setEraser === 'function') {
                        canvas.setEraser(false);
                      }

                      if (typeof canvas.setColor === 'function') {
                        canvas.setColor(c);
                      }
                    });
                  } else {
                    canvasRefs.current.forEach((canvas) => {
                      if (!canvas || typeof canvas.setColor !== 'function') return;
                      canvas.setColor(c);
                    });
                  }
                }}
                style={[
                  styles.gridSwatchWrap,
                  c.toUpperCase() === color.toUpperCase() ? styles.gridSwatchActive : undefined,
                ]}
                disabled={saveStatus === 'saving' || !writingEnabled}
              >
                <View style={[styles.gridSwatch, { backgroundColor: c }]} />
                {c.toUpperCase() === '#FFFFFF' && <View style={styles.whiteSwatchBorder} />}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Wrapper that handles pinch zoom / pan */}
      <View style={{ flex: 1 }} {...pinchResponder.panHandlers}>
        <ScrollView
          ref={(r) => (scrollRef.current = r)}
          style={{ flex: 1 }}
          horizontal
          pagingEnabled
          contentContainerStyle={{
            alignItems: 'center',
            // No vertical padding needed
          }}
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            scrollX.current = x;
            const newIndex = Math.round(x / SCREEN_W);
            if (newIndex !== currentPageIndex) {
              setCurrentPageIndex(newIndex);
            }
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          decelerationRate="fast"
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          scrollEnabled={true}
        >
          {IMAGES.length === 0 ? (
            <View style={styles.noImagesContainer}>
              <Text style={styles.noImagesText}>No pages found for this document</Text>
            </View>
          ) : (
            IMAGES.map((page, pageIndex) => {
              const savedPath = savedMeta[pageIndex]?.bitmapPath ?? null;
              const notesForPage = voiceNotes.filter((n) => n.pageIndex === pageIndex);
              const stickersForPage = imageStickers.filter((s) => s.pageIndex === pageIndex);
              const previousOverlayBase64 = previousOverlays.get(page.pageId);

              const strokesJson = tryParseStrokesJson(previousOverlayBase64);
              const isLegacyOverlay = previousOverlayBase64 && !strokesJson;

              return (
                <View key={`page-${pageIndex}`} style={styles.pageWrap}>
                  <View style={styles.pageInner}>
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
                      {/* Direct Image Display */}
                      {page.imageData ? (
                        <Image
                          source={{ uri: page.imageData }}
                          style={styles.pageImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="large" color="#0EA5A4" />
                          <Text style={styles.loadingText}>Loading image...</Text>
                        </View>
                      )}

                      {/* Previous Overlay (Legacy Only) */}
                      {isLegacyOverlay && previousOverlayBase64 && (
                        <Image
                          source={{ uri: `data:image/png;base64,${previousOverlayBase64}` }}
                          style={styles.previousOverlayImage}
                          resizeMode="contain"
                        />
                      )}



                      {/* Canvas container */}
                      <View
                        style={styles.canvasContainer}
                        onTouchEnd={() => {
                          if (writingEnabled && !(editingNoteId || editingStickerId) && !multiTouchActive) {
                            registerStrokeAction(pageIndex);
                          }
                        }}
                        pointerEvents={
                          editingNoteId || editingStickerId || !writingEnabled || multiTouchActive
                            ? 'none'
                            : 'box-none'
                        }
                      >
                        <DrawingCanvas
                          index={pageIndex}
                          savedPath={savedPath}
                          strokesJson={strokesJson}
                          ref={(r) => refSetters.current[pageIndex](r)}
                          drawingEnabled={!(editingNoteId || editingStickerId) && !multiTouchActive}
                        />
                      </View>

                      {/* 🔹 Dismiss Edit Layer (Transparent) - MOVED HERE to be ABOVE canvas */}
                      {/* This blocks touches to canvas when editing */}
                      {(editingNoteId || editingStickerId) && (
                        <Pressable
                          style={StyleSheet.absoluteFill}
                          onPress={() => {
                            if (editingNoteId || editingStickerId) {
                              setEditingNoteId(null);
                              setEditingStickerId(null);
                            }
                          }}
                        />
                      )}

                      {/* Voice notes */}
                      {notesForPage.map((note) => (
                        <DraggableVoiceText
                          key={note.id}
                          note={note}
                          isEditing={editingNoteId === note.id}
                          onToggleEdit={(id) => {
                            if (!writingEnabled) return;
                            setEditingNoteId((prev) => (prev === id ? null : id));
                            setEditingStickerId(null);
                          }}
                          onPositionChange={handleVoiceNotePositionChange}
                          onBoxSizeChange={handleVoiceNoteBoxChange}
                          onDelete={handleVoiceNoteDelete}
                          onChangeText={handleVoiceNoteTextChange}
                          onChangeFontSize={handleVoiceNoteFontSizeChange}
                          pageScale={lastScalePerPageRef[pageIndex]}
                          writingEnabled={writingEnabled}
                          onResizeStart={() => disableDrawingImmediately(true)}
                          onResizeEnd={() => disableDrawingImmediately(false)}
                        />
                      ))}

                      {/* Image stickers */}
                      {stickersForPage.map((sticker) => (
                        <DraggableImageSticker
                          key={sticker.id}
                          sticker={sticker}
                          isEditing={editingStickerId === sticker.id}
                          onToggleEdit={(id) => {
                            if (!writingEnabled) return;
                            setEditingStickerId((prev) => (prev === id ? null : id));
                            setEditingNoteId(null);
                          }}
                          onPositionChange={handleStickerPositionChange}
                          onSizeChange={handleStickerSizeChange}
                          onDelete={handleStickerDelete}
                          pageScale={lastScalePerPageRef[pageIndex]}
                          writingEnabled={writingEnabled}
                        />
                      ))}
                    </Animated.View>
                  </View>

                  <View style={styles.pageLabelCompact} />
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Navigation Arrows */}
      {(currentPageIndex > 0) && (
        <TouchableOpacity
          style={[styles.navArrow, styles.navArrowLeft]}
          onPress={() => scrollToPage(currentPageIndex - 1)}
          disabled={saveStatus === 'saving'}
        >
          <Ionicons name="chevron-back" size={32} color="#fff" />
        </TouchableOpacity>
      )}

      {(currentPageIndex < IMAGES.length - 1) && (
        <TouchableOpacity
          style={[styles.navArrow, styles.navArrowRight]}
          onPress={() => scrollToPage(currentPageIndex + 1)}
          disabled={saveStatus === 'saving'}
        >
          <Ionicons name="chevron-forward" size={32} color="#fff" />
        </TouchableOpacity>
      )}

      {/* 🔍 Zoom +/- buttons */}
      <View style={[styles.zoomFabContainer, { bottom: (insets.bottom ?? 0) + 24 + 72 }]}>
        <TouchableOpacity style={styles.zoomFabButton} activeOpacity={0.8} onPress={handleZoomInPress} disabled={saveStatus === 'saving'}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.zoomFabButton, { marginTop: 8 }]} activeOpacity={0.8} onPress={handleZoomOutPress} disabled={saveStatus === 'saving'}>
          <Ionicons name="remove" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 🔊 floating mic FAB */}
      <TouchableOpacity
        style={[styles.voiceFab, { bottom: (insets.bottom ?? 0) + 24 }, !writingEnabled && styles.toolsDisabled]}
        activeOpacity={0.8}
        onPress={handleVoiceFabPress}
        disabled={saveStatus === 'saving' || !writingEnabled}
      >
        <Ionicons name="mic" size={24} color="#fff" />
      </TouchableOpacity>

      {/* "Editing mode Off" bubble */}
      {editingOffHintVisible && (
        <View style={[styles.writingOffBanner, { bottom: (insets.bottom ?? 0) + 24 + 56 + 8 }]}>
          <Text style={styles.writingOffText}>Editing mode Off</Text>
        </View>
      )}

      {/* Clear confirmation modal */}
      <Modal visible={confirmClearVisible} transparent animationType="fade" onRequestClose={() => setConfirmClearVisible(false)}>
        <View style={styles.confirmModalBackdrop}>
          <View style={styles.confirmModalCard}>
            <Text style={styles.confirmModalMessage}>Are you sure you want to clear everything?</Text>
            <View style={styles.confirmModalButtonsRow}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalCancel]}
                onPress={() => setConfirmClearVisible(false)}
              >
                <Text style={[styles.confirmModalButtonText, styles.confirmModalCancelText]}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalConfirm]}
                onPress={performClearConfirmed}
              >
                <Text style={[styles.confirmModalButtonText, styles.confirmModalConfirmText]}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sticker modal */}
      <Modal visible={stickerModalVisible} transparent animationType="fade" onRequestClose={() => setStickerModalVisible(false)}>
        <View style={styles.stickerModalBackdrop}>
          <View style={styles.stickerModalContent}>
            <Text style={styles.stickerModalTitle}>Add {selectedStickerType === 'doctor' ? 'Doctor' : 'Patient'} sticker</Text>
            <Image source={selectedStickerType === 'doctor' ? DOCTOR_STICKER_SOURCE : PATIENT_STICKER_SOURCE} style={styles.stickerModalImage} resizeMode="contain" />
            <View style={styles.stickerModalButtonsRow}>
              <TouchableOpacity style={[styles.stickerModalButton, { backgroundColor: '#e5e7eb' }]} onPress={() => setStickerModalVisible(false)}>
                <Text style={[styles.stickerModalButtonText, { color: '#111827' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stickerModalButton, { backgroundColor: '#0EA5A4' }]}
                onPress={() => {
                  if (selectedStickerType) {
                    addImageSticker(selectedStickerType);
                  }
                  setStickerModalVisible(false);
                  setSelectedStickerType(null);
                }}
              >
                <Text style={[styles.stickerModalButtonText, { color: '#ffffff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 📝 Typed Text Modal */}
      <Modal visible={textModalVisible} transparent animationType="fade" onRequestClose={() => setTextModalVisible(false)}>
        <View style={styles.stickerModalBackdrop}>
          <View style={styles.stickerModalContent}>
            <Text style={styles.stickerModalTitle}>Add text</Text>
            <TextInput style={styles.textModalInput} placeholder="Type text to add on image" placeholderTextColor="#9ca3af" multiline value={typedText} onChangeText={setTypedText} autoFocus />
            <View style={styles.stickerModalButtonsRow}>
              <TouchableOpacity style={[styles.stickerModalButton, { backgroundColor: '#e5e7eb' }]} onPress={() => { setTextModalVisible(false); setTypedText(''); }}>
                <Text style={[styles.stickerModalButtonText, { color: '#111827' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.stickerModalButton, { backgroundColor: '#0EA5A4' }]} onPress={handleTextModalAdd}>
                <Text style={[styles.stickerModalButtonText, { color: '#ffffff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔽 Thickness dropdown panel */}
      {thicknessPanelOpen && thicknessTool && writingEnabled && (
        <View style={[styles.thicknessPanel, { top: topPadding + 150 }]}>
          <View style={styles.thicknessHeaderRow}>
            <Text style={styles.thicknessTitle}>{thicknessTool === 'pen' ? 'Pen thickness' : 'Eraser thickness'}</Text>
            <TouchableOpacity onPress={() => setThicknessTool(null)}>
              <Ionicons name="chevron-up" size={18} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.thicknessContentRow}>
            <Text style={styles.thicknessBigValue}>{thicknessTool === 'pen' ? penWidth : eraserWidth}px</Text>

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
                  canvasRefs.current.forEach((c) => {
                    if (!c) return;
                    if (typeof c.setEraser === 'function') {
                      c.setEraser(true);
                    }
                    if (typeof c.setBrushSize === 'function') {
                      c.setBrushSize(val);
                    }
                  });
                }
              }}
              disabled={saveStatus === 'saving' || !writingEnabled}
            />
          </View>
        </View>
      )}

      {/* Voice overlay */}
      {voiceVisible && (
        <View style={styles.voiceOverlay}>
          <View style={styles.voiceDialog}>
            <TouchableOpacity style={styles.voiceCloseButton} onPress={handleVoiceClose}>
              <Ionicons name="close" size={24} color="#9ca3af" />
            </TouchableOpacity>

            <Text style={styles.voiceTitle}>Google</Text>
            <Text style={styles.voiceSubtitle}>{voiceListening ? voiceText || 'Listening...' : 'Processing...'}</Text>

            <View style={styles.voiceMicContainer}>
              {voiceListening && <View style={[styles.voiceMicPulse, { borderColor: '#2563eb' }]} />}
              <TouchableOpacity style={[styles.voiceMicButton, voiceListening && styles.voiceMicButtonActive]} onPress={handleVoiceStopPress} activeOpacity={0.8}>
                <Ionicons name={voiceListening ? 'mic' : 'mic-off'} size={32} color="#fff" />
              </TouchableOpacity>
            </View>

            {voiceError ? <Text style={styles.voiceErrorText}>{voiceError}</Text> : null}
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
                <Text style={styles.saveMessage}>{saveMessage}</Text>
              </>
            )}

            {saveStatus === 'success' && (
              <>
                <Ionicons name="checkmark-circle" size={52} color="#16a34a" style={{ marginBottom: 8 }} />
                <Text style={styles.saveTitle}>Changes saved</Text>
                <Text style={styles.saveMessage}>
                  {saveMessage}
                </Text>

                <TouchableOpacity style={styles.saveOkButton} onPress={handleSaveOk}>
                  <Text style={styles.saveOkButtonText}>OK</Text>
                </TouchableOpacity>
              </>
            )}

            {saveStatus === 'error' && (
              <>
                <Ionicons name="alert-circle" size={52} color="#dc2626" style={{ marginBottom: 8 }} />
                <Text style={styles.saveTitle}>Save failed</Text>
                <Text style={styles.saveMessage}>
                  {saveMessage}
                </Text>
                <TouchableOpacity style={styles.saveOkButton} onPress={handleSaveErrorOk}>
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
  root: {
    flex: 1,
    backgroundColor: '#0EA5A4'
  },
  previousOverlaysLoading: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(14, 165, 164, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  previousOverlaysText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  previousOverlayImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 2,
    opacity: 0.7,
  },
  combinedHeader: {
    backgroundColor: '#0EA5A4',
    paddingTop: 8,
    paddingBottom: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  saveButtonText: {
    color: '#0EA5A4',
    fontSize: 16,
    fontWeight: '600',
  },
  toolsRow: {
    height: 50,
  },
  toolsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  toolButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: 16,
  },
  toolButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  toolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 4,
  },
  toolChipActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  toolChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    marginHorizontal: 4,
  },
  toolChipTextActive: {
    color: '#0EA5A4',
  },
  thicknessToggle: {
    paddingLeft: 2,
  },
  colorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 2,
  },
  writeToggleActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  toolsDisabled: {
    opacity: 0.35,
  },
  noImagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 10,
  },
  noImagesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 80,
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
  gridSwatchActive: {
    borderColor: '#0EA5A4',
    borderWidth: 2
  },
  gridSwatch: {
    width: '100%',
    height: '100%',
    borderRadius: 8
  },
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
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  navArrowLeft: {
    left: 10,
  },
  navArrowRight: {
    right: 10,
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
  voiceTextDrag: {
    fontSize: 16,
    fontWeight: '500',
    backgroundColor: 'transparent',
  },
  voiceResizeHandle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    zIndex: 10,
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
  textTouchArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    flex: 1,
  },
  autoResizeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: '#fff',
  },
  fontSizeControls: {
    position: 'absolute',
    top: -42,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffffee',
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 6,
    zIndex: 2000,
    elevation: 5,
  },
  fontSizeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    backgroundColor: '#fff',
  },
  fontSizeText: {
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  voiceTextInput: {
    fontSize: 16,
    fontWeight: '500',
    backgroundColor: 'transparent',
    padding: 0,
    margin: 0,
    flex: 1,
    overflow: 'visible',
  },
  voiceTextHitBox: {
    backgroundColor: 'transparent',
    borderRadius: 4,
    minHeight: 30,
    flexDirection: 'row',
  },
  measureContainer: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
    flexWrap: 'wrap',
  },
  stickerWrapper: {
    position: 'absolute',
  },
  stickerHitBox: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  stickerImage: {
    borderRadius: 8,
  },
  stickerResizeHandle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    zIndex: 10,
  },
  stickerDeleteButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    zIndex: 5,
    backgroundColor: '#ffffffee',
    borderRadius: 10,
    padding: 1,
  },
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
  voiceCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  voiceTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f9fafb',
    marginTop: 8,
  },
  voiceSubtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    paddingHorizontal: 24,
    minHeight: 24,
  },
  whiteSwatchBorder: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    pointerEvents: 'none',
  },
  voiceMicContainer: {
    position: 'relative',
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceMicPulse: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#2563eb',
    opacity: 0.5,
  },
  voiceMicButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceMicButtonActive: {
    backgroundColor: '#2563eb',
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
  confirmModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
  },
  confirmModalMessage: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 18,
  },
  confirmModalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  confirmModalCancel: {
    backgroundColor: '#eef2f7',
  },
  confirmModalConfirm: {
    backgroundColor: '#0EA5A4',
  },
  confirmModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmModalCancelText: {
    color: '#111827',
  },
  confirmModalConfirmText: {
    color: '#ffffff',
  },
});
