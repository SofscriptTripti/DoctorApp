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

    // We no longer rely on a static bitmap for "saved" overlays because
    // we want them to remain editable vectors.
    // However, if we receive a raw bitmap (legacy), we can still display it.
    private Bitmap legacyOverlayBitmap;

    // Base paint
    private final Paint paint;

    // Current live stroke (while moving)
    private Stroke currentStroke;

    // All finished strokes in this session (and loaded from JSON)
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
    // Background + Legacy Overlay
    // ----------------------------------------------------

    public void setBackgroundBitmap(@Nullable Bitmap bitmap) {
        bgBitmap = bitmap;
        invalidate();
    }

    /**
     * Legacy support: if we still want to show a flat PNG overlay
     */
    public void setDrawingBitmap(@Nullable Bitmap bitmap) {
        legacyOverlayBitmap = bitmap;
        invalidate();
    }

    // ----------------------------------------------------
    // JSON Strokes (The new "Editable" way)
    // ----------------------------------------------------

    public void setStrokesJson(@Nullable String json) {
        strokes.clear();
        undoneStrokes.clear();

        if (json == null || json.isEmpty()) {
            invalidate();
            return;
        }

        try {
            org.json.JSONArray arr = new org.json.JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject obj = arr.getJSONObject(i);
                Stroke s = new Stroke();
                s.color = obj.optInt("color", Color.BLACK);
                s.brushSize = (float) obj.optDouble("width", 5.0);
                s.isEraser = obj.optBoolean("eraser", false);
                s.isHighlighter = obj.optBoolean("highlighter", false);

                org.json.JSONArray pointsArr = obj.optJSONArray("points");
                if (pointsArr != null) {
                    for (int j = 0; j < pointsArr.length(); j++) {
                        org.json.JSONObject pObj = pointsArr.getJSONObject(j);
                        float x = (float) pObj.optDouble("x", 0);
                        float y = (float) pObj.optDouble("y", 0);
                        s.points.add(new PointF(x, y));
                    }
                }
                strokes.add(s);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to parse strokes JSON", e);
        }
        invalidate();
    }

    // ----------------------------------------------------
    // Drawing
    // ----------------------------------------------------
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);

        // 1) Background form
        if (bgBitmap != null) {
            canvas.drawBitmap(bgBitmap, 0, 0, null);
        }

        // 2) Legacy overlay (if any)
        if (legacyOverlayBitmap != null) {
            canvas.drawBitmap(legacyOverlayBitmap, 0, 0, null);
        }

        // 3) Draw all strokes (loaded + new)
        // We do this on a layer so Eraser works properly (clearing pixels)
        // if we decide to treat "Eraser" as a clear operation.
        // HOWEVER: For true vector editing, "Eraser" is visually clearing,
        // but if we just draw clear on top, it might clear the background too if we are
        // not careful.
        // To behave like an overlay eraser (only erasing strokes), we need a saveLayer.

        int saveCount = canvas.saveLayer(0, 0, getWidth(), getHeight(), null);

        for (Stroke s : strokes) {
            drawStroke(canvas, s);
        }

        if (currentStroke != null && !currentStroke.points.isEmpty()) {
            drawStroke(canvas, currentStroke);
        }

        canvas.restoreToCount(saveCount);
    }

    private void drawStroke(Canvas canvas, @NonNull Stroke s) {
        if (s.points.isEmpty())
            return;

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
            // "Clear" means erase pixels on this layer
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
        if (!isEnabled())
            return false;

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

            case MotionEvent.ACTION_CANCEL:
                // Discard the current stroke if gesture is cancelled
                if (currentStroke != null) {
                    currentStroke = null;
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

    public void cancelCurrentStroke() {
        if (currentStroke != null) {
            currentStroke = null;
            invalidate();
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
        if (size <= 0)
            size = 1f;
        brushSize = size;
        paint.setStrokeWidth(size);
    }

    public void setEraser(boolean eraser) {
        isEraser = eraser;
        if (eraser)
            isHighlighter = false;
    }

    public void setHighlighter(boolean highlight) {
        isHighlighter = highlight;
        if (highlight)
            isEraser = false;
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
     * NOW SAVES AS JSON!
     */
    public boolean saveToFile(@NonNull File outFile) {
        try {
            org.json.JSONArray arr = new org.json.JSONArray();

            for (Stroke s : strokes) {
                if (s.points.isEmpty())
                    continue;
                org.json.JSONObject obj = new org.json.JSONObject();
                obj.put("color", s.color);
                obj.put("width", s.brushSize);
                obj.put("eraser", s.isEraser);
                obj.put("highlighter", s.isHighlighter);

                org.json.JSONArray pts = new org.json.JSONArray();
                for (PointF p : s.points) {
                    org.json.JSONObject ptObj = new org.json.JSONObject();
                    ptObj.put("x", p.x);
                    ptObj.put("y", p.y);
                    pts.put(ptObj);
                }
                obj.put("points", pts);

                arr.put(obj);
            }

            String jsonString = arr.toString();

            File parent = outFile.getParentFile();
            if (parent != null && !parent.exists()) {
                // noinspection ResultOfMethodCallIgnored
                parent.mkdirs();
            }

            FileOutputStream fos = new FileOutputStream(outFile);
            fos.write(jsonString.getBytes("UTF-8"));
            fos.flush();
            fos.close();

            Log.d(TAG, "saveToFile (JSON): saved to " + outFile.getAbsolutePath());
            return true;
        } catch (Exception e) {
            Log.e(TAG, "saveToFile error", e);
            return false;
        }
    }

    // ----------------------------------------------------
    // Stroke model
    // ----------------------------------------------------
    public static class Stroke {
        public int color;
        public float brushSize;
        public boolean isEraser;
        public boolean isHighlighter;
        public final ArrayList<PointF> points = new ArrayList<>();
    }
}
