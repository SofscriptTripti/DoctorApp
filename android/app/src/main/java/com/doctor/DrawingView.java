package com.doctor;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.util.AttributeSet;
import android.util.Log;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;

import androidx.annotation.Nullable;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;

public class DrawingView extends View {

    private static final String TAG = "DrawingView";

    // Background (from RN Image/Base64) and drawing layer
    private Bitmap bgBitmap;
    private Bitmap drawingBitmap;
    private Canvas drawingCanvas;

    // Zoom
    private float scaleFactor = 1f;
    private ScaleGestureDetector scaleDetector;

    // Paint & path
    private Paint paint;
    private Path currentPath;
    private float brushSize = 8f;

    // “real” pen color (default: #0EA5A4)
    private int currentColor = 0xFF0EA5A4;
    private boolean isEraser = false;

    // Strokes history
    private final ArrayList<Stroke> strokes = new ArrayList<>();
    private final ArrayList<Stroke> redoStrokes = new ArrayList<>();

    // Touch helpers
    private float lastX = 0f, lastY = 0f;
    private boolean movedSinceDown = false;
    private static final float TOUCH_TOLERANCE = 2f;

    public DrawingView(Context context) {
        super(context);
        init(context);
    }

    public DrawingView(Context context, @Nullable AttributeSet attrs) {
        super(context, attrs);
        init(context);
    }

    private void init(Context ctx) {
        paint = new Paint();
        paint.setStyle(Paint.Style.STROKE);
        paint.setColor(currentColor);
        paint.setStrokeWidth(brushSize);
        paint.setAntiAlias(true);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);

        currentPath = new Path();
        scaleDetector = new ScaleGestureDetector(ctx, new ScaleListener());

        setFocusable(true);
        setFocusableInTouchMode(true);
        // You can switch to SOFTWARE if CLEAR behaves weird with HW acceleration
        // setLayerType(LAYER_TYPE_HARDWARE, null);
    }

    // ----------------------------------------------------
    // Size / canvas setup
    // ----------------------------------------------------
    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);

        if (w <= 0 || h <= 0) {
            return;
        }

        Bitmap newBitmap = Bitmap.createBitmap(
                Math.max(1, w),
                Math.max(1, h),
                Bitmap.Config.ARGB_8888
        );
        Canvas newCanvas = new Canvas(newBitmap);

        // If we already had drawing content, re-draw it
        if (drawingBitmap != null) {
            newCanvas.drawBitmap(drawingBitmap, 0, 0, null);
        }

        drawingBitmap = newBitmap;
        drawingCanvas = newCanvas;

        Log.d(TAG, "onSizeChanged: w=" + w + " h=" + h);
    }

    public void setBackgroundBitmap(@Nullable Bitmap bmp) {
        bgBitmap = bmp;
        invalidate();
    }

    /**
     * NEW: set the drawing layer from a saved bitmap (PNG loaded from file).
     * This is used when we reopen the editor and want previous strokes back.
     */
    public void setDrawingBitmap(@Nullable Bitmap bmp) {
        if (bmp == null) {
            drawingBitmap = null;
            drawingCanvas = null;
        } else {
            // Ensure mutable bitmap
            drawingBitmap = bmp.copy(Bitmap.Config.ARGB_8888, true);
            drawingCanvas = new Canvas(drawingBitmap);
        }
        invalidate();
    }

    // ----------------------------------------------------
    // Drawing
    // ----------------------------------------------------
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);

        if (canvas == null) return;

        canvas.save();
        canvas.scale(scaleFactor, scaleFactor);

        // Background image (from RN)
        if (bgBitmap != null) {
            canvas.drawBitmap(bgBitmap, 0f, 0f, null);
        }

        // Persisted strokes layer
        if (drawingBitmap != null) {
            canvas.drawBitmap(drawingBitmap, 0f, 0f, null);
        }

        // Live stroke preview
        if (currentPath != null) {
            canvas.drawPath(currentPath, paint);
        }

        canvas.restore();
    }

    // ----------------------------------------------------
    // Touch handling (SINGLE POINTER, robust)
    // ----------------------------------------------------
    @Override
    public boolean onTouchEvent(MotionEvent event) {

        // Let ScaleGestureDetector handle pinch-zoom
        scaleDetector.onTouchEvent(event);

        if (drawingCanvas == null) {
            // Safety: lazily create drawing bitmap if it didn't get created yet
            if (getWidth() > 0 && getHeight() > 0) {
                drawingBitmap = Bitmap.createBitmap(
                        getWidth(),
                        getHeight(),
                        Bitmap.Config.ARGB_8888
                );
                drawingCanvas = new Canvas(drawingBitmap);
            }
        }

        int action = event.getActionMasked();
        float x = event.getX() / scaleFactor;
        float y = event.getY() / scaleFactor;

        switch (action) {
            case MotionEvent.ACTION_DOWN: {
                // Tell parent (ScrollView) not to intercept
                if (getParent() != null) {
                    getParent().requestDisallowInterceptTouchEvent(true);
                }

                currentPath.reset();
                currentPath.moveTo(x, y);

                lastX = x;
                lastY = y;
                movedSinceDown = false;

                invalidate();
                return true;
            }

            case MotionEvent.ACTION_MOVE: {
                // Keep blocking parent during stroke
                if (getParent() != null) {
                    getParent().requestDisallowInterceptTouchEvent(true);
                }

                addSmoothPoint(x, y);
                movedSinceDown = true;
                invalidate();
                return true;
            }

            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL: {

                if (drawingCanvas == null) {
                    // If for some reason it's still null, just reset path and bail
                    currentPath.reset();
                    if (getParent() != null) {
                        getParent().requestDisallowInterceptTouchEvent(false);
                    }
                    invalidate();
                    return true;
                }

                if (!movedSinceDown) {
                    // Treat as a dot: small filled circle
                    float r = Math.max(1f, brushSize / 2f);
                    Paint fill = new Paint(paint);
                    fill.setStyle(Paint.Style.FILL);

                    drawingCanvas.drawCircle(x, y, r, fill);

                    Path dot = new Path();
                    dot.addCircle(x, y, r, Path.Direction.CW);
                    strokes.add(new Stroke(dot, new Paint(fill)));

                    Log.d(TAG, "Added DOT stroke. strokesCount=" + strokes.size());
                } else {
                    // Finalize stroke onto bitmap
                    currentPath.lineTo(x, y);
                    drawingCanvas.drawPath(currentPath, paint);

                    strokes.add(new Stroke(new Path(currentPath), new Paint(paint)));

                    Log.d(TAG, "Added PATH stroke. strokesCount=" + strokes.size());
                }

                // Reset temp path and redo stack
                currentPath.reset();
                redoStrokes.clear();

                // Allow parent to intercept again
                if (getParent() != null) {
                    getParent().requestDisallowInterceptTouchEvent(false);
                }

                invalidate();
                return true;
            }
        }

        return true;
    }

    private void addSmoothPoint(float x, float y) {
        float dx = Math.abs(x - lastX);
        float dy = Math.abs(y - lastY);

        if (dx >= TOUCH_TOLERANCE || dy >= TOUCH_TOLERANCE) {
            float cx = (x + lastX) / 2f;
            float cy = (y + lastY) / 2f;
            currentPath.quadTo(lastX, lastY, cx, cy);
            lastX = x;
            lastY = y;
        } else {
            currentPath.lineTo(x, y);
            lastX = x;
            lastY = y;
        }
    }

    // ----------------------------------------------------
    // Public API (called from RN manager)
    // ----------------------------------------------------
    public void setColor(int color) {
        isEraser = false;
        currentColor = color;

        paint.setXfermode(null);
        paint.setColor(color);
        paint.setAlpha(255);
        paint.setStrokeWidth(brushSize);
    }

    public void setBrushSize(float size) {
        brushSize = size;
        paint.setStrokeWidth(size);
    }

    public void setHighlighter(boolean enable) {
        if (enable) {
            paint.setXfermode(null);
            paint.setColor(Color.YELLOW);
            paint.setAlpha(120);
            paint.setStrokeWidth(40f);
        } else {
            paint.setAlpha(255);
            paint.setStrokeWidth(brushSize);
            paint.setColor(currentColor);
        }
    }

    public void setEraser(boolean enable) {
        isEraser = enable;
        if (enable) {
            paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
            paint.setStrokeWidth(40f);
        } else {
            paint.setXfermode(null);
            paint.setColor(currentColor);
            paint.setStrokeWidth(brushSize);
        }
    }

    public void undo() {
        if (!strokes.isEmpty()) {
            redoStrokes.add(strokes.remove(strokes.size() - 1));
            redrawStrokes();
        }
    }

    public void redo() {
        if (!redoStrokes.isEmpty()) {
            strokes.add(redoStrokes.remove(redoStrokes.size() - 1));
            redrawStrokes();
        }
    }

    public void clear() {
        strokes.clear();
        redoStrokes.clear();
        if (drawingBitmap != null) {
            drawingBitmap.eraseColor(Color.TRANSPARENT);
        }
        invalidate();
    }

    private void redrawStrokes() {
        if (drawingBitmap == null || drawingCanvas == null) return;

        drawingBitmap.eraseColor(Color.TRANSPARENT);
        for (Stroke s : strokes) {
            drawingCanvas.drawPath(s.path, s.paint);
        }
        invalidate();
    }

    private class ScaleListener extends ScaleGestureDetector.SimpleOnScaleGestureListener {
        @Override
        public boolean onScale(ScaleGestureDetector detector) {
            scaleFactor *= detector.getScaleFactor();
            scaleFactor = Math.max(0.7f, Math.min(scaleFactor, 3f));
            invalidate();
            return true;
        }
    }

    public boolean saveToFile(File file) {
        try {
            int w = getWidth();
            int h = getHeight();
            if (w <= 0 || h <= 0) return false;

            // Ensure folder exists
            File parent = file.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }

            Bitmap output = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(output);

            if (bgBitmap != null) {
                canvas.drawBitmap(bgBitmap, 0, 0, null);
            }
            if (drawingBitmap != null) {
                canvas.drawBitmap(drawingBitmap, 0, 0, null);
            }

            FileOutputStream fos = new FileOutputStream(file);
            output.compress(Bitmap.CompressFormat.PNG, 100, fos);
            fos.close();

            Log.d(TAG, "Saved drawing to: " + file.getAbsolutePath());
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    // Stroke model
    static class Stroke {
        Path path;
        Paint paint;

        Stroke(Path p, Paint pa) {
            path = p;
            paint = pa;
        }
    }
}
