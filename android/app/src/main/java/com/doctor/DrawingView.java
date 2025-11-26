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
import android.view.View;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;

public class DrawingView extends View {

    private static final String TAG = "DrawingView";

    // Background (optional) and drawing layer
    private Bitmap bgBitmap;
    private Bitmap drawingBitmap;
    private Canvas drawingCanvas;

    // Page id for persistence (if you use it)
    private String pageId = null;

    // Paint & path
    private Paint paint;
    private Path currentPath;
    private float brushSize = 8f;

    // “real” pen color (default: #0EA5A4)
    private int currentColor = 0xFF0EA5A4;
    private boolean isEraser = false;

    // Strokes history (for undo/redo of current session)
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

        setFocusable(true);
        setFocusableInTouchMode(true);
    }

    // ----------------------------------------------------
    // Optional: Page ID + persistence helpers
    // ----------------------------------------------------

    public void setPageId(@Nullable String id) {
        this.pageId = id;
        Log.d(TAG, "setPageId: " + id);
        loadSavedBitmapIfExists();
    }

    private void loadSavedBitmapIfExists() {
        if (pageId == null || pageId.trim().isEmpty()) return;

        try {
            File dir = getContext().getFilesDir();
            File file = new File(dir, pageId + ".png");
            if (!file.exists()) {
                Log.d(TAG, "No saved bitmap for pageId=" + pageId);
                return;
            }

            Bitmap bmp = BitmapFactory.decodeFile(file.getAbsolutePath());
            if (bmp != null) {
                setSavedDrawingBitmap(bmp);
                Log.d(TAG, "Loaded saved bitmap for pageId=" + pageId);
            } else {
                Log.w(TAG, "decodeFile returned null for " + file.getAbsolutePath());
            }
        } catch (Exception e) {
            Log.e(TAG, "loadSavedBitmapIfExists error", e);
        }
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

        if (drawingBitmap != null) {
            newCanvas.drawBitmap(drawingBitmap, 0, 0, null);
        }

        drawingBitmap = newBitmap;
        drawingCanvas = newCanvas;

        Log.d(TAG, "onSizeChanged: w=" + w + " h=" + h);
    }

    public void setBackgroundBitmap(Bitmap bmp) {
        bgBitmap = bmp;
        invalidate();
    }

    public void setSavedDrawingBitmap(Bitmap bmp) {
        if (bmp == null) return;

        if (drawingBitmap != null && !drawingBitmap.isRecycled()) {
            drawingBitmap.recycle();
        }

        drawingBitmap = bmp.copy(Bitmap.Config.ARGB_8888, true);
        drawingCanvas = new Canvas(drawingBitmap);

        strokes.clear();
        redoStrokes.clear();

        invalidate();
    }

    /**
     * NEW: Allow manager/JS to directly set the drawing layer bitmap.
     * Used by the `savedPath` React prop.
     */
    public void setDrawingBitmap(@Nullable Bitmap bmp) {
        if (bmp == null) {
            if (drawingBitmap != null) {
                drawingBitmap.eraseColor(Color.TRANSPARENT);
            }
            strokes.clear();
            redoStrokes.clear();
            invalidate();
            return;
        }

        setSavedDrawingBitmap(bmp);
    }

    // ----------------------------------------------------
    // Drawing
    // ----------------------------------------------------
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);

        if (canvas == null) return;

        // Background image (if used)
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
    }

    // ----------------------------------------------------
    // Touch handling (NO SCALE)
    // ----------------------------------------------------
    @Override
    public boolean onTouchEvent(MotionEvent event) {

        if (drawingCanvas == null) {
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
        float x = event.getX();
        float y = event.getY();

        switch (action) {
            case MotionEvent.ACTION_DOWN: {
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
                    currentPath.reset();
                    if (getParent() != null) {
                        getParent().requestDisallowInterceptTouchEvent(false);
                    }
                    invalidate();
                    return true;
                }

                if (!movedSinceDown) {
                    // Dot
                    float r = Math.max(1f, brushSize / 2f);
                    Paint fill = new Paint(paint);
                    fill.setStyle(Paint.Style.FILL);

                    drawingCanvas.drawCircle(x, y, r, fill);

                    Path dot = new Path();
                    dot.addCircle(x, y, r, Path.Direction.CW);
                    strokes.add(new Stroke(dot, new Paint(fill)));

                    Log.d(TAG, "Added DOT stroke. strokesCount=" + strokes.size());
                } else {
                    // Stroke
                    currentPath.lineTo(x, y);
                    drawingCanvas.drawPath(currentPath, paint);

                    strokes.add(new Stroke(new Path(currentPath), new Paint(paint)));

                    Log.d(TAG, "Added PATH stroke. strokesCount=" + strokes.size());
                }

                currentPath.reset();
                redoStrokes.clear();

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
    // Public API (called from RN)
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

    /**
     * NEW: Save the current drawing layer to a specific File.
     * This is called by DrawingViewManager's "saveToFile" command,
     * which matches the JS path (e.g. /data/data/com.doctor/files/drawing_page_1.png).
     */
    public boolean saveToFile(@NonNull File outFile) {
        try {
            if (drawingBitmap == null) {
                Log.w(TAG, "saveToFile: drawingBitmap is null");
                return false;
            }

            int w = drawingBitmap.getWidth();
            int h = drawingBitmap.getHeight();
            if (w <= 0 || h <= 0) {
                Log.w(TAG, "saveToFile: invalid bitmap size");
                return false;
            }

            Bitmap output = Bitmap.createBitmap(
                    w,
                    h,
                    Bitmap.Config.ARGB_8888
            );
            Canvas canvas = new Canvas(output);
            // start fully transparent, then draw strokes
            canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR);
            canvas.drawBitmap(drawingBitmap, 0, 0, null);

            File parent = outFile.getParentFile();
            if (parent != null && !parent.exists()) {
                // Ensure dir exists
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

    // Existing helper if you still use pageId-based saving somewhere
    public boolean saveCurrentToDisk() {
        if (pageId == null || pageId.trim().isEmpty()) {
            Log.w(TAG, "saveCurrentToDisk: pageId is null/empty");
            return false;
        }
        try {
            int w = getWidth();
            int h = getHeight();
            if (w <= 0 || h <= 0) return false;

            Bitmap output = Bitmap.createBitmap(
                    w,
                    h,
                    Bitmap.Config.ARGB_8888
            );
            Canvas canvas = new Canvas(output);

            if (bgBitmap != null) {
                canvas.drawBitmap(bgBitmap, 0, 0, null);
            }
            if (drawingBitmap != null) {
                canvas.drawBitmap(drawingBitmap, 0, 0, null);
            }

            File dir = getContext().getFilesDir();
            File file = new File(dir, pageId + ".png");

            FileOutputStream fos = new FileOutputStream(file);
            output.compress(Bitmap.CompressFormat.PNG, 100, fos);
            fos.close();

            Log.d(TAG, "Saved drawing to: " + file.getAbsolutePath());
            return true;
        } catch (Exception e) {
            Log.e(TAG, "saveCurrentToDisk error", e);
            return false;
        }
    }

    static class Stroke {
        Path path;
        Paint paint;

        Stroke(Path p, Paint pa) {
            path = p;
            paint = pa;
        }
    }
}
