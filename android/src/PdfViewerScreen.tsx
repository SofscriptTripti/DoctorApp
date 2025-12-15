import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Pdf from 'react-native-pdf';
import { useNavigation, useRoute } from '@react-navigation/native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get('window');

type RouteParams = {
  title?: string;

  // ✅ ONLY for bundled PDFs
  pdfFileName?: string;

  // ❌ deprecated (we redirect instead)
  storageKey?: string;
  totalPages?: number;
};

export default function PdfViewerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    title = 'Report',
    pdfFileName,
    storageKey,
    totalPages,
  } = (route.params || {}) as RouteParams;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  /* ---------- REDIRECT GENERATED DOCUMENTS ---------- */
  useEffect(() => {
    if (!pdfFileName && storageKey) {
      // 👉 This is NOT a real PDF → open image-based viewer
      navigation.replace('ImagePdfViewer', {
        storageKey,
        totalPages,
        title,
      });
    }
  }, [pdfFileName, storageKey, totalPages, title, navigation]);

  /* ---------- SOURCE ---------- */
  const pdfSource = pdfFileName
    ? { uri: `bundle-assets://pdf/${pdfFileName}` }
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
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
            <ActivityIndicator size="large" color="#0EA5A4" />
            <Text style={styles.infoText}>
              Opening document…
            </Text>
          </View>
        )}

        {pdfSource && (
          <>
            <Pdf
              source={pdfSource}
              style={styles.pdf}
              onLoadComplete={() => {
                setLoading(false);
                setError(null);
              }}
              onError={(err) => {
                console.warn('PDF ERROR', err);
                setLoading(false);
                setError(String(err));
                Alert.alert(
                  'PDF Error',
                  'Unable to open PDF file'
                );
              }}
            />

            {loading && !error && (
              <View style={styles.overlay}>
                <ActivityIndicator size="large" />
                <Text style={styles.overlayText}>
                  Loading PDF…
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>
                  Failed to load PDF
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

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

  infoText: {
    marginTop: 8,
    color: '#374151',
    fontWeight: '600',
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
