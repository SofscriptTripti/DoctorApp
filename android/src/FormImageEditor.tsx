// FormImageEditor.updated.tsx
// Smooth drawing + absolute coords + shade strip (white -> color -> black)
// Horizontal swatches row (scrollable) above thickness
// Selected tool/action icons show colored circular background
// Clear performs immediate clear (no Alert)

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  PanResponder,
  GestureResponderEvent,
  LayoutChangeEvent,
  findNodeHandle,
  UIManager,
  ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute } from '@react-navigation/native';

let SketchCanvas: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const mod = require('@terrylinla/react-native-sketch-canvas');
  SketchCanvas = mod?.default ?? mod;
} catch (e) {
  SketchCanvas = undefined;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// local image uploaded in session (developer-provided)
const IMAGE_URI = 'https://cdn.marketing123.123formbuilder.com/wp-content/uploads/2020/12/hospital-admission-form.png';

type Point = { x: number; y: number; t?: number };
type Stroke = { id: string; color: string; width: number; points: Point[] };

export default function FormImageEditor() {
  const route = useRoute();
  const navigation = useNavigation<any>();

  const [color, setColor] = useState('#FF7A00');
  const [strokeWidth, setStrokeWidth] = useState(12);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [saving, setSaving] = useState(false);
  const [pathsCount, setPathsCount] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  const [useNative, setUseNative] = useState<boolean>(!!SketchCanvas);
  const nativeAvailable = useNative && !!SketchCanvas;

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const widthRef = useRef(strokeWidth);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { widthRef.current = strokeWidth; }, [strokeWidth]);

  // visible preset swatches
  const PRESET_COLORS = [ '#FF7A00', '#FF0000', '#00A86B', '#007AFF', '#8A2BE2', '#FFD700','#000000', '#444444', '#777777',];

  const canvasRef = useRef<any>(null);
  const canvasTopAbs = useRef(0);
  const canvasLeftAbs = useRef(0);
  const canvasHeightRef = useRef(Math.round(SCREEN_H * 0.72));
  const canvasWidthRef = useRef(SCREEN_W);

  const hueRef = useRef<any>(null);
  const hueTopAbs = useRef(0);
  const hueHeightAbs = useRef(Math.round(SCREEN_H * 0.5));

  const measureCanvas = () => {
    try {
      const handle = findNodeHandle(canvasRef.current);
      if (!handle) return;
      UIManager.measure(handle, (x, y, w, h, px, py) => {
        canvasLeftAbs.current = px;
        canvasTopAbs.current = py;
        canvasWidthRef.current = w;
        canvasHeightRef.current = h;
      });
    } catch (e) { /* ignore */ }
  };

  const measureHue = () => {
    try {
      const handle = findNodeHandle(hueRef.current);
      if (!handle) return;
      UIManager.measure(handle, (x, y, w, h, px, py) => {
        hueTopAbs.current = py;
        hueHeightAbs.current = h;
      });
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    const t = setTimeout(() => { measureCanvas(); measureHue(); }, 250);
    return () => clearTimeout(t);
  }, [imageLoaded]);

  useEffect(() => {
    const onResize = () => { measureCanvas(); measureHue(); };
    const sub: any = Dimensions.addEventListener ? Dimensions.addEventListener('change', onResize) : null;
    return () => { if (sub && (sub as any).remove) (sub as any).remove(); };
  }, []);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);

  // smoothing helpers
  const dist2 = (a: Point, b: Point) => { const dx = a.x - b.x; const dy = a.y - b.y; return dx * dx + dy * dy; };

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

  const computePath = (pts?: Point[]) => {
    if (!pts || pts.length === 0) return '';
    return catmullRom2bezier(pts);
  };

  const onHueLayout = (ev: LayoutChangeEvent) => { measureHue(); };

  // Shade helpers (white -> base -> black)
  const hexToRgb = (hex: string) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(full, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  };
  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (v: number) => {
      const h = Math.round(Math.max(0, Math.min(255, Math.round(v)))).toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  };
  const mixRgb = (a: {r:number,g:number,b:number}, b: {r:number,g:number,b:number}, t: number) => ({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });

  const onPickShadeByPageY = (pageY: number) => {
    const top = hueTopAbs.current || 0;
    const h = hueHeightAbs.current || Math.round(SCREEN_H * 0.5);
    const rel = Math.max(0, Math.min(h, pageY - top));
    const ratio = rel / h; // 0..1 (0=top)

    const baseHex = colorRef.current || color;
    const baseRgb = hexToRgb(baseHex);
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };

    let mixedRgb;
    if (ratio <= 0.5) {
      const t = ratio / 0.5;
      mixedRgb = mixRgb(white, baseRgb, t);
    } else {
      const t = (ratio - 0.5) / 0.5;
      mixedRgb = mixRgb(baseRgb, black, t);
    }

    const hex = rgbToHex(mixedRgb.r, mixedRgb.g, mixedRgb.b);
    setColor(hex);
  };

  // Draw responder
  const MIN_DIST2 = 0.5;
  const FORCE_ADD_MS = 30;
  const ERASER_MIN_MOVE = 10;

  const rafPending = useRef(false);
  const pendingReplace = useRef<Stroke | null>(null);
  const lastPointTime = useRef<number>(0);
  const eraserMoved = useRef(false);
  const eraserStart = useRef<Point | null>(null);

  // Improved flush: replace by id (safer if other updates happen)
  const flushPending = () => {
    if (!rafPending.current) return;
    rafPending.current = false;
    const p = pendingReplace.current;
    if (!p) return;
    setStrokes(prev => {
      const idx = prev.findIndex(st => st.id === p.id);
      if (idx !== -1) {
        const copy = prev.slice();
        copy[idx] = { ...p };
        return copy;
      }
      // if not found, append (this can happen if updates raced)
      return [...prev, { ...p }];
    });
    pendingReplace.current = null;
  };

  useEffect(() => {
    let rafId: number | null = null;
    const loop = () => { if (rafPending.current) flushPending(); rafId = requestAnimationFrame(loop); };
    rafId = requestAnimationFrame(loop);
    return () => { if (rafId != null) cancelAnimationFrame(rafId); };
  }, []);

  const shouldAddPoint = (last: Point, next: Point) => {
    const now = Date.now();
    const d2 = dist2(last, next);
    if (d2 >= MIN_DIST2) return true;
    if (now - (lastPointTime.current || 0) >= FORCE_ADD_MS) return true;
    return false;
  };

  const pageToCanvas = (pageX: number, pageY: number) => ({ x: pageX - canvasLeftAbs.current, y: pageY - canvasTopAbs.current });

  const jsDrawResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        measureCanvas(); measureHue();
        const pageX = evt.nativeEvent.pageX;
        const pageY = evt.nativeEvent.pageY;
        const loc = pageToCanvas(pageX, pageY);
        const pt: Point = { x: loc.x, y: loc.y, t: Date.now() };

        if (toolRef.current === 'pen') {
          const s: Stroke = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, color: colorRef.current, width: widthRef.current, points: [pt] };
          currentStroke.current = s;
          lastPointTime.current = pt.t || Date.now();
          // append safely using functional update
          setStrokes(prev => [...prev, s]);
        } else {
          eraserStart.current = pt; eraserMoved.current = false;
        }
      },

      onPanResponderMove: (evt: GestureResponderEvent) => {
        const pageX = evt.nativeEvent.pageX;
        const pageY = evt.nativeEvent.pageY;
        const loc = pageToCanvas(pageX, pageY);
        const pt: Point = { x: loc.x, y: loc.y, t: Date.now() };

        if (toolRef.current === 'pen') {
          if (!currentStroke.current) return;
          const last = currentStroke.current.points[currentStroke.current.points.length - 1];
          if (!shouldAddPoint(last, pt)) return;

          currentStroke.current.points.push(pt);
          lastPointTime.current = pt.t || Date.now();
          // create a shallow copy for pending replace
          pendingReplace.current = { ...currentStroke.current, points: currentStroke.current.points.slice() };
          rafPending.current = true;
        } else {
          if (eraserStart.current && !eraserMoved.current) {
            const dx = eraserStart.current.x - pt.x; const dy = eraserStart.current.y - pt.y;
            if (dx * dx + dy * dy >= ERASER_MIN_MOVE * ERASER_MIN_MOVE) eraserMoved.current = true; else return;
          }
          if (!eraserMoved.current) return;
          const x = pt.x, y = pt.y;
          // better eraser: remove strokes whose bounding box intersects eraser point
          setStrokes(prev => prev.filter(st => {
            if (!st.points || st.points.length === 0) return true;
            let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY, minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
            for (let p of st.points) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
            const pad = Math.max(12, Math.round(st.width || 12));
            const inside = x >= minX - pad && x <= maxX + pad && y >= minY - pad && y <= maxY + pad;
            return !inside;
          }));
        }
      },

      onPanResponderRelease: () => {
        // flush any pending replace one last time synchronously
        if (pendingReplace.current) {
          const p = pendingReplace.current;
          setStrokes(prev => {
            const idx = prev.findIndex(st => st.id === p.id);
            if (idx !== -1) {
              const copy = prev.slice();
              copy[idx] = { ...p };
              return copy;
            }
            return [...prev, { ...p }];
          });
          pendingReplace.current = null; rafPending.current = false;
        }
        eraserMoved.current = false; eraserStart.current = null; currentStroke.current = null; lastPointTime.current = 0;
      },

      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {},
    })
  ).current;

  const jsUndo = () => setStrokes(prev => prev.slice(0, -1));
  const jsClear = () => setStrokes([]);
  const jsSave = async () => {
    try {
      setSaving(true);
      const w = canvasWidthRef.current || SCREEN_W;
      const h = canvasHeightRef.current || Math.round(SCREEN_H * 0.72);
      const svgPaths = strokes.map(s => `<path d="${computePath(s.points)}" stroke="${s.color}" stroke-width="${s.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svgPaths}</svg>`;
      // keep behavior minimal - show small confirmation only for native save callback; here we just stop spinner
    } catch (e) {
      // ignore for fallback
    } finally {
      setSaving(false);
    }
  };

  // UI "active" button state for short-lived actions (undo/clear/save) to show circle while pressed
  const [activeBtn, setActiveBtn] = useState<string | null>(null);

  const onUndo = () => {
    // show quick active state
    setActiveBtn('undo');
    setTimeout(() => setActiveBtn(null), 200);
    if (nativeAvailable) {
      try { canvasRef.current?.undo(); } catch (e) { console.warn(e); }
    } else jsUndo();
  };

  // Clear now performs immediately (no Alert)
  const onClear = () => {
    setActiveBtn('clear');
    setTimeout(() => setActiveBtn(null), 200);
    if (nativeAvailable) {
      try { canvasRef.current?.clear(); } catch (e) { console.warn(e); }
    } else jsClear();
  };

  const onSave = () => {
    setActiveBtn('save');
    setTimeout(() => setActiveBtn(null), 300);
    if (nativeAvailable) {
      setSaving(true);
      try {
        canvasRef.current?.save('png', false, 'RNPencil', String(Date.now()), false, false, false);
      } catch (e) {
        setSaving(false);
        console.warn('Native save failed', e);
      }
    } else jsSave();
  };

  useEffect(() => { setPathsCount(strokes.length); }, [strokes]);

  const onSelectPreset = (hex: string) => {
    setColor(hex);
    colorRef.current = hex;
  };

  const HueStrip = () => {
    const stripHeight = Math.round(SCREEN_H * 0.5);
    const pan = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: evt => { onPickShadeByPageY(evt.nativeEvent.pageY); },
        onPanResponderMove: evt => { onPickShadeByPageY(evt.nativeEvent.pageY); },
        onPanResponderRelease: () => {},
      })
    ).current;

    return (
      <View ref={hueRef} onLayout={onHueLayout} style={styles.hueContainer} {...pan.panHandlers}>
        <LinearGradient style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} colors={[ '#FFFFFF', color, '#000000' ]} />
      </View>
    );
  };

  const NibPreview = ({ size = 36 }: { size?: number }) => (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: Math.max(6, Math.round((strokeWidth / 40) * size)), height: Math.max(6, Math.round((strokeWidth / 40) * size)), borderRadius: 100, backgroundColor: '#fff', opacity: 0.95 }} />
      </View>
    </View>
  );

  const incWidth = (delta = 1) => { const next = Math.min(60, Math.max(1, strokeWidth + delta)); setStrokeWidth(next); widthRef.current = next; };
  const decWidth = (delta = 1) => { const next = Math.min(60, Math.max(1, strokeWidth - delta)); setStrokeWidth(next); widthRef.current = next; };

  // helper to get button style for circular colored background when active/selected
  const btnCircleStyle = (name: string, fallback?: boolean) => {
    const isSelected = (name === 'pen' && tool === 'pen') || (name === 'eraser' && tool === 'eraser');
    const isActive = activeBtn === name;
    if (isSelected || isActive) {
      return [styles.iconBtn, styles.iconSelected];
    }
    // default icon look
    return [styles.iconBtn, { backgroundColor: fallback ? 'rgba(255,255,255,0.04)' : 'transparent' }];
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={btnCircleStyle('close', true)} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={btnCircleStyle('pen')} onPress={() => { setTool('pen'); }}>
          <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={btnCircleStyle('eraser')} onPress={() => { setTool('eraser'); }}>
          <MaterialCommunityIcons name="eraser" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={btnCircleStyle('undo')} onPress={onUndo}>
          <Ionicons name="arrow-undo-outline" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={btnCircleStyle('clear')} onPress={onClear}>
          <MaterialCommunityIcons name="broom" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={btnCircleStyle('save')} onPress={onSave}>
          <Ionicons name={saving ? 'cloud-download' : 'save-outline'} size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.canvasWrap} ref={canvasRef} onLayout={() => { measureCanvas(); }}>
        <Image source={{ uri: IMAGE_URI }} style={styles.backgroundImage} resizeMode="contain" onLoad={() => { setImageLoaded(true); }} onError={() => setImageLoaded(true)} />

        {nativeAvailable ? (
          // @ts-ignore
          <SketchCanvas
            ref={canvasRef}
            style={styles.canvas}
            strokeColor={tool === 'eraser' ? '#FFFFFF' : color}
            strokeWidth={strokeWidth}
            onSketchSaved={(success: boolean, path: string) => {
              setSaving(false);
              // keep minimal feedback; logs will show saved path on successful native save
            }}
            onPathsChange={(cnt: number) => setPathsCount(cnt)}
            user={'user'}
          />
        ) : (
          <View style={styles.canvas} {...jsDrawResponder.panHandlers}>
            <Svg width={canvasWidthRef.current} height={canvasHeightRef.current}>
              {strokes.map(s => {
                const d = computePath(s.points);
                if (!d) return null;
                return <Path key={s.id} d={d} stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
              })}
            </Svg>
          </View>
        )}
      </View>

      {/* Right vertical shade strip */}
      <View style={styles.rightStrip}>
        <HueStrip />
        <View style={{ height: 8 }} />
        <TouchableOpacity style={[styles.quickColor, { backgroundColor: color }]} onPress={() => { setColor('#FFFFFF'); colorRef.current = '#FFFFFF'; }} />
        <View style={{ height: 6 }} />
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]} onPress={() => setUseNative(v => !v)}><Text style={{ color: '#fff', fontSize: 11 }}>{useNative ? 'Native' : 'JS'}</Text></TouchableOpacity>
      </View>

      {/* Bottom: scrollable swatches row + thickness */}
      <View style={styles.bottomBar}>
        <View style={{ width: '100%' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchScroll}>
            {PRESET_COLORS.map(c => {
              const selected = c.toUpperCase() === (colorRef.current || color).toUpperCase();
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => { onSelectPreset(c); }}
                  style={[
                    styles.swatchWrap,
                    selected ? { borderColor: '#0EA5A4', borderWidth: 2 } : { borderColor: '#ddd', borderWidth: 0.9 }
                  ]}
                >
                  <View style={[styles.swatch, { backgroundColor: c }]} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.thicknessRow}>
            <TouchableOpacity style={styles.thinBtn} onPress={() => decWidth(1)}><Ionicons name="remove-circle-outline" size={26} color="#333" /></TouchableOpacity>

            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <Slider value={strokeWidth} minimumValue={1} maximumValue={60} step={1} onValueChange={(v) => { setStrokeWidth(Math.round(v)); widthRef.current = Math.round(v); }} thumbTintColor={color} />
            </View>

            <TouchableOpacity style={styles.thinBtn} onPress={() => incWidth(1)}><Ionicons name="add-circle-outline" size={26} color="#333" /></TouchableOpacity>

            <View style={{ alignItems: 'center', width: 64 }}>
              <NibPreview size={56} />
              <Text style={{ fontSize: 12, color: '#333' }}>{strokeWidth}px</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.7)' },
  iconBtn: { padding: 8, borderRadius: 24, marginHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  iconSelected: { backgroundColor: '#0EA5A4' },
  canvasWrap: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  backgroundImage: { position: 'absolute', width: SCREEN_W, height: Math.round(SCREEN_H * 0.72) },
  canvas: { position: 'absolute', top: 0, left: 0, width: SCREEN_W, height: Math.round(SCREEN_H * 0.72) },
  rightStrip: { position: 'absolute', right: 12, top: 80, alignItems: 'center' },
  hueContainer: { width: 36, height: Math.round(SCREEN_H * 0.5), borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#111' },
  bottomBar: { backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 12 },
  swatchScroll: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6 },
  swatchWrap: { padding: 2, borderRadius: 22, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 18 },
  quickColor: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 0.5, borderColor: '#ddd' },
  thicknessRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  thinBtn: { padding: 4, marginHorizontal: 4, justifyContent: 'center', alignItems: 'center' },
});
