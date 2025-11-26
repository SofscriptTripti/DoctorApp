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

import java.util.ArrayList;

public class DrawingView extends View {
    private static final String TAG = "DrawingView";

    private Bitmap bgBitmap;
    private Bitmap drawingBitmap;
    private Canvas drawingCanvas;

    private float scaleFactor = 1f;
    private ScaleGestureDetector scaleDetector;

    private Paint paint;
    private Path currentPath;
    private float brushSize = 8f;
    private boolean isEraser = false;

    // ✅ this is the “real” pen color, default sea green (#0EA5A4)
    private int currentColor = 0xFF0EA5A4;

    private ArrayList<Stroke> strokes = new ArrayList<>();
    private ArrayList<Stroke> redoStrokes = new ArrayList<>();

    // pointer details
    private int activePointerId = -1;
    private float lastX = 0f, lastY = 0f;
    private float touchStartX = 0f, touchStartY = 0f;

    // gesture states
    private boolean movedSinceDown = false;
    private boolean pointerIsStylus = false;

    // sensitivity
    private static final float TOUCH_TOLERANCE = 2f; // smoother handwriting
    private static final float SCROLL_THRESHOLD_DP = 10f;

    public DrawingView(Context ctx, AttributeSet attrs) {
        super(ctx, attrs);

        paint = new Paint();
        paint.setStyle(Paint.Style.STROKE);
        paint.setColor(currentColor);   // ✅ use sea green as default, not hard-coded blue
        paint.setStrokeWidth(brushSize);
        paint.setAntiAlias(true);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);

        currentPath = new Path();
        scaleDetector = new ScaleGestureDetector(ctx, new ScaleListener());

        setFocusable(true);
        setFocusableInTouchMode(true);
    }

    // ----------------------------------------------------
    // Canvas + image
    // ----------------------------------------------------

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        Bitmap newBitmap = Bitmap.createBitmap(Math.max(1, w), Math.max(1, h), Bitmap.Config.ARGB_8888);
        Canvas newCanvas = new Canvas(newBitmap);

        if (drawingBitmap != null) {
            newCanvas.drawBitmap(drawingBitmap, 0, 0, null);
        }

        drawingBitmap = newBitmap;
        drawingCanvas = newCanvas;
    }

    public void setBackgroundBitmap(Bitmap bmp) {
        bgBitmap = bmp;
        invalidate();
    }

    // ----------------------------------------------------
    // Drawing
    // ----------------------------------------------------

    @Override
    protected void onDraw(Canvas canvas) {
        canvas.save();
        canvas.scale(scaleFactor, scaleFactor);

        if (bgBitmap != null) canvas.drawBitmap(bgBitmap, 0f, 0f, null);
        if (drawingBitmap != null) canvas.drawBitmap(drawingBitmap, 0f, 0f, null);
        if (currentPath != null) canvas.drawPath(currentPath, paint);

        canvas.restore();
    }

    // ----------------------------------------------------
    // TOUCH HANDLING
    // ----------------------------------------------------

    @Override
    public boolean onTouchEvent(MotionEvent event) {

        // allow pinch zoom detection
        scaleDetector.onTouchEvent(event);

        final int action = event.getActionMasked();
        final int idx = event.getActionIndex();
        final float density = getResources().getDisplayMetrics().density;
        final float SCROLL_THRESHOLD_PX = SCROLL_THRESHOLD_DP * density;

        switch (action) {

            case MotionEvent.ACTION_DOWN: {

                activePointerId = event.getPointerId(0);
                float x = event.getX(0) / scaleFactor;
                float y = event.getY(0) / scaleFactor;

                currentPath = new Path();
                currentPath.moveTo(x, y);

                lastX = x; lastY = y;
                touchStartX = x;
                touchStartY = y;

                movedSinceDown = false;
                pointerIsStylus = isStylus(event, 0);

                // always claim the touch while drawing
                if (getParent() != null) getParent().requestDisallowInterceptTouchEvent(true);

                paint.setStrokeWidth(brushSize);
                invalidate();
                return true;
            }

            case MotionEvent.ACTION_MOVE: {

                int pIndex = event.findPointerIndex(activePointerId);
                if (pIndex < 0) break;

                float x = event.getX(pIndex) / scaleFactor;
                float y = event.getY(pIndex) / scaleFactor;

                // IMPORTANT: do NOT hand the touch to parent mid-stroke.
                if (getParent() != null) getParent().requestDisallowInterceptTouchEvent(true);

                // process historical points for smoother lines
                int hist = event.getHistorySize();
                for (int i = 0; i < hist; i++) {
                    float hx = event.getHistoricalX(pIndex, i) / scaleFactor;
                    float hy = event.getHistoricalY(pIndex, i) / scaleFactor;
                    addSmoothPoint(hx, hy);
                }

                addSmoothPoint(x, y);
                movedSinceDown |= Math.hypot(x - lastX, y - lastY) >= TOUCH_TOLERANCE;

                invalidate();
                return true;
            }

            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL: {

                int pIndex = event.findPointerIndex(activePointerId);
                float x = pIndex >= 0 ? event.getX(pIndex) / scaleFactor : lastX;
                float y = pIndex >= 0 ? event.getY(pIndex) / scaleFactor : lastY;

                if (!movedSinceDown) {
                    // dot: draw a filled circle and save as stroke
                    float r = Math.max(1f, brushSize / 2f);
                    Paint fill = new Paint(paint);
                    fill.setStyle(Paint.Style.FILL);
                    if (drawingCanvas != null) {
                        drawingCanvas.drawCircle(x, y, r, fill);
                    }

                    Path dot = new Path();
                    dot.addCircle(x, y, r, Path.Direction.CW);
                    strokes.add(new Stroke(dot, new Paint(fill)));

                    Log.d(TAG, "Added DOT stroke. strokesCount=" + strokes.size());
                } else {
                    // finalize path into bitmap and save the stroke
                    currentPath.lineTo(x, y);
                    if (drawingCanvas != null) {
                        drawingCanvas.drawPath(currentPath, paint);
                    }
                    strokes.add(new Stroke(new Path(currentPath), new Paint(paint)));

                    Log.d(TAG, "Added PATH stroke. strokesCount=" + strokes.size());
                }

                // reset temporary path / redo buffer / active pointer
                currentPath.reset();
                redoStrokes.clear();
                activePointerId = -1;

                // allow parent intercept again
                if (getParent() != null) getParent().requestDisallowInterceptTouchEvent(false);

                invalidate();
                return true;
            }

            case MotionEvent.ACTION_POINTER_DOWN:
                return true;

            case MotionEvent.ACTION_POINTER_UP: {

                int pid = event.getPointerId(idx);
                if (pid == activePointerId) {
                    int newIdx = (idx == 0) ? 1 : 0;
                    if (event.getPointerCount() > 1) {
                        activePointerId = event.getPointerId(newIdx);
                        lastX = event.getX(newIdx) / scaleFactor;
                        lastY = event.getY(newIdx) / scaleFactor;
                    } else {
                        activePointerId = -1;
                    }
                }
                return true;
            }
        }

        return true;
    }

    private boolean isStylus(MotionEvent ev, int index) {
        try {
            int tool = ev.getToolType(index);
            return tool == MotionEvent.TOOL_TYPE_STYLUS || tool == MotionEvent.TOOL_TYPE_ERASER;
        } catch (Throwable t) {
            return false;
        }
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
    // Public API
    // ----------------------------------------------------

    // ✅ called from React via @ReactProp(strokeColor)
    public void setColor(int color) {
        isEraser = false;
        currentColor = color;           // ✅ remember last selected color
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

    // ✅ called from React via @ReactProp(eraseMode)
    public void setEraser(boolean enable) {
        isEraser = enable;
        if (enable) {
            // Eraser = clear pixels (transparent)
            paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
            paint.setStrokeWidth(40f);
        } else {
            // Back to normal pen with last selected color
            paint.setXfermode(null);
            paint.setColor(currentColor);   // ✅ no more hard-coded Color.BLUE
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
        if (drawingBitmap != null) drawingBitmap.eraseColor(Color.TRANSPARENT);
        invalidate();
    }

    private void redrawStrokes() {
        if (drawingBitmap == null) return;
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

    public boolean saveToFile(java.io.File file) {
        try {
            Bitmap output = Bitmap.createBitmap(getWidth(), getHeight(), Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(output);
            if (bgBitmap != null) canvas.drawBitmap(bgBitmap, 0, 0, null);
            if (drawingBitmap != null) canvas.drawBitmap(drawingBitmap, 0, 0, null);
            java.io.FileOutputStream fos = new java.io.FileOutputStream(file);
            output.compress(Bitmap.CompressFormat.PNG, 100, fos);
            fos.close();
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    static class Stroke {
        Path path;
        Paint paint;
        Stroke(Path p, Paint pa) { path = p; paint = pa; }
    }
}
