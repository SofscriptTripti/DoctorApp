// src/FormImageEditor.tsx
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
  LayoutRectangle,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
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

// We TRY AsyncStorage, but we don't depend on it.
let AsyncStorage: any = null;
try {
  AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAGE_HEIGHT = Math.round(SCREEN_H * 0.75);
const PAGE_SPACING = 16;
const DEFAULT_STORAGE_KEY = 'DoctorApp:pagesBitmaps:v1';
const DEFAULT_UI_KEY = 'DoctorApp:editorUI:v1';

const IMAGES_BY_FORM: Record<string, any[]> = {
  emergency_nursing_assessment: [
    require('./Images/Emergency Nursing Assessment/6 Emergency Nursing Assessment_pages-to-jpg-0001.jpg'),
    require('./Images/Emergency Nursing Assessment/6 Emergency Nursing Assessment_pages-to-jpg-0002.jpg'),
    require('./Images/Emergency Nursing Assessment/6 Emergency Nursing Assessment_pages-to-jpg-0003.jpg'),
    require('./Images/Emergency Nursing Assessment/6 Emergency Nursing Assessment_pages-to-jpg-0004.jpg'),
  ],

  initial_nursing_assessment: [
    require('./Images/Initial Nursing Assessment/1 Initial Nursing Assessment -ADULTS_pages-to-jpg-0001.jpg'),
    require('./Images/Initial Nursing Assessment/1 Initial Nursing Assessment -ADULTS_pages-to-jpg-0002.jpg'),
    require('./Images/Initial Nursing Assessment/1 Initial Nursing Assessment -ADULTS_pages-to-jpg-0003.jpg'),
    require('./Images/Initial Nursing Assessment/1 Initial Nursing Assessment -ADULTS_pages-to-jpg-0004.jpg'),
    require('./Images/Initial Nursing Assessment/1 Initial Nursing Assessment -ADULTS_pages-to-jpg-0005.jpg'),
    require('./Images/Initial Nursing Assessment/1 Initial Nursing Assessment -ADULTS_pages-to-jpg-0006.jpg'),
  ],

  neonatal_initial_nursing: [
    require('./Images/Neonatal Initial Nursing/2 Neonatal Initial Nursing Assessment Form_page-0001.jpg'),
    require('./Images/Neonatal Initial Nursing/2 Neonatal Initial Nursing Assessment Form_page-0002.jpg'),
    require('./Images/Neonatal Initial Nursing/2 Neonatal Initial Nursing Assessment Form_page-0003.jpg'),
    require('./Images/Neonatal Initial Nursing/2 Neonatal Initial Nursing Assessment Form_page-0004.jpg'),
  ],
  doctors_handover_isbar: [
    require('./Images/DoctorHandOverFromat.jpg'),
  ],
  doctor_chart: [ require('./Images/17 Diabetic Chart 2.jpg')],
};

const DEFAULT_IMAGES: any[] = [];

// 👉 Sticker images (local assets)
const PATIENT_STICKER_SOURCE = require('./Images/NameStick.jpg');
const DOCTOR_STICKER_SOURCE = require('./Images/Doctor_Sticker.jpg');

type SavedMeta = { bitmapPath?: string | null };

// Voice text note type
export type VoiceNote = {
  id: string;
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
  pageIndex: number;
  x: number;
  y: number;
  scale: number;
  width?: number;
  height?: number;
  stickerType: 'patient' | 'doctor'; // Added sticker type
};

// --- stable memoized drawing canvas
type DrawingCanvasProps = {
  index: number;
  savedPath?: string | null;
  drawingEnabled?: boolean; // Add this new prop
};

// --- stable memoized drawing canvas
const DrawingCanvas = React.memo(
  forwardRef(function DrawingCanvasInternal(
    { index, savedPath, drawingEnabled = true }: DrawingCanvasProps, // Add default value
    forwardedRef: React.Ref<DrawingRef | null>
  ) {
    // We need to pass drawingEnabled to NativeDrawingView if it supports it
    return (
      <NativeDrawingView
        ref={forwardedRef}
        style={styles.canvasOverlay}
        savedPath={savedPath ?? undefined}
        // If NativeDrawingView has a drawingEnabled prop, pass it
        // Otherwise, we'll handle it differently
      />
    );
  }),
  (prev, next) =>
    prev.index === next.index && 
    prev.savedPath === next.savedPath &&
    prev.drawingEnabled === next.drawingEnabled // Add this
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
}) {
  const DEFAULT_WIDTH = 180;
  const DEFAULT_HEIGHT = 60;
  const DEFAULT_FONT_SIZE = 14;
  
  // Image dimensions - these should match your page/image size
  const IMAGE_WIDTH = SCREEN_W; // Full screen width
  const IMAGE_HEIGHT = PAGE_HEIGHT; // Page height
  
  // Minimum sizes
  const MIN_WIDTH = 40;
  const MIN_HEIGHT = 30;
  
  const MIN_FONT_SIZE = 10;
  const MAX_FONT_SIZE = 36;

  const PADDING_H = 12;
  const PADDING_V = 8;

  // Refs for current state
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

  // Track user resizing state
  const isUserResizingRef = useRef(false);
  const [isTextInputFocused, setIsTextInputFocused] = useState(false);
  const [manualResizeFlag, setManualResizeFlag] = useState(0);
  // Add near other useState declarations in FormImageEditor



  const startPosRef = useRef({ x: note.x, y: note.y });
  const lastTapRef = useRef(0);

  const sizeStartRef = useRef<{ width: number; height: number }>(
    {
      width: currentWidthRef.current,
      height: currentHeightRef.current,
    }
  );
  

  const currentFontSize = note.fontSize ?? DEFAULT_FONT_SIZE;

  const measuredContentSizeRef = useRef<{ w: number; h: number } | null>(null);
  const [measuredFlag, setMeasuredFlag] = useState(0);
  const resizeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const textInputRef = useRef<TextInput>(null);
  const pageScaleRef = useRef(pageScale);

  // Track if we're actively interacting with resize handles
  const isResizingRef = useRef(false);

  // Function to calculate maximum allowed dimensions based on current position
  const calculateDynamicMaximums = (x: number, y: number) => {
    // Calculate available space from current position to image edges
    const maxAvailableWidth = IMAGE_WIDTH - x - 10; // 10px margin from right edge
    const maxAvailableHeight = IMAGE_HEIGHT - y - 10; // 10px margin from bottom edge
    
    // Return maximum allowed dimensions
    return {
      maxWidth: Math.max(MIN_WIDTH, Math.min(maxAvailableWidth, IMAGE_WIDTH * 0.8)),
      maxHeight: Math.max(MIN_HEIGHT, Math.min(maxAvailableHeight, IMAGE_HEIGHT * 0.8))
    };
  };

  // Update page scale ref
  useEffect(() => {
    pageScaleRef.current = pageScale || 1;
  }, [pageScale]);

  // Update sizes when note changes
  useEffect(() => {
    const w = note.boxWidth ?? DEFAULT_WIDTH;
    const h = note.boxHeight ?? DEFAULT_HEIGHT;
    currentWidthRef.current = w;
    currentHeightRef.current = h;
    widthAnim.setValue(w);
    heightAnim.setValue(h);
  }, [note.boxWidth, note.boxHeight, widthAnim, heightAnim]);

  // Update position when note changes
  useEffect(() => {
    pan.setValue({ x: note.x, y: note.y });
    currentPosRef.current = { x: note.x, y: note.y };
  }, [note.x, note.y, pan]);

  // Focus text input when editing starts
  useEffect(() => {
    if (isEditing && isTextInputFocused && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  }, [isEditing, isTextInputFocused]);

  // Reset user resizing state when exiting edit mode
  useEffect(() => {
    if (!isEditing) {
      isUserResizingRef.current = false;
      isResizingRef.current = false;
    }
  }, [isEditing]);

  // Handle initial auto-sizing only for notes without dimensions
  useEffect(() => {
    if ((note.boxWidth == null || note.boxHeight == null) && measuredContentSizeRef.current) {
      const c = measuredContentSizeRef.current;
      
      // Calculate dynamic maximums based on current position
      const { maxWidth, maxHeight } = calculateDynamicMaximums(note.x, note.y);
      
      // Add buffer to ensure text fits
      const buffer = 16;
      const autoW = clamp(Math.round(c.w + PADDING_H * 2 + buffer), MIN_WIDTH, maxWidth);
      const autoH = clamp(Math.round(c.h + PADDING_V * 2 + buffer), MIN_HEIGHT, maxHeight);

      currentWidthRef.current = autoW;
      currentHeightRef.current = autoH;
      widthAnim.setValue(autoW);
      heightAnim.setValue(autoH);
      onBoxSizeChange(note.id, autoW, autoH);
    }
  }, [measuredFlag, note.id, note.boxWidth, note.boxHeight, onBoxSizeChange]);


  
  // Handle content layout measurement
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

  // Drag handlers with boundary checking
const dragPan = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: (evt: GestureResponderEvent) => {
      // Only allow drag when there's exactly one touch and writing is enabled
      if (!writingEnabled) return false;
      const touches = (evt.nativeEvent && (evt.nativeEvent as any).touches) || [];
      if (touches.length !== 1) return false;
      // Don't start drag if we're resizing
      if (isResizingRef.current) return false;
      return true;
    },

    onMoveShouldSetPanResponder: (evt: GestureResponderEvent) => {
      // Only allow movement when there's exactly one touch and writing is enabled
      if (!writingEnabled) return false;
      const touches = (evt.nativeEvent && (evt.nativeEvent as any).touches) || [];
      if (touches.length !== 1) return false;
      // Don't move if we're resizing
      if (isResizingRef.current) return false;
      return true;
    },

    onPanResponderGrant: (evt: GestureResponderEvent) => {
      if (!writingEnabled) return;
      // only set start if this is a single-touch grant
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
      // ignore multi-touch move events (pinch/pan handled globally)
      const touches = (evt.nativeEvent && (evt.nativeEvent as any).touches) || [];
      if (touches.length !== 1) return;

      const scale = pageScaleRef.current || 1;

      // Calculate new position
      let nx = startPosRef.current.x + gestureState.dx / scale;
      let ny = startPosRef.current.y + gestureState.dy / scale;

      // Apply boundaries - ensure text box stays within image
      const maxX = IMAGE_WIDTH - currentWidthRef.current - 5; // 5px margin from right
      const maxY = IMAGE_HEIGHT - currentHeightRef.current - 5; // 5px margin from bottom

      nx = clamp(nx, 5, maxX); // Minimum 5px from left
      ny = clamp(ny, 5, maxY); // Minimum 5px from top

      pan.setValue({ x: nx, y: ny });
      currentPosRef.current = { x: nx, y: ny };
    },

    onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      if (!writingEnabled) return;
      // If multi-touch ended here, ignore
      const touches = (evt.nativeEvent && (evt.nativeEvent as any).touches) || [];
      if (touches.length > 1) {
        // do not treat as a finished single-finger drag/tap
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
      // Guard multi-touch termination
      const touches = (evt.nativeEvent && (evt.nativeEvent as any).touches) || [];
      if (touches.length !== 1) {
        // If multiple touches present (or termination was due to multitouch), still compute final from gesture values
        // but prefer startPosRef as base (this avoids accidental large moves)
      }

      const scale = pageScaleRef.current || 1;
      let nx = startPosRef.current.x + gestureState.dx / scale;
      let ny = startPosRef.current.y + gestureState.dy / scale;

      // Apply boundaries
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



  // Enhanced resize pan handlers with image boundaries
  const createResizePan = (opts: {
    signX: -1 | 0 | 1;
    signY: -1 | 0 | 1;
  }) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        if (!writingEnabled) return false;
        // Mark that we're resizing to prevent drag
        isResizingRef.current = true;
        return true;
      },
      onMoveShouldSetPanResponder: (evt) => {
        if (!writingEnabled) return false;
        // Mark that we're resizing to prevent drag
        isResizingRef.current = true;
        return true;
      },

      onPanResponderGrant: () => {
        if (!writingEnabled) return;
        isUserResizingRef.current = true;
        sizeStartRef.current = {
          width: currentWidthRef.current,
          height: currentHeightRef.current,
        };
      },

      onPanResponderMove: (_evt: GestureResponderEvent, gs) => {
        if (!writingEnabled) return;
        
        let newWidth = sizeStartRef.current.width;
        let newHeight = sizeStartRef.current.height;

        const scale = pageScaleRef.current || 1;

        // Calculate dynamic maximums based on current position
        const { maxWidth, maxHeight } = calculateDynamicMaximums(currentPosRef.current.x, currentPosRef.current.y);

        if (opts.signX !== 0) {
          const deltaX = (gs.dx / scale) * opts.signX;
          newWidth = clamp(
            Math.round(sizeStartRef.current.width + deltaX),
            MIN_WIDTH,
            maxWidth
          );
        }

        if (opts.signY !== 0) {
          const deltaY = (gs.dy / scale) * opts.signY;
          newHeight = clamp(
            Math.round(sizeStartRef.current.height + deltaY),
            MIN_HEIGHT,
            maxHeight
          );
        }

        // Update animations
        widthAnim.setValue(newWidth);
        heightAnim.setValue(newHeight);
        currentWidthRef.current = newWidth;
        currentHeightRef.current = newHeight;
      },

      onPanResponderRelease: () => {
        if (!writingEnabled) return;
        
        // Save the user-resized dimensions
        onBoxSizeChange(
          note.id,
          currentWidthRef.current,
          currentHeightRef.current
        );
        
        setManualResizeFlag(v => v + 1);
        // Reset resizing flag
        isResizingRef.current = false;
      },

      onPanResponderTerminate: () => {
        if (!writingEnabled) return;
        onBoxSizeChange(
          note.id,
          currentWidthRef.current,
          currentHeightRef.current
        );
        setManualResizeFlag(v => v + 1);
        // Reset resizing flag
        isResizingRef.current = false;
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

  // Listen to animation value changes
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

  // Function to auto-resize when font size changes
  const autoResizeForFontSize = (newFontSize: number) => {
    if (!writingEnabled || !measuredContentSizeRef.current) return;
    
    const measured = measuredContentSizeRef.current;
    if (!measured) return;

    // Calculate dynamic maximums based on current position
    const { maxWidth, maxHeight } = calculateDynamicMaximums(note.x, note.y);
    
    // Estimate new dimensions based on font size ratio
    const oldFontSize = note.fontSize || DEFAULT_FONT_SIZE;
    const sizeRatio = newFontSize / oldFontSize;
    
    // Calculate needed size with buffer
    const buffer = 16;
    const neededWidth = Math.round((measured.w * sizeRatio) + PADDING_H * 2 + buffer);
    const neededHeight = Math.round((measured.h * sizeRatio) + PADDING_V * 2 + buffer);
    
    // Clamp to dynamic bounds
    const newWidth = clamp(neededWidth, MIN_WIDTH, maxWidth);
    const newHeight = clamp(neededHeight, MIN_HEIGHT, maxHeight);
    
    // Update animations
    widthAnim.setValue(newWidth);
    heightAnim.setValue(newHeight);
    currentWidthRef.current = newWidth;
    currentHeightRef.current = newHeight;
    
    // Save the new size
    onBoxSizeChange(note.id, newWidth, newHeight);
  };

  const increaseFontSize = () => {
    if (!writingEnabled) return;
    const newSize = clamp(currentFontSize + 2, MIN_FONT_SIZE, MAX_FONT_SIZE);
    onChangeFontSize(note.id, newSize);
    
    // Auto-resize the box for the new font size
    autoResizeForFontSize(newSize);
  };

  const decreaseFontSize = () => {
    if (!writingEnabled) return;
    const newSize = clamp(currentFontSize - 2, MIN_FONT_SIZE, MAX_FONT_SIZE);
    onChangeFontSize(note.id, newSize);
    
    // Auto-resize the box for the new font size
    autoResizeForFontSize(newSize);
  };

  const handleTextInputFocus = () => {
    setIsTextInputFocused(true);
  };

  const handleTextInputBlur = () => {
    setIsTextInputFocused(false);
  };

  // Text change handler - no auto-resize
  const handleTextChange = (text: string) => {
    onChangeText(note.id, text);
  };

  // Manual resize function with image boundaries
  const handleManualResize = () => {
    if (!writingEnabled) return;
    
    const measured = measuredContentSizeRef.current;
    if (!measured) return;

    // Calculate dynamic maximums based on current position
    const { maxWidth, maxHeight } = calculateDynamicMaximums(note.x, note.y);
    
    // Calculate needed size with buffer
    const buffer = 16;
    const neededWidth = Math.round(measured.w + PADDING_H * 2 + buffer);
    const neededHeight = Math.round(measured.h + PADDING_V * 2 + buffer);
    
    // Clamp to dynamic bounds
    const newWidth = clamp(neededWidth, MIN_WIDTH, maxWidth);
    const newHeight = clamp(neededHeight, MIN_HEIGHT, maxHeight);
    
    // Update animations
    widthAnim.setValue(newWidth);
    heightAnim.setValue(newHeight);
    currentWidthRef.current = newWidth;
    currentHeightRef.current = newHeight;
    
    // Save the new size
    onBoxSizeChange(note.id, newWidth, newHeight);
  };

  // Clean up on unmount
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
        },
      ]}
    >
      {!isEditing && writingEnabled && (
        <TouchableOpacity
          style={styles.voiceDeleteButton}
          onPress={() => onDelete(note.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={!writingEnabled}
        >
          <Ionicons name="close-circle" size={18} color={note.color} />
        </TouchableOpacity>
      )}

      {isEditing && writingEnabled && (
        <View style={styles.fontSizeControls}>
          <TouchableOpacity
            style={[styles.fontSizeButton, { borderColor: note.color }]}
            onPress={decreaseFontSize}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            disabled={!writingEnabled}
          >
            <Ionicons name="remove" size={14} color={note.color} />
          </TouchableOpacity>
          <Text style={[styles.fontSizeText, { color: note.color }]}>
            {currentFontSize}px
          </Text>
          <TouchableOpacity
            style={[styles.fontSizeButton, { borderColor: note.color }]}
            onPress={increaseFontSize}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            disabled={!writingEnabled}
          >
            <Ionicons name="add" size={14} color={note.color} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.autoResizeButton, { borderColor: note.color }]}
            onPress={handleManualResize}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            disabled={!writingEnabled}
          >
            <Ionicons name="expand" size={14} color={note.color} />
          </TouchableOpacity>
        </View>
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
            borderWidth: 1,
          },
        ]}
      >
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

      {isEditing && writingEnabled && (
        <>
          <Animated.View
            style={[
              styles.voiceResizeHandle,
              { top: -8, left: -8, borderColor: note.color },
            ]}
            {...tlResizePan.panHandlers}
          />
          <Animated.View
            style={[
              styles.voiceResizeHandle,
              { top: -8, right: -8, borderColor: note.color },
            ]}
            {...trResizePan.panHandlers}
          />
          <Animated.View
            style={[
              styles.voiceResizeHandle,
              { bottom: -8, left: -8, borderColor: note.color },
            ]}
            {...blResizePan.panHandlers}
          />
          <Animated.View
            style={[
              styles.voiceResizeHandle,
              { bottom: -8, right: -8, borderColor: note.color },
            ]}
            {...brResizePan.panHandlers}
          />

          <Animated.View
            style={[
              styles.voiceResizeHandle,
              {
                top: '50%',
                marginTop: -7,
                left: -8,
                borderColor: note.color,
              },
            ]}
            {...mlResizePan.panHandlers}
          />
          <Animated.View
            style={[
              styles.voiceResizeHandle,
              {
                top: '50%',
                marginTop: -7,
                right: -8,
                borderColor: note.color,
              },
            ]}
            {...mrResizePan.panHandlers}
          />
          <Animated.View
            style={[
              styles.voiceResizeHandle,
              {
                left: '50%',
                marginLeft: -7,
                top: -8,
                borderColor: note.color,
              },
            ]}
            {...mtResizePan.panHandlers}
          />
          <Animated.View
            style={[
              styles.voiceResizeHandle,
              {
                left: '50%',
                marginLeft: -7,
                bottom: -8,
                borderColor: note.color,
              },
            ]}
            {...mbResizePan.panHandlers}
          />
        </>
      )}

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
              maxWidth: Math.min(SCREEN_W * 0.7, 300),
              includeFontPadding: false,
              fontSize: currentFontSize,
              textAlign: 'left',
              flexWrap: 'wrap',
              width: Math.min(SCREEN_W * 0.7, 300),
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
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;

  // Image dimensions
  const IMAGE_WIDTH = SCREEN_W;
  const IMAGE_HEIGHT = PAGE_HEIGHT;

  const currentPosRef = useRef<{ x: number; y: number }>(
    {
      x: sticker.x,
      y: sticker.y,
    }
  );

  const pan = useRef(
    new Animated.ValueXY({ x: sticker.x, y: sticker.y })
  ).current;

  const scaleAnim = useRef(new Animated.Value(sticker.scale ?? 1)).current;

  const currentSizeRef = useRef<{ width: number; height: number }>(
    {
      width: sticker.width ?? DEFAULT_WIDTH,
      height: sticker.height ?? DEFAULT_HEIGHT,
    }
  );

  const startPosRef = useRef({ x: sticker.x, y: sticker.y });
  const lastTapRef = useRef(0);
  const scaleStartRef = useRef(sticker.scale ?? 1);

  // Track if we're actively resizing
  const isResizingRef = useRef(false);

  const pageScaleRef = useRef(pageScale);
  useEffect(() => {
    pageScaleRef.current = pageScale || 1;
  }, [pageScale]);

  useEffect(() => {
    if (currentPosRef.current.x !== sticker.x || currentPosRef.current.y !== sticker.y) {
      pan.setValue({ x: sticker.x, y: sticker.y });
      currentPosRef.current = { x: sticker.x, y: sticker.y };
    }
    
    if (scaleStartRef.current !== sticker.scale) {
      scaleAnim.setValue(sticker.scale ?? 1);
      scaleStartRef.current = sticker.scale ?? 1;
    }
    
    if (currentSizeRef.current.width !== (sticker.width ?? DEFAULT_WIDTH) || 
        currentSizeRef.current.height !== (sticker.height ?? DEFAULT_HEIGHT)) {
      currentSizeRef.current = {
        width: sticker.width ?? DEFAULT_WIDTH,
        height: sticker.height ?? DEFAULT_HEIGHT,
      };
    }
  }, [sticker.x, sticker.y, sticker.scale, sticker.width, sticker.height, pan, scaleAnim]);

  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        if (!writingEnabled) return false;
        // Don't start drag if we're resizing
        if (isResizingRef.current) return false;
        return true;
      },
      onMoveShouldSetPanResponder: (evt) => {
        if (!writingEnabled) return false;
        // Don't move if we're resizing
        if (isResizingRef.current) return false;
        return true;
      },

      onPanResponderGrant: () => {
        if (!writingEnabled) return;
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
        if (!writingEnabled) return;
        const scale = pageScaleRef.current || 1;
        let nx = startPosRef.current.x + gestureState.dx / scale;
        let ny = startPosRef.current.y + gestureState.dy / scale;
        
        // Apply boundaries
        const maxX = IMAGE_WIDTH - currentSizeRef.current.width - 5;
        const maxY = IMAGE_HEIGHT - currentSizeRef.current.height - 5;
        
        nx = clamp(nx, 5, maxX);
        ny = clamp(ny, 5, maxY);
        
        pan.setValue({ x: nx, y: ny });
        currentPosRef.current = { x: nx, y: ny };
      },

      onPanResponderRelease: (_evt, gestureState) => {
        if (!writingEnabled) return;
        
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
          onPositionChange(sticker.id, finalX, finalY);
          if (writingEnabled) {
            onToggleEdit(sticker.id);
          }
          return;
        }

        onPositionChange(sticker.id, finalX, finalY);
      },

      onPanResponderTerminate: (_evt, gestureState) => {
        if (!writingEnabled) return;
        const scale = pageScaleRef.current || 1;
        let nx = startPosRef.current.x + gestureState.dx / scale;
        let ny = startPosRef.current.y + gestureState.dy / scale;
        
        // Apply boundaries
        const maxX = IMAGE_WIDTH - currentSizeRef.current.width - 5;
        const maxY = IMAGE_HEIGHT - currentSizeRef.current.height - 5;
        
        nx = clamp(nx, 5, maxX);
        ny = clamp(ny, 5, maxY);
        
        pan.setValue({ x: nx, y: ny });
        currentPosRef.current = { x: nx, y: ny };
        onPositionChange(sticker.id, nx, ny);
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
        // Mark that we're resizing to prevent drag
        isResizingRef.current = true;
        return true;
      },
      onMoveShouldSetPanResponder: (evt) => {
        if (!writingEnabled) return false;
        // Mark that we're resizing to prevent drag
        isResizingRef.current = true;
        return true;
      },

      onPanResponderGrant: () => {
        if (!writingEnabled) return;
        scaleStartRef.current = sticker.scale ?? 1;
      },

      onPanResponderMove: (_evt: GestureResponderEvent, gestureState) => {
        if (!writingEnabled) return;
        const factor = 1 + (gestureState.dx + gestureState.dy) / 220;
        let newScale = scaleStartRef.current * factor;
        
        // Calculate maximum scale based on image boundaries
        const maxWidthScale = (IMAGE_WIDTH - currentPosRef.current.x - 10) / DEFAULT_WIDTH;
        const maxHeightScale = (IMAGE_HEIGHT - currentPosRef.current.y - 10) / DEFAULT_HEIGHT;
        const maxScaleByBoundary = Math.min(maxWidthScale, maxHeightScale, MAX_SCALE);
        
        if (newScale < MIN_SCALE) newScale = MIN_SCALE;
        if (newScale > maxScaleByBoundary) newScale = maxScaleByBoundary;
        
        scaleAnim.setValue(newScale);
      },

      onPanResponderRelease: (_evt, gestureState) => {
        if (!writingEnabled) return;
        const factor = 1 + (gestureState.dx + gestureState.dy) / 220;
        let newScale = scaleStartRef.current * factor;
        
        // Calculate maximum scale based on image boundaries
        const maxWidthScale = (IMAGE_WIDTH - currentPosRef.current.x - 10) / DEFAULT_WIDTH;
        const maxHeightScale = (IMAGE_HEIGHT - currentPosRef.current.y - 10) / DEFAULT_HEIGHT;
        const maxScaleByBoundary = Math.min(maxWidthScale, maxHeightScale, MAX_SCALE);
        
        if (newScale < MIN_SCALE) newScale = MIN_SCALE;
        if (newScale > maxScaleByBoundary) newScale = maxScaleByBoundary;
        
        const newWidth = DEFAULT_WIDTH * newScale;
        const newHeight = DEFAULT_HEIGHT * newScale;
        
        onSizeChange(sticker.id, newWidth, newHeight);
        // Reset resizing flag
        isResizingRef.current = false;
      },

      onPanResponderTerminate: () => {
        if (!writingEnabled) return;
        const newWidth = DEFAULT_WIDTH * (sticker.scale ?? 1);
        const newHeight = DEFAULT_HEIGHT * (sticker.scale ?? 1);
        onSizeChange(sticker.id, newWidth, newHeight);
        // Reset resizing flag
        isResizingRef.current = false;
      },
    });
  };

  const resizePan = useRef(createResizePan({ signX: 1, signY: 1 })).current;

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
            { scale: scaleAnim },
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

      <View
        {...dragPan.panHandlers}
        style={[
          styles.stickerHitBox,
          isEditing && writingEnabled && { borderWidth: 1, borderColor: '#0EA5A4' },
        ]}
      >
        <Image
          source={stickerImageSource}
          style={[
            styles.stickerImage,
            {
              width: currentSizeRef.current.width,
              height: currentSizeRef.current.height,
            },
          ]}
          resizeMode="contain"
        />
      </View>

      {isEditing && writingEnabled && (
        <>
          <View
            style={[
              styles.stickerResizeHandle,
              { top: -8, left: -8, borderColor: '#0EA5A4' },
            ]}
            {...resizePan.panHandlers}
          />
          <View
            style={[
              styles.stickerResizeHandle,
              { top: -8, right: -8, borderColor: '#0EA5A4' },
            ]}
            {...resizePan.panHandlers}
          />
          <View
            style={[
              styles.stickerResizeHandle,
              { bottom: -8, left: -8, borderColor: '#0EA5A4' },
            ]}
            {...resizePan.panHandlers}
          />
          <View
            style={[
              styles.stickerResizeHandle,
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

  const formKeyParam = route.params?.formKey as string | undefined;
  
  const IMAGES = useMemo(
    () => IMAGES_BY_FORM[formKeyParam ?? ''] ?? DEFAULT_IMAGES,
    [formKeyParam]
  );

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

  const refSetters = useRef<Array<(r: DrawingRef | null) => void>>(
    IMAGES.map((_img, i) => (r: DrawingRef | null) => {
      canvasRefs.current[i] = r;
    })
  );

  const scrollRef = useRef<ScrollView | null>(null);
  const scrollY = useRef(0);
  const topPadding = Math.max(8, insets.top + 6);

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

  const addVoiceNote = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const pageIndex = getCurrentPageIndex();

    const newNote: VoiceNote = {
      id: `${Date.now()}-${Math.random()}`,
      pageIndex,
      text: trimmed,
      color,
      x: SCREEN_W * 0.15,
      y: PAGE_HEIGHT * 0.15,
      fontSize: 14,
    };

    setVoiceNotes((prev) => [...prev, newNote]);
  };

  const addImageSticker = (stickerType: 'patient' | 'doctor') => {
    const pageIndex = getCurrentPageIndex();

    // Different default positions for patient vs doctor stickers
    let x = SCREEN_W * 0.7; // Right side (70% from left)
    let y;
    
    if (stickerType === 'patient') {
      y = PAGE_HEIGHT * 0.05 + 20; // Top-right with more padding (5% from top)
    } else {
      y = PAGE_HEIGHT * 0.75 - 20; // Bottom-right with more padding (75% from top)
    }

    const newSticker: ImageSticker = {
      id: `${Date.now()}-${Math.random()}`,
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

  const performUndo = () => {
    if (!writingEnabled) return;
    const idx = getCurrentPageIndex();
    const c = canvasRefs.current[idx];
    if (c && typeof c.undo === 'function') c.undo();

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
    '#073694ff', // Pen Ink Blue (new, main writing color)

    '#066666', // Dark Teal (darker of #0EA5A4)
    '#B13120', // Dark Brick Red (darker of #E4572E)
    '#CC3F5C', // Deep Pink-Red (darker of #FF8A80)
    '#B45A73', // Dusty Rose (darker of #FFB6C1)
    '#C97A3A', // Burnt Orange (darker of #FFC79C)
    '#C8A31F', // Deep Mustard Yellow (darker of #FFEB7A)
    '#4F8B45', // Dark Leaf Green (darker of #7EE07A)
    '#008080', // Dark Cyan (darker of #3FE0D0)
    '#0069A8', // Deep Sky Blue (darker of #00B0FF)
    '#5870C2', // Steel Blue (darker of #9CC6FF)
    '#7A52B3', // Deep Violet (darker of #C39CFF)
    '#555555', // Dark Grey (darker of #BDBDBD)
    '#000000', // Black
  ];

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
  const MAX_HANDLE_TOP = SCREEN_H - RIGHT_HANDLE_HEIGHT - (insets.bottom ?? 0) - 8;

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
    const newTop = (sY / maxScrollY) * (MAX_HANDLE_TOP - MIN_HANDLE_TOP) + MIN_HANDLE_TOP;
    try {
      const curr = (rightTopAnim as any).__getValue
        ? (rightTopAnim as any).__getValue()
        : 0;
      if (Math.abs(newTop - curr) > 1.5) rightTopAnim.setValue(newTop);
    } catch (e) {
      rightTopAnim.setValue(newTop);
    }
  };

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
    startScale: number;
    pageIndex: number;
  } | null>(null);

  const activePanPageRef = useRef<number | null>(null);

  const clampPanForPage = (pageIndex: number, tx: number, ty: number, scale: number) => {
    if (scale <= 1.01) {
      return { clampedX: 0, clampedY: 0 };
    }
    const maxOffsetX = (SCREEN_W * (scale - 1)) / 2;
    const maxOffsetY = (PAGE_HEIGHT * (scale - 1)) / 2;

    const clampedX = clamp(tx, -maxOffsetX, maxOffsetX);
    const clampedY = clamp(ty, -maxOffsetY, maxOffsetY);
    return { clampedX, clampedY };
  };
  const disableDrawingImmediately = (disable: boolean) => {
  try {
    // flip ref first for synchronous reads
    multiTouchActiveRef.current = disable;
    // call any native methods available on the drawing refs to stop current stroke
    canvasRefs.current.forEach((c) => {
      if (!c) return;
      // Preferred API: if the native module exposes a direct boolean setter
      if (typeof (c as any).setDrawingEnabled === 'function') {
        (c as any).setDrawingEnabled(!disable ? true : false);
      }
      // Common cancel/finish methods that native drawing libs sometimes provide
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
        // If re-enabling, ensure drawing mode restored if API exists
        if (typeof (c as any).setDrawingEnabled === 'function') {
          (c as any).setDrawingEnabled(true);
        }
      }
    });
  } catch (e) {
    console.warn('[FormImageEditor] disableDrawingImmediately error', e);
  }

  // update React state too (for pointerEvents / drawingEnabled prop)
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

    onPanResponderGrant: (evt) => {
      const touches = evt.nativeEvent.touches || [];
      const pageIndex = getCurrentPageIndex();
      const currentScale = lastScalePerPageRef[pageIndex] ?? 1;

      // If two fingers — mark multitouch active so drawing is disabled
      if (touches.length === 2) {
        setMultiTouchActive(true);
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
          startScale: currentScale,
          pageIndex,
          startMidpoint: { x: midX, y: midY },
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
        // one-finger pan when zoomed and writing disabled
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
        // For single-finger start we don't modify multiTouchActive
      }
    },

    onPanResponderMove: (evt, gestureState) => {
      const touches = evt.nativeEvent.touches || [];
      const pageIndex = getCurrentPageIndex();
      const currentScale = lastScalePerPageRef[pageIndex] ?? 1;

      // TWO-FINGER: handle pinch scale AND two-finger pan via midpoint delta
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
            startScale: currentScale,
            pageIndex,
            startMidpoint: { x: midX, y: midY },
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

        const { initialDistance, startScale, startMidpoint } = pinchStateRef.current;
        // scale
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

        // two-finger pan using midpoint delta (relative to start)
        const panStart = panStartPerPageRef[pageIndex] ?? { x: 0, y: 0 };
        const deltaX = midX - (startMidpoint?.x ?? midX);
        const deltaY = midY - (startMidpoint?.y ?? midY);

        // apply delta to starting translate
        const rawTx = panStart.x + deltaX;
        const rawTy = panStart.y + deltaY;

        const { clampedX, clampedY } = clampPanForPage(pageIndex, rawTx, rawTy, requestedScale);
        pageTranslateXRef[pageIndex].setValue(clampedX);
        pageTranslateYRef[pageIndex].setValue(clampedY);

        return;
      }

      // ONE-FINGER PAN when zoomed (only allowed when writing disabled)
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

      // Turn off multitouch flag when gesture ends
      setMultiTouchActive(false);

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
        } catch (e) {}
      }

      pinchStateRef.current = null;
      activePanPageRef.current = null;
    },

    onPanResponderTerminationRequest: () => true,

    onPanResponderTerminate: () => {
      const pageIndex = getCurrentPageIndex();
      const currentScale = lastScalePerPageRef[pageIndex] ?? 1;

      // Also clear multitouch flag on termination
      setMultiTouchActive(false);

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
        } catch (e) {}
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

  const APP_FILES_DIR = '/data/data/com.doctor/files';

  const makePageFilePath = (pageIndex: number) => {
    const safeKey = (STORAGE_KEY || DEFAULT_STORAGE_KEY).replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );
    const filename = `drawing_${safeKey}_page_${pageIndex + 1}.png`;
    return `${APP_FILES_DIR}/${filename}`;
  };

  const onSaveAll = async () => {
    if (saveStatus === 'saving') return;

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

    const uiPayload = {
      color,
      penWidth,
      eraserWidth,
    };

    const fullSaveBlob = {
      bitmaps: allMeta,
      voiceNotes,
      imageStickers,
    };

    try {
      if (AsyncStorage) {
        await AsyncStorage.setItem(STORAGE_UI_KEY, JSON.stringify(uiPayload));
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fullSaveBlob));
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
        voiceNotes,
        imageStickers,
      };
      lastPayloadRef.current = payload;

      // Only show success message, don't navigate yet
      setSaveStatus('success');
      
    } catch (err) {
      console.warn('[onSaveAll] Error saving', err);
      setSaveStatus('error');
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
        imageStickers, // This already includes stickerType for each sticker
      };

    setSaveStatus('idle');
    
    // Navigate only when user clicks OK
    navigation.navigate('FormImageScreen', {
      savedStrokes: savedMeta,
      voiceNotes,
      imageStickers, // ✅ stickerType is included here
      storageKey: STORAGE_KEY,
      formName: route.params?.formName,
      formKey: formKeyParam,
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
          <TouchableOpacity
            onPress={onSaveAll}
            style={styles.saveButton}
            disabled={saveStatus === 'saving'}
          >
            <Text style={styles.saveButtonText}>SAVE</Text>
          </TouchableOpacity>
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
              <View
                style={[
                  styles.colorCircle,
                  { backgroundColor: color },
                ]}
              />
              <Text style={styles.toolButtonText}>Color</Text>
            </TouchableOpacity>

            {/* ➕ Add Text icon (typed text) */}
            <TouchableOpacity
              onPress={handleAddTextIconPress}
              style={[
                styles.toolButton,
                !writingEnabled && styles.toolsDisabled,
              ]}
              disabled={saveStatus === 'saving' || !writingEnabled}
            >
              <MaterialCommunityIcons
                name="format-text"
                size={20}
                color={writingEnabled ? "#ffffff" : "rgba(255,255,255,0.6)"}
              />
              <Text style={styles.toolButtonText}>Text</Text>
            </TouchableOpacity>

            {/* Undo / Redo / Clear group */}
            <View style={styles.toolGroup}>
              <TouchableOpacity
                onPress={performUndo}
                style={[
                  styles.toolButton,
                  !writingEnabled && styles.toolsDisabled,
                ]}
                disabled={saveStatus === 'saving' || !writingEnabled}
              >
                <Ionicons 
                  name="arrow-undo" 
                  size={20} 
                  color={writingEnabled ? "#fff" : "rgba(255,255,255,0.6)"} 
                />
                <Text style={styles.toolButtonText}>Undo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={performRedo}
                style={[
                  styles.toolButton,
                  !writingEnabled && styles.toolsDisabled,
                ]}
                disabled={saveStatus === 'saving' || !writingEnabled}
              >
                <Ionicons 
                  name="arrow-redo" 
                  size={20} 
                  color={writingEnabled ? "#fff" : "rgba(255,255,255,0.6)"} 
                />
                <Text style={styles.toolButtonText}>Redo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={performClear}
                style={[
                  styles.toolButton,
                  !writingEnabled && styles.toolsDisabled,
                ]}
                disabled={saveStatus === 'saving' || !writingEnabled}
              >
                <MaterialCommunityIcons 
                  name="broom" 
                  size={20} 
                  color={writingEnabled ? "#fff" : "rgba(255,255,255,0.6)"} 
                />
                <Text style={styles.toolButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {/* Patient Sticker */}
            <TouchableOpacity
              onPress={handlePatientStickerPress}
              style={[
                styles.toolButton,
                !writingEnabled && styles.toolsDisabled,
              ]}
              disabled={saveStatus === 'saving' || !writingEnabled}
            >
              <Ionicons 
                name="person" 
                size={20} 
                color={writingEnabled ? "#ffffff" : "rgba(255,255,255,0.6)"} 
              />
              <Text style={styles.toolButtonText}>Patient Sticker</Text>
            </TouchableOpacity>

            {/* Doctor Sticker */}
            <TouchableOpacity
              onPress={handleDoctorStickerPress}
              style={[
                styles.toolButton,
                !writingEnabled && styles.toolsDisabled,
              ]}
              disabled={saveStatus === 'saving' || !writingEnabled}
            >
              <FontAwesome6 
                name="user-doctor" 
                size={20} 
                color={writingEnabled ? "#ffffff" : "rgba(255,255,255,0.6)"} 
              />
              <Text style={styles.toolButtonText}>Doctor Sticker</Text>
            </TouchableOpacity>

            {/* Pen / Eraser group */}
            <View style={styles.toolGroup}>
              {/* Pen */}
              <TouchableOpacity
                onPress={activatePen}
                style={[
                  styles.toolChip,
                  tool === 'pen' && styles.toolChipActive,
                  !writingEnabled && styles.toolsDisabled,
                ]}
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
                  onPress={() =>
                    setThicknessTool((prev) => (prev === 'pen' ? null : 'pen'))
                  }
                  style={styles.thicknessToggle}
                  disabled={saveStatus === 'saving' || !writingEnabled}
                >
                  <Ionicons
                    name={
                      thicknessPanelOpen && thicknessTool === 'pen'
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
                    size={16}
                    color={tool === 'pen' ? '#0EA5A4' : (writingEnabled ? '#ffffff' : 'rgba(255,255,255,0.6)')}
                  />
                </TouchableOpacity>
              </TouchableOpacity>

              {/* Eraser */}
              <TouchableOpacity
                onPress={activateEraser}
                style={[
                  styles.toolChip,
                  tool === 'eraser' && styles.toolChipActive,
                  !writingEnabled && styles.toolsDisabled,
                ]}
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
                  onPress={() =>
                    setThicknessTool((prev) =>
                      prev === 'eraser' ? null : 'eraser'
                    )
                  }
                  style={styles.thicknessToggle}
                  disabled={saveStatus === 'saving' || !writingEnabled}
                >
                  <Ionicons
                    name={
                      thicknessPanelOpen && thicknessTool === 'eraser'
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
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
                  c.toUpperCase() === color.toUpperCase()
                    ? styles.gridSwatchActive
                    : undefined,
                ]}
                disabled={saveStatus === 'saving' || !writingEnabled}
              >
                <View style={[styles.gridSwatch, { backgroundColor: c }]} />
                {c.toUpperCase() === '#FFFFFF' && (
                  <View style={styles.whiteSwatchBorder} />
                )}
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
          contentContainerStyle={{
            alignItems: 'center',
            paddingTop: 8,
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
          scrollEnabled={!writingEnabled ? true : scrollEnabled}
        >
          {IMAGES.length === 0 ? (
            <View style={styles.noImagesContainer}>
              <Text style={styles.noImagesText}>
                No images found for form: {formKeyParam || 'Unknown'}
              </Text>
              <Text style={styles.noImagesSubText}>
                Available forms: {Object.keys(IMAGES_BY_FORM).join(', ')}
              </Text>
            </View>
          ) : (
            IMAGES.map((src, pageIndex) => {
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
                      <Image
                        source={src}
                        style={styles.pageImage}
                        resizeMode="stretch"
                      />

                      {/* Canvas container - CRITICAL FIX: Prevent drawing when interacting with UI elements */}
                      <View
                        style={styles.canvasContainer}
                       pointerEvents={
  editingNoteId ||
  editingStickerId ||
  !writingEnabled ||
  multiTouchActive
    ? 'none'
    : 'box-none'
}
                      >
          <DrawingCanvas
  index={pageIndex}
  savedPath={savedPath}
  ref={(r) => refSetters.current[pageIndex](r)}
  drawingEnabled={!(editingNoteId || editingStickerId) && !multiTouchActive}
/>


                      </View>

                      {/* Voice notes with writingEnabled prop */}
                      {notesForPage.map((note) => (
                        <DraggableVoiceText
                          key={note.id}
                          note={note}
                          isEditing={editingNoteId === note.id}
                          onToggleEdit={(id) => {
                            if (!writingEnabled) return;
                            setEditingNoteId((prev) =>
                              prev === id ? null : id
                            );
                            setEditingStickerId(null);
                          }}
                          onPositionChange={handleVoiceNotePositionChange}
                          onBoxSizeChange={handleVoiceNoteBoxChange}
                          onDelete={handleVoiceNoteDelete}
                          onChangeText={handleVoiceNoteTextChange}
                          onChangeFontSize={handleVoiceNoteFontSizeChange}
                          pageScale={lastScalePerPageRef[pageIndex]}
                          writingEnabled={writingEnabled}
                        />
                      ))}

                      {/* Image stickers with writingEnabled prop */}
                      {stickersForPage.map((sticker) => (
                        <DraggableImageSticker
                          key={sticker.id}
                          sticker={sticker}
                          isEditing={editingStickerId === sticker.id}
                          onToggleEdit={(id) => {
                            if (!writingEnabled) return;
                            setEditingStickerId((prev) =>
                              prev === id ? null : id
                            );
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

      {/* 🔍 Zoom +/- buttons */}
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

      {/* 🔊 floating mic FAB */}
      <TouchableOpacity
        style={[
          styles.voiceFab,
          { bottom: (insets.bottom ?? 0) + 24 },
          !writingEnabled && styles.toolsDisabled,
        ]}
        activeOpacity={0.8}
        onPress={handleVoiceFabPress}
        disabled={saveStatus === 'saving' || !writingEnabled}
      >
        <Ionicons name="mic" size={24} color="#fff" />
      </TouchableOpacity>

      {/* "Editing mode Off" bubble */}
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

      {/* Sticker modal */}
      <Modal
        visible={stickerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStickerModalVisible(false)}
      >
        <View style={styles.stickerModalBackdrop}>
          <View style={styles.stickerModalContent}>
            <Text style={styles.stickerModalTitle}>
              Add {selectedStickerType === 'doctor' ? 'Doctor' : 'Patient'} sticker
            </Text>
            <Image
              source={selectedStickerType === 'doctor' ? DOCTOR_STICKER_SOURCE : PATIENT_STICKER_SOURCE}
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
                  if (selectedStickerType) {
                    addImageSticker(selectedStickerType);
                  }
                  setStickerModalVisible(false);
                  setSelectedStickerType(null);
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
              autoFocus
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

      {/* 🔽 Thickness dropdown panel */}
      {thicknessPanelOpen && thicknessTool && writingEnabled && (
        <View
          style={[
            styles.thicknessPanel,
            { top: topPadding + 150 },
          ]}
        >
          <View style={styles.thicknessHeaderRow}>
            <Text style={styles.thicknessTitle}>
              {thicknessTool === 'pen' ? 'Pen thickness' : 'Eraser thickness'}
            </Text>
            <TouchableOpacity onPress={() => setThicknessTool(null)}>
              <Ionicons name="chevron-up" size={18} color="#111827" />
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
            <TouchableOpacity
              style={styles.voiceCloseButton}
              onPress={handleVoiceClose}
            >
              <Ionicons name="close" size={24} color="#9ca3af" />
            </TouchableOpacity>

            <Text style={styles.voiceTitle}>Google</Text>
            <Text style={styles.voiceSubtitle}>
              {voiceListening ? voiceText || 'Listening...' : 'Processing...'}
            </Text>

            <View style={styles.voiceMicContainer}>
              {voiceListening && (
                <View
                  style={[
                    styles.voiceMicPulse,
                    { borderColor: '#2563eb' },
                  ]}
                />
              )}
              <TouchableOpacity
                style={[
                  styles.voiceMicButton,
                  voiceListening && styles.voiceMicButtonActive,
                ]}
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

            {voiceError ? (
              <Text style={styles.voiceErrorText}>{voiceError}</Text>
            ) : null}
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
  root: { 
    flex: 1, 
    backgroundColor: '#0EA5A4' 
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
  noImagesSubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
    top: -30,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffffee',
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 5,
  },

  fontSizeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
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
});
