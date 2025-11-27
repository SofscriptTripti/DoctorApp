// src/components/NativeDrawingView.tsx

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';

type NativeProps = {
  style?: StyleProp<ViewStyle>;
  strokeColor?: string | number;
  strokeWidth?: number;
  eraseMode?: boolean;
  savedPath?: string | null;
};

const COMPONENT_NAME = 'RNDrawingView';

const RNDrawingView =
  requireNativeComponent<NativeProps>(COMPONENT_NAME);

export type DrawingRef = {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  setColor: (hex: string) => void;
  setBrushSize: (size: number) => void;
  setEraser: (enable: boolean) => void;
  saveToFile: (path: string) => Promise<boolean>;
};

const NativeDrawingView = forwardRef<DrawingRef, NativeProps>(
  (props, ref) => {
    const nativeRef = useRef<any>(null);

    const sendCommand = (name: string, args: any[] = []) => {
      if (Platform.OS !== 'android') return;

      const node = findNodeHandle(nativeRef.current);
      if (!node) return;

      const config = UIManager.getViewManagerConfig(COMPONENT_NAME);
      if (!config || !config.Commands) return;

      const commandId = config.Commands[name];
      if (commandId == null) return;

      UIManager.dispatchViewManagerCommand(node, commandId, args);
    };

    useImperativeHandle(
      ref,
      () => ({
        undo: () => sendCommand('undo'),

        redo: () => sendCommand('redo'),

        clear: () => sendCommand('clear'),

        setColor: (hex: string) => {
          if (!nativeRef.current) return;
          nativeRef.current.setNativeProps({
            strokeColor: hex,
            eraseMode: false,
          });
        },

        setBrushSize: (size: number) => {
          if (!nativeRef.current) return;
          nativeRef.current.setNativeProps({
            strokeWidth: size,
          });
        },

        setEraser: (enable: boolean) => {
          if (!nativeRef.current) return;
          nativeRef.current.setNativeProps({
            eraseMode: enable,
          });
        },

        saveToFile: (path: string) => {
          return new Promise<boolean>((resolve) => {
            try {
              sendCommand('saveToFile', [path]);
              resolve(true); // native already writes synchronously
            } catch (e) {
              console.warn('saveToFile failed', e);
              resolve(false);
            }
          });
        },
      }),
      []
    );

    return <RNDrawingView ref={nativeRef} {...props} />;
  }
);

export default NativeDrawingView;
