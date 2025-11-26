package com.doctor;

import android.graphics.BitmapFactory;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import java.io.File;
import java.util.Map;

public class DrawingViewManager extends SimpleViewManager<DrawingView> {

    public static final String REACT_CLASS = "RNDrawingView";

    // Command IDs (must match names used in JS getViewManagerConfig().Commands)
    public static final int CMD_UNDO = 1;
    public static final int CMD_REDO = 2;
    public static final int CMD_CLEAR = 3;
    public static final int CMD_SAVE = 4;

    @NonNull
    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @NonNull
    @Override
    protected DrawingView createViewInstance(@NonNull ThemedReactContext reactContext) {
        // We use the AttributeSet constructor, passing null here is fine
        return new DrawingView(reactContext, null);
    }

    // ----------------------------------------------------
    // Props from JS
    // ----------------------------------------------------

    @ReactProp(name = "strokeColor", customType = "Color")
    public void setColor(DrawingView view, @Nullable Integer color) {
        if (color != null) {
            view.setColor(color);
        }
    }

    @ReactProp(name = "strokeWidth")
    public void setStrokeWidth(DrawingView view, float width) {
        view.setBrushSize(width);
    }

    @ReactProp(name = "eraseMode")
    public void setEraseMode(DrawingView view, boolean enabled) {
        view.setEraser(enabled);
    }

    @ReactProp(name = "backgroundBase64")
    public void setBackgroundBase64(DrawingView view, @Nullable String base64) {
        if (base64 == null || base64.trim().isEmpty()) {
            view.setBackgroundBitmap(null);
            return;
        }

        try {
            String clean = base64;
            int idx = base64.indexOf("base64,");
            if (idx >= 0) {
                clean = base64.substring(idx + 7);
            }
            byte[] decoded = Base64.decode(clean, Base64.DEFAULT);
            view.setBackgroundBitmap(
                BitmapFactory.decodeByteArray(decoded, 0, decoded.length)
            );
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Path to previously saved PNG for this page.
     * When present, we load the file and set it as the drawing layer.
     */
    @ReactProp(name = "savedPath")
    public void setSavedPath(DrawingView view, @Nullable String path) {
        if (path == null || path.trim().isEmpty()) {
            view.setDrawingBitmap(null);
            return;
        }

        try {
            File file = new File(path);
            if (file.exists()) {
                view.setDrawingBitmap(
                    BitmapFactory.decodeFile(file.getAbsolutePath())
                );
            } else {
                // If file not found, clear drawing so we don't show stale content
                view.setDrawingBitmap(null);
            }
        } catch (Exception e) {
            e.printStackTrace();
            view.setDrawingBitmap(null);
        }
    }

    // ----------------------------------------------------
    // Commands from JS (undo/redo/clear/saveToFile)
    // ----------------------------------------------------

    @Nullable
    @Override
    public Map<String, Integer> getCommandsMap() {
        return MapBuilder.of(
            "undo", CMD_UNDO,
            "redo", CMD_REDO,
            "clear", CMD_CLEAR,
            "saveToFile", CMD_SAVE
        );
    }

    @Override
    public void receiveCommand(
        @NonNull DrawingView root,
        int commandId,
        @Nullable ReadableArray args
    ) {
        switch (commandId) {
            case CMD_UNDO:
                root.undo();
                break;

            case CMD_REDO:
                root.redo();
                break;

            case CMD_CLEAR:
                root.clear();
                break;

            case CMD_SAVE:
                if (args != null && args.size() > 0) {
                    String path = args.getString(0);
                    if (path != null && !path.trim().isEmpty()) {
                        try {
                            File file = new File(path);
                            root.saveToFile(file);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }
                break;

            default:
                // no-op
                break;
        }
    }
}
