import React, { useRef } from 'react';
import { SafeAreaView, View, StyleSheet, Text } from 'react-native';
import NativeDrawingView, { DrawingRef } from './components/NativeDrawingView';

export default function TestDrawingScreen() {
  const canvasRef = useRef<DrawingRef | null>(null);
  const AnyNativeDrawingView = NativeDrawingView as unknown as any;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.canvasWrapper}>
        <AnyNativeDrawingView
          ref={canvasRef}
          style={styles.canvas}
          strokeColor="#ff0000"
          strokeWidth={4}
          eraseMode={false}
        />
      </View>
      <Text style={styles.hint}>
        Try: draw slowly, draw fast, lift finger, draw again. No zoom, no scroll.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', padding: 12 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  canvasWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
  },
  hint: { marginTop: 10, fontSize: 12, color: '#666' },
});
