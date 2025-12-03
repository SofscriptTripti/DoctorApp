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

    // Background form image (from backgroundBase64)
    private Bitmap bgBitmap;

    // Previous saved overlay loaded from file (savedPath)
    private Bitmap savedOverlayBitmap;

    // Base paint
    private final Paint paint;

    // Current live stroke (while moving)
    private Stroke currentStroke;

    // All finished strokes in this session
    private final ArrayList<Stroke> strokes = new ArrayList<>();
    private final ArrayList<Stroke> undoneStrokes = new ArrayList<>();

    // State flags
    private boolean isEraser = false;
    private boolean isHighlighter = false;

    // Defaults
    private float brushSize = 5f;
    private int currentColor = Color.BLACK;

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
    // Background + saved overlay
    // ----------------------------------------------------

    public void setBackgroundBitmap(@Nullable Bitmap bitmap) {
        bgBitmap = bitmap;
        invalidate();
    }

    /**
     * Called from DrawingViewManager.savedPath.
     * This is the previously saved PNG overlay.
     */
    public void setDrawingBitmap(@Nullable Bitmap bitmap) {
        savedOverlayBitmap = bitmap;
        invalidate();
    }

    // ----------------------------------------------------
    // Drawing
    // ----------------------------------------------------
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);

        // 1) Background form (drawn directly to main canvas)
        if (bgBitmap != null) {
            canvas.drawBitmap(bgBitmap, 0, 0, null);
        }

        // 2) Draw overlay (saved overlay + strokes) on a separate layer
        int saveCount = canvas.saveLayer(0, 0, getWidth(), getHeight(), null);

        // 2a) Previously saved overlay (from disk)
        if (savedOverlayBitmap != null) {
            canvas.drawBitmap(savedOverlayBitmap, 0, 0, null);
        }

        // 2b) Draw all finished strokes from this session
        for (Stroke s : strokes) {
            drawStroke(canvas, s);
        }

        // 2c) Draw the live stroke being drawn
        if (currentStroke != null && !currentStroke.points.isEmpty()) {
            drawStroke(canvas, currentStroke);
        }

        // 2d) Merge layer back onto main canvas
        canvas.restoreToCount(saveCount);
    }

    private void drawStroke(Canvas canvas, @NonNull Stroke s) {
        if (s.points.isEmpty()) return;

        Path path = new Path();
        path.moveTo(s.points.get(0).x, s.points.get(0).y);
        for (int i = 1; i < s.points.size(); i++) {
            PointF pt = s.points.get(i);
            path.lineTo(pt.x, pt.y);
        }

        Paint p = new Paint(paint);
        p.setStrokeWidth(s.brushSize);

        if (s.isHighlighter) {
            p.setColor(s.color);
            p.setAlpha(100);
            p.setXfermode(null);
        } else if (s.isEraser) {
            // REAL ERASER on overlay layer: clear pixels instead of painting white
            p.setColor(Color.TRANSPARENT);
            p.setAlpha(0);
            p.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
        } else {
            p.setColor(s.color);
            p.setAlpha(255);
            p.setXfermode(null);
        }

        canvas.drawPath(path, p);
    }

    // ----------------------------------------------------
    // Touch events
    // ----------------------------------------------------
    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (!isEnabled()) return false;

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
                    currentStroke.points.add(new PointF(x, y));
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
        currentStroke = new Stroke();
        currentStroke.color = currentColor;
        currentStroke.brushSize = brushSize;
        currentStroke.isEraser = isEraser;
        currentStroke.isHighlighter = isHighlighter;
        currentStroke.points.add(new PointF(x, y));
    }

    // ----------------------------------------------------
    // Public API used from RN
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
            invalidate();
        }
    }

    public void redo() {
        if (!undoneStrokes.isEmpty()) {
            strokes.add(undoneStrokes.remove(undoneStrokes.size() - 1));
            invalidate();
        }
    }

    public void clear() {
        strokes.clear();
        undoneStrokes.clear();
        currentStroke = null;
        invalidate();
    }

    /**
     * Called by DrawingViewManager "saveToFile" command.
     * We create a transparent bitmap and draw this session's strokes + previous overlay.
     */
    public boolean saveToFile(@NonNull File outFile) {
        try {
            int w = getWidth();
            int h = getHeight();
            if (w <= 0 || h <= 0) {
                Log.w(TAG, "saveToFile: invalid size " + w + "x" + h);
                return false;
            }

            Bitmap output = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(output);

            // Start fully transparent
            canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR);

            // 1) Draw previously saved overlay (if any) as base
            if (savedOverlayBitmap != null) {
                canvas.drawBitmap(savedOverlayBitmap, 0, 0, null);
            }

            // 2) Draw all strokes in this session on top (with proper eraser transparency)
            Paint p = new Paint(paint);
            p.setAntiAlias(true);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeCap(Paint.Cap.ROUND);
            p.setStrokeJoin(Paint.Join.ROUND);

            for (Stroke s : strokes) {
                if (s.points.isEmpty()) continue;

                Path path = new Path();
                path.moveTo(s.points.get(0).x, s.points.get(0).y);
                for (int i = 1; i < s.points.size(); i++) {
                    PointF pt = s.points.get(i);
                    path.lineTo(pt.x, pt.y);
                }

                p.setStrokeWidth(s.brushSize);

                if (s.isHighlighter) {
                    p.setXfermode(null);
                    p.setColor(s.color);
                    p.setAlpha(100);
                } else if (s.isEraser) {
                    // In the PNG overlay, eraser = make those pixels transparent again
                    p.setColor(Color.TRANSPARENT);
                    p.setAlpha(0);
                    p.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
                } else {
                    p.setXfermode(null);
                    p.setColor(s.color);
                    p.setAlpha(255);
                }

                canvas.drawPath(path, p);
            }

            // Write PNG
            File parent = outFile.getParentFile();
            if (parent != null && !parent.exists()) {
                //noinspection ResultOfMethodCallIgnored
                parent.mkdirs();
            }

            FileOutputStream fos = new FileOutputStream(outFile);
            output.compress(Bitmap.CompressFormat.PNG, 100, fos);
            fos.flush();
            fos.close();

            Log.d(TAG, "saveToFile: saved to " + outFile.getAbsolutePath());
            return true;
        } catch (Exception e) {
            Log.e(TAG, "saveToFile error", e);
            return false;
        }
    }

    // ----------------------------------------------------
    // Stroke model (same spirit as your pure version)
    // ----------------------------------------------------
    public static class Stroke {
        public int color;
        public float brushSize;
        public boolean isEraser;
        public boolean isHighlighter;
        public final ArrayList<PointF> points = new ArrayList<>();
    }
}
