// src/PdfViewerScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Pdf from 'react-native-pdf';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type PdfRouteParams = {
  title?: string;
  pdfSource: any; // require('./PDF/File_1.pdf') etc.
};

type Props = {
  route: { params?: PdfRouteParams };
  navigation: any;
};

export default function PdfViewerScreen({ route, navigation }: Props) {
  const params = (route?.params || {}) as PdfRouteParams;
  const { title = 'Report', pdfSource } = params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* PDF Area */}
      <View style={styles.pdfContainer}>
        {!pdfSource && (
          <View style={styles.center}>
            <Text style={{ color: '#fff' }}>No PDF source provided</Text>
          </View>
        )}

        {pdfSource && (
          <>
            <Pdf
              source={pdfSource}        // <- require('./PDF/File_1.pdf')
              trustAllCerts={false}     // 🔥 IMPORTANT FIX FOR YOUR ERROR (Android)
              style={styles.pdf}
              onLoadComplete={(pages, filePath) => {
                setLoading(false);
                setError(null);
                console.log(`PDF loaded, pages: ${pages}, file: ${filePath}`);
              }}
              onLoadProgress={(progress) => {
                if (progress < 1) setLoading(true);
              }}
              onError={(err) => {
                console.log('PDF ERROR', err);
                setLoading(false);
                setError(String(err));
              }}
            />

            {loading && !error && (
              <View style={styles.overlay}>
                <ActivityIndicator size="large" />
                <Text style={styles.overlayText}>Loading PDF…</Text>
              </View>
            )}

            {error && (
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>
                  Failed to load PDF:
                  {'\n'}
                  {error}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ECFEFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ECFEFF',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  pdfContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  pdf: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overlayText: {
    marginTop: 8,
    color: '#fff',
    textAlign: 'center',
  },
});
