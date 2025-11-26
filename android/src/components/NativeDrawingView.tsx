// src/components/NativeDrawingView.tsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  ViewStyle,
} from 'react-native';

type Props = {
  style?: ViewStyle;
  backgroundBase64?: string;
};

const RNDrawingView = requireNativeComponent<Props>('RNDrawingView') as any;

export type DrawingRef = {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  setColor: (hex: string) => void;
  setBrushSize: (size: number) => void;
  setEraser: (enable: boolean) => void;
  saveToFile: (path: string) => Promise<boolean>;
};

const NativeDrawingView = forwardRef<DrawingRef, Props>((props, ref) => {
  const nativeRef = useRef<any>(null);

  const sendCommand = (name: string, args: any[] = []) => {
    const node = findNodeHandle(nativeRef.current);
    if (!node) return;
    const manager = UIManager.getViewManagerConfig('RNDrawingView');
    const commands = manager?.Commands || {};
    const commandId = commands[name];
    if (typeof commandId === 'number') {
      UIManager.dispatchViewManagerCommand(node, commandId, args);
    } else {
      UIManager.dispatchViewManagerCommand(node, name, args);
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      undo: () => sendCommand('undo'),
      redo: () => sendCommand('redo'),
      clear: () => sendCommand('clear'),

      setColor: (hex: string) => {
        if (!nativeRef.current) return;
        nativeRef.current.setNativeProps({ strokeColor: hex });
      },

      setBrushSize: (size: number) => {
        if (!nativeRef.current) return;
        nativeRef.current.setNativeProps({ strokeWidth: size });
      },

      setEraser: (enable: boolean) => {
        if (!nativeRef.current) return;
        nativeRef.current.setNativeProps({ eraseMode: enable });
      },

      saveToFile: (path: string) => {
        return new Promise<boolean>((resolve) => {
          try {
            sendCommand('saveToFile', [path]);
          } catch (e) {
            resolve(false);
            return;
          }
          setTimeout(() => resolve(true), 400);
        });
      },
    }),
    []
  );

  return <RNDrawingView ref={nativeRef} {...props} />;
});

export default NativeDrawingView;
