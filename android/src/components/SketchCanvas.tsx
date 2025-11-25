// src/components/SketchCanvas.tsx
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Path as SkPathView, Skia, Path as SkiaPath } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// Types
type Point = { x: number; y: number };
type Bounds = { xMin: number; xMax: number; yMin: number; yMax: number };

type PathItem = {
  id: string;
  color: string;
  width: number;
  erase?: boolean;
  skPath: SkiaPath;
  points: Point[];   // point list for hit tests & rebuilding
  bounds: Bounds;
};

type Snapshot = PathItem[]; // shallow clone array of PathItem entries
type HistoryEntry = { prev: Snapshot; next: Snapshot };

export type SketchCanvasHandle = {
  getPaths: () => PathItem[];
  addPath: (item: PathItem) => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
};

type Props = {
  width: number;
  height: number;
  strokeColor?: string;
  strokeWidth?: number;
  eraseMode?: boolean;
  onStrokeStart?: (evt: { x: number; y: number }) => void;
  onStrokeMove?: (evt: { x: number; y: number }) => void;
  onStrokeEnd?: (meta: { id: string; color: string; width: number; erase?: boolean }[]) => void;
  style?: any;
};

// helpers
const computeBounds = (points: Point[]): Bounds => {
  if (!points || points.length === 0) return { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  let xMin = points[0].x, xMax = points[0].x, yMin = points[0].y, yMax = points[0].y;
  for (const p of points) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  return { xMin, xMax, yMin, yMax };
};
const inflateBounds = (b: Bounds, pad: number): Bounds => ({ xMin: b.xMin - pad, xMax: b.xMax + pad, yMin: b.yMin - pad, yMax: b.yMax + pad });
const intersects = (a: Bounds, b: Bounds) => !(a.xMax < b.xMin || a.xMin > b.xMax || a.yMax < b.yMin || a.yMin > b.yMax);
const distSq = (a: Point, b: Point) => { const dx = a.x - b.x; const dy = a.y - b.y; return dx*dx + dy*dy; };

// rebuild Skia Path from points
const buildSkPathFromPoints = (points: Point[]) => {
  const p = Skia.Path.Make();
  if (!points || points.length === 0) return p;
  p.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) p.lineTo(points[i].x, points[i].y);
  return p;
};

const touchedPoint = (pt: Point, eraserPts: Point[], thr: number) => {
  const thrSq = thr * thr;
  for (let i = 0; i < eraserPts.length; i++) {
    if (distSq(pt, eraserPts[i]) <= thrSq) return true;
  }
  return false;
};

const SketchCanvas = forwardRef<SketchCanvasHandle, Props>((props, ref) => {
  const {
    width, height,
    strokeColor = '#000000',
    strokeWidth = 4,
    eraseMode = false,
    onStrokeStart, onStrokeMove, onStrokeEnd, style
  } = props;

  // immutable render list (React uses this)
  const [renderPaths, setRenderPaths] = useState<PathItem[]>([]);

  // mutable authoritative refs for perf
  const pathsRef = useRef<PathItem[]>([]);
  const historyRef = useRef<HistoryEntry[]>([]); // undo history
  const redoRef = useRef<HistoryEntry[]>([]);    // redo stack
  const currentRef = useRef<PathItem | null>(null); // current stroke (pen or eraser)
  const currentEraserRemovedRef = useRef<PathItem[] | null>(null); // stores removed pieces during current eraser action
  const rafScheduled = useRef(false);

  const scheduleFlush = () => {
    if (rafScheduled.current) return;
    rafScheduled.current = true;
    requestAnimationFrame(() => {
      rafScheduled.current = false;
      setRenderPaths(pathsRef.current.slice());
    });
  };

  const snapshot = (): Snapshot => pathsRef.current.slice();

  // record history entry (prev->next) and clear redo stack
  const pushHistoryEntry = (prevSnap: Snapshot, nextSnap: Snapshot) => {
    historyRef.current.push({ prev: prevSnap, next: nextSnap });
    redoRef.current = [];
  };

  // create path item helper
  const createPathItem = (start: Point, color: string, widthPx: number, isEraser = false): PathItem => {
    const skPath = Skia.Path.Make();
    skPath.moveTo(start.x, start.y);
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      color,
      width: widthPx,
      erase: isEraser,
      skPath,
      points: [start],
      bounds: { xMin: start.x, xMax: start.x, yMin: start.y, yMax: start.y },
    };
  };

  // Gesture: Pan with immediate erasing on move
  const pan = Gesture.Pan()
    .onStart(({ x, y }) => {
      const pt = { x, y };
      const color = eraseMode ? '#000000' : (strokeColor || '#000000');
      const item = createPathItem(pt, color, strokeWidth || 4, !!eraseMode);

      // snapshot before change
      const prev = snapshot();
      // provisional next after adding stroke (we push history now but may replace next later if eraser modifies)
      const next = prev.concat([item]);
      pushHistoryEntry(prev, next);

      // apply to authoritative list
      pathsRef.current = next;
      currentRef.current = item;
      if (eraseMode) currentEraserRemovedRef.current = []; // will collect removed originals/pieces

      scheduleFlush();
      onStrokeStart && onStrokeStart(pt);
    })
    .onUpdate(({ x, y }) => {
      const cur = currentRef.current;
      if (!cur) return;
      // append to skPath & points
      cur.skPath.lineTo(x, y);
      cur.points.push({ x, y });
      cur.bounds = computeBounds(cur.points);

      if (cur.erase) {
        // immediate incremental erase near this single eraser point
        // threshold: ~ 0.9 * eraser width
        const threshold = Math.max(10, Math.round((cur.width || 12) * 0.9));
        const eraserPoint = { x, y };
        // We will process each path and remove touched points segments on the fly.
        // For performance: do bbox quick-check first then do point scanning only for those that intersect.
        const newList: PathItem[] = [];
        const removedPieces: PathItem[] = currentEraserRemovedRef.current || [];

        for (const p of pathsRef.current) {
          // skip the eraser stroke itself (it is in pathsRef as last) - we don't want to process it
          if (p.id === cur.id) continue;

          // bbox quick test: if original path bbox is far from this eraser point, keep
          const smallBox = { xMin: eraserPoint.x - threshold, xMax: eraserPoint.x + threshold, yMin: eraserPoint.y - threshold, yMax: eraserPoint.y + threshold };
          if (!intersects(p.bounds, smallBox)) {
            newList.push(p);
            continue;
          }

          // we need to inspect points list and remove points close to current eraser point
          // We'll create segments of consecutive points not touched and keep them.
          const pts = p.points;
          let seg: Point[] | null = null;
          const keepSegments: Point[][] = [];
          for (let i = 0; i < pts.length; i++) {
            const pt = pts[i];
            const touched = distSq(pt, eraserPoint) <= (threshold * threshold);
            if (!touched) {
              if (!seg) seg = [];
              seg.push(pt);
            } else {
              if (seg && seg.length >= 2) { keepSegments.push(seg); seg = null; }
              else seg = null;
              // record removed small piece (for grouped undo) by collecting the touched point as a tiny piece
              // but better to collect whole removed original if we end up removing entire path — we will handle below
            }
          }
          if (seg && seg.length >= 2) keepSegments.push(seg);

          if (keepSegments.length === 0) {
            // entire original path removed (due to repeated eraser moves); add to removedPieces (store original as removed)
            removedPieces.push(p);
            // do not push anything to newList
            continue;
          }

          // otherwise, rebuild each keep segment into new PathItems and push them
          if (keepSegments.length === 1) {
            // small optimization: reuse original id for first surviving segment if it matches shape; but safer to create new id
            const segPts = keepSegments[0];
            const rebuilt = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
              color: p.color,
              width: p.width,
              erase: false,
              skPath: buildSkPathFromPoints(segPts),
              points: segPts.slice(),
              bounds: computeBounds(segPts),
            } as PathItem;
            newList.push(rebuilt);
          } else {
            // multiple segments -> create multiple path items
            for (const s of keepSegments) {
              if (s.length < 2) continue;
              const rebuilt = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
                color: p.color,
                width: p.width,
                erase: false,
                skPath: buildSkPathFromPoints(s),
                points: s.slice(),
                bounds: computeBounds(s),
              } as PathItem;
              newList.push(rebuilt);
            }
            // record original removed as removedPiece
            removedPieces.push(p);
          }
        } // end for each path

        // finally, rebuild pathsRef: start with newList and append the eraser stroke (we keep eraser stroke while user draws so UX indicates eraser path)
        // but we don't render eraser strokes (as earlier), so it's ok to include or exclude - include for correctness
        pathsRef.current = newList.concat([cur]);
        currentEraserRemovedRef.current = removedPieces;
      } // end if erase

      // schedule lightweight render flush
      scheduleFlush();
      onStrokeMove && onStrokeMove({ x, y });
    })
    .onEnd(() => {
      const cur = currentRef.current;
      if (!cur) {
        onStrokeEnd && onStrokeEnd(pathsRef.current.map(p => ({ id: p.id, color: p.color, width: p.width, erase: !!p.erase })));
        return;
      }

      if (cur.erase) {
        // finalize erase: remove the eraser stroke itself and form a grouped history entry already recorded at start
        // Our initial history entry recorded prev->(prev+eraser). We now need to replace that last history entry's next with the current transformed snapshot
        const prevHistory = historyRef.current[historyRef.current.length - 1];
        if (prevHistory) {
          const prevSnap = prevHistory.prev;
          const nextSnap = pathsRef.current.filter(p => p.id !== cur.id).slice(); // exclude eraser stroke itself from final data
          prevHistory.next = nextSnap;
        } else {
          // fallback: if no history entry (unlikely) push one
          pushHistoryEntry(snapshot(), pathsRef.current.filter(p => p.id !== cur.id));
        }

        // remove eraser stroke from authoritative list
        pathsRef.current = pathsRef.current.filter(p => p.id !== cur.id);
        // schedule final flush
        scheduleFlush();
      } else {
        // pen stroke: bounds already computed incrementally; nothing to finalize beyond already recorded history
      }

      // clear current refs
      currentRef.current = null;
      currentEraserRemovedRef.current = null;

      // emit meta
      onStrokeEnd && onStrokeEnd(pathsRef.current.map(p => ({ id: p.id, color: p.color, width: p.width, erase: !!p.erase })));
    })
    .onTouchesCancelled(() => {
      currentRef.current = null;
      currentEraserRemovedRef.current = null;
      scheduleFlush();
      onStrokeEnd && onStrokeEnd(pathsRef.current.map(p => ({ id: p.id, color: p.color, width: p.width, erase: !!p.erase })));
    });

  // Imperative API: getPaths, addPath, clear, undo, redo
  useImperativeHandle(ref, () => ({
    getPaths: () => pathsRef.current.slice(),
    addPath: (item: PathItem) => {
      // ensure skPath exists
      if (!item.skPath && item.points && item.points.length > 0) {
        item.skPath = buildSkPathFromPoints(item.points);
        item.bounds = computeBounds(item.points);
      }
      const prev = snapshot();
      const next = prev.concat([item]);
      pushHistoryEntry(prev, next);
      pathsRef.current = next;
      scheduleFlush();
      onStrokeEnd && onStrokeEnd(pathsRef.current.map(p => ({ id: p.id, color: p.color, width: p.width, erase: !!p.erase })));
    },
    clear: () => {
      const prev = snapshot();
      const next: Snapshot = [];
      pushHistoryEntry(prev, next);
      pathsRef.current = [];
      scheduleFlush();
      onStrokeEnd && onStrokeEnd([]);
    },
    undo: () => {
      const h = historyRef.current;
      if (h.length === 0) return;
      const entry = h.pop()!;
      // apply prev snapshot
      pathsRef.current = entry.prev.slice();
      // push onto redo stack
      redoRef.current.push(entry);
      scheduleFlush();
      onStrokeEnd && onStrokeEnd(pathsRef.current.map(p => ({ id: p.id, color: p.color, width: p.width, erase: !!p.erase })));
    },
    redo: () => {
      const r = redoRef.current;
      if (r.length === 0) return;
      const entry = r.pop()!;
      // reapply next snapshot
      pathsRef.current = entry.next.slice();
      // push back to history
      historyRef.current.push(entry);
      scheduleFlush();
      onStrokeEnd && onStrokeEnd(pathsRef.current.map(p => ({ id: p.id, color: p.color, width: p.width, erase: !!p.erase })));
    },
  }), [onStrokeEnd]);

  // Render: we draw all non-erase paths. (We intentionally do not render erase strokes.)
  return (
    <GestureDetector gesture={pan}>
      <View style={[{ width, height, position: 'absolute', left: 0, top: 0 }, style]}>
        <Canvas style={{ width, height }}>
          {renderPaths.map(p => {
            if (p.erase) return null;
            return (
              <SkPathView
                key={p.id}
                path={p.skPath}
                color={p.color}
                style="stroke"
                strokeWidth={p.width}
                strokeJoin="round"
                strokeCap="round"
              />
            );
          })}
        </Canvas>
      </View>
    </GestureDetector>
  );
});

export default SketchCanvas;
