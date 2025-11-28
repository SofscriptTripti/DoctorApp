// android/app/src/main/java/com/doctor/DrawingView.java
package com.doctor;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PointF;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.util.AttributeSet;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;

public class DrawingView extends View {

    private static final String TAG = "DrawingView";

    // Background form (from backgroundBase64, optional)
    private Bitmap bgBitmap;

    // Base overlay loaded from disk via savedPath (previous edits)
    private Bitmap baseOverlayBitmap;

    // Current working overlay (baseOverlay + this-session strokes)
    private Bitmap drawingBitmap;
    private Canvas drawingCanvas;

    // Stroke model (similar to your pure Java example)
    public static class Stroke {
        public int color;
        public float brushSize;
        public boolean isEraser;
        public boolean isHighlighter;
        public final ArrayList<PointF> points = new ArrayList<>();
    }

    private final ArrayList<Stroke> strokes = new ArrayList<>();
    private final ArrayList<Stroke> undoneStrokes = new ArrayList<>();
    private Stroke currentStroke;

    // Brush state
    private int currentColor = Color.BLACK;
    private float brushSize = 5f;
    private boolean isEraser = false;
    private boolean isHighlighter = false;

    // Base paint used for drawing onto overlay
    private final Paint paint;

    public DrawingView(Context context) {
        super(context);
        paint = createBasePaint();
    }

    public DrawingView(Context context, @Nullable AttributeSet attrs) {
        super(context, attrs);
        paint = createBasePaint();
    }

    private Paint createBasePaint() {
        Paint p = new Paint();
        p.setAntiAlias(true);
        p.setStrokeWidth(brushSize);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeJoin(Paint.Join.ROUND);
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setColor(currentColor);
        p.setAlpha(255);
        return p;
    }

    // ----------------------------------------------------
    // Bitmap / canvas helpers
    // ----------------------------------------------------

    private void ensureBitmap() {
        int w = getWidth();
        int h = getHeight();
        if (w <= 0 || h <= 0) return;

        if (drawingBitmap == null ||
                drawingBitmap.getWidth() != w ||
                drawingBitmap.getHeight() != h) {

            drawingBitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            drawingCanvas = new Canvas(drawingBitmap);

            // Start transparent
            drawingCanvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR);

            // If we already have a base overlay from disk, draw it first
            if (baseOverlayBitmap != null) {
                drawingCanvas.drawBitmap(baseOverlayBitmap, 0, 0, null);
            }

            // Re-apply any strokes we might have (e.g. after size change)
            redrawAllStrokes();
        }
    }

    private void redrawAllStrokes() {
        if (drawingCanvas == null) return;

        // Clear overlay
        drawingCanvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR);

        // Draw base overlay from disk first
        if (baseOverlayBitmap != null) {
            drawingCanvas.drawBitmap(baseOverlayBitmap, 0, 0, null);
        }

        // Re-apply strokes
        for (Stroke s : strokes) {
            drawStrokeOnOverlay(s);
        }
        invalidate();
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        ensureBitmap();
    }

    // ----------------------------------------------------
    // Background + saved overlay APIs (from RN)
    // ----------------------------------------------------

    public void setBackgroundBitmap(@Nullable Bitmap bitmap) {
        // Optional: some screens may still use backgroundBase64.
        // In your FormImageEditor, background is the React <Image> underneath,
        // so bgBitmap is normally null.
        bgBitmap = bitmap;
        invalidate();
    }

    /**
     * Called from DrawingViewManager.savedPath when RN passes the previous PNG.
     */
    public void setDrawingBitmap(@Nullable Bitmap bitmap) {
        baseOverlayBitmap = bitmap;
        // Reset strokes for this session; they belong on top of the base overlay.
        strokes.clear();
        undoneStrokes.clear();
        currentStroke = null;

        if (drawingCanvas != null) {
            // Rebuild overlay with new base
            redrawAllStrokes();
        } else {
            invalidate();
        }
    }

    // ----------------------------------------------------
    // Rendering
    // ----------------------------------------------------
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);

        // 1) Draw background form (if used in this mode)
        if (bgBitmap != null) {
            canvas.drawBitmap(bgBitmap, 0, 0, null);
        }

        // 2) Draw overlay (base + strokes)
        if (drawingBitmap != null) {
            canvas.drawBitmap(drawingBitmap, 0, 0, null);
        }
    }

    // Draw a stroke into drawingCanvas (overlay)
    private void drawStrokeOnOverlay(@NonNull Stroke s) {
        if (drawingCanvas == null || s.points.size() < 2) return;

        Paint p = new Paint(paint);
        p.setStrokeWidth(s.brushSize);

        if (s.isHighlighter) {
            p.setXfermode(null);
            p.setColor(s.color);
            p.setAlpha(100);
        } else if (s.isEraser) {
            // REAL ERASER: clear from overlay only (do NOT touch background)
            p.setColor(Color.TRANSPARENT);
            p.setAlpha(0);
            p.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
        } else {
            p.setXfermode(null);
            p.setColor(s.color);
            p.setAlpha(255);
        }

        // Draw as line segments for speed
        for (int i = 1; i < s.points.size(); i++) {
            PointF prev = s.points.get(i - 1);
            PointF curr = s.points.get(i);
            drawingCanvas.drawLine(prev.x, prev.y, curr.x, curr.y, p);
        }
    }

    // ----------------------------------------------------
    // Touch handling
    // ----------------------------------------------------
    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (!isEnabled()) return false;

        ensureBitmap();
        if (drawingCanvas == null) return false;

        float x = event.getX();
        float y = event.getY();

        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                if (getParent() != null) {
                    getParent().requestDisallowInterceptTouchEvent(true);
                }
                startStroke(x, y);
                invalidate();
                return true;

            case MotionEvent.ACTION_MOVE:
                if (currentStroke != null) {
                    PointF last = currentStroke.points.get(currentStroke.points.size() - 1);
                    PointF next = new PointF(x, y);
                    currentStroke.points.add(next);

                    // Draw segment directly to overlay for smoothness
                    Stroke s = currentStroke;
                    Paint p = new Paint(paint);
                    p.setStrokeWidth(s.brushSize);

                    if (s.isHighlighter) {
                        p.setXfermode(null);
                        p.setColor(s.color);
                        p.setAlpha(100);
                    } else if (s.isEraser) {
                        p.setColor(Color.TRANSPARENT);
                        p.setAlpha(0);
                        p.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
                    } else {
                        p.setXfermode(null);
                        p.setColor(s.color);
                        p.setAlpha(255);
                    }

                    drawingCanvas.drawLine(last.x, last.y, next.x, next.y, p);
                    invalidate();
                }
                return true;

            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                if (currentStroke != null) {
                    strokes.add(currentStroke);
                    currentStroke = null;
                    undoneStrokes.clear();
                    invalidate();
                }
                if (getParent() != null) {
                    getParent().requestDisallowInterceptTouchEvent(false);
                }
                return true;

            default:
                return super.onTouchEvent(event);
        }
    }

    private void startStroke(float x, float y) {
        Stroke s = new Stroke();
        s.color = currentColor;
        s.brushSize = brushSize;
        s.isEraser = isEraser;
        s.isHighlighter = isHighlighter;
        s.points.add(new PointF(x, y));
        currentStroke = s;
    }

    // ----------------------------------------------------
    // Public API for React Native (matches DrawingViewManager)
    // ----------------------------------------------------

    public void setColor(int color) {
        currentColor = color;
        isEraser = false;
        isHighlighter = false;

        paint.setColor(color);
        paint.setAlpha(255);
        paint.setXfermode(null);
    }

    public void setBrushSize(float size) {
        if (size <= 0) size = 1f;
        brushSize = size;
        paint.setStrokeWidth(size);
    }

    public void setEraser(boolean eraser) {
        isEraser = eraser;
        if (eraser) {
            isHighlighter = false;
        }
    }

    public void setHighlighter(boolean highlight) {
        isHighlighter = highlight;
        if (highlight) {
            isEraser = false;
        }
    }

    public void undo() {
        if (!strokes.isEmpty()) {
            undoneStrokes.add(strokes.remove(strokes.size() - 1));
            redrawAllStrokes();
        }
    }

    public void redo() {
        if (!undoneStrokes.isEmpty()) {
            strokes.add(undoneStrokes.remove(undoneStrokes.size() - 1));
            redrawAllStrokes();
        }
    }

    public void clear() {
        strokes.clear();
        undoneStrokes.clear();
        currentStroke = null;

        if (drawingCanvas != null) {
            drawingCanvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR);
            if (baseOverlayBitmap != null) {
                drawingCanvas.drawBitmap(baseOverlayBitmap, 0, 0, null);
            }
        }
        invalidate();
    }

    /**
     * Called by DrawingViewManager's "saveToFile" command.
     * We just compress the current overlay bitmap (base + strokes).
     */
    public boolean saveToFile(@NonNull File outFile) {
        try {
            ensureBitmap();
            if (drawingBitmap == null) {
                Log.w(TAG, "saveToFile: drawingBitmap is null");
                return false;
            }

            File parent = outFile.getParentFile();
            if (parent != null && !parent.exists()) {
                //noinspection ResultOfMethodCallIgnored
                parent.mkdirs();
            }

            FileOutputStream fos = new FileOutputStream(outFile);
            drawingBitmap.compress(Bitmap.CompressFormat.PNG, 100, fos);
            fos.flush();
            fos.close();

            Log.d(TAG, "saveToFile: saved to " + outFile.getAbsolutePath());
            return true;
        } catch (Exception e) {
            Log.e(TAG, "saveToFile error", e);
            return false;
        }
    }
}
