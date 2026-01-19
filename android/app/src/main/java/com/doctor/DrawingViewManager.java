package com.doctor;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

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
        return new DrawingView(reactContext, null);
    }

    // ---------------- PROPS ----------------

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

    @ReactProp(name = "savedPath")
    public void setSavedPath(DrawingView view, @Nullable String path) {

        if (path == null || path.trim().isEmpty()) {
            return; // ✅ DO NOT erase unexpectedly
        }

        try {
            File file = new File(path);
            if (!file.exists()) {
                return;
            }

            // Try to decide if it's a legacy PNG or a new JSON file?
            // Actually, for this specific request, the user seems to imply
            // that we will pass the data from API.
            // But if we load from disk (local draft), we might use this.
            // Let's assume for now savedPath might still be used for local images
            // or we just rely on strokesJson prop.

            // For safety, let's keep legacy behavior for now:
            Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath());
            if (bitmap != null) {
                view.setDrawingBitmap(bitmap);
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @ReactProp(name = "strokesJson")
    public void setStrokesJson(DrawingView view, @Nullable String json) {
        view.setStrokesJson(json);
    }

    // ---------------- COMMANDS ----------------

    @Nullable
    @Override
    public Map<String, Integer> getCommandsMap() {
        return MapBuilder.of(
                "undo", CMD_UNDO,
                "redo", CMD_REDO,
                "clear", CMD_CLEAR,
                "saveToFile", CMD_SAVE);
    }

    @Override
    public void receiveCommand(
            @NonNull DrawingView root,
            int commandId,
            @Nullable ReadableArray args) {

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
                        root.saveToFile(new File(path));
                    }
                }
                break;
        }
    }
}
