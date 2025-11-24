// FormImageScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

const { width: W, height: H } = Dimensions.get('window');

export function FormImageScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const params = (route.params as any) || {};

  // Use the passed uri, otherwise use a default jpg. Also provide a safe fallback test image.
  const imageUri: string =
    params.imageUri ||
    'https://cdn.marketing123.123formbuilder.com/wp-content/uploads/2020/12/hospital-admission-form.png';

  // A small known-to-work test image (use this to diagnose network/permission issues)
  const testImage = 'https://cdn.marketing123.123formbuilder.com/wp-content/uploads/2020/12/hospital-admission-form.png';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState(imageUri);

  useEffect(() => {
    // If you want automatic fallback to a test image on first failure, you can implement here.
    setSrc(imageUri);
    setLoading(true);
    setError(null);
  }, [imageUri]);

  const onLoad = () => {
    setLoading(false);
    setError(null);
    console.log('[FormImageScreen] image loaded:', src);
  };

  const onError = (e: any) => {
    console.warn('[FormImageScreen] image load error:', e?.nativeEvent || e);
    setLoading(false);
    setError('Failed to load image');

    // Optionally try the tiny test image once to distinguish network/permission issues
    if (src !== testImage) {
      console.log('[FormImageScreen] trying fallback test image to diagnose...');
      setSrc(testImage);
      setLoading(true);
      setError(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{(params.formName as string) || 'Form'}</Text>
      </View>

      <View style={styles.imageWrap}>
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading image...</Text>
          </View>
        )}

        {/* show the image (resizeMode contain so it fits) */}
        <Image
          source={{ uri: src }}
          style={styles.image}
          resizeMode="contain"
          onLoad={onLoad}
          onError={onError}
        />

        {/* show error state */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Unable to load image.</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setError(null);
                setLoading(true);
                setSrc(imageUri); // retry original image
              }}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryBtn, { marginTop: 8 }]}
              onPress={() => {
                // open editor anyway with whatever URI
                navigation.navigate('FormImageEditor', { imageUri, formName: params.formName });
              }}
            >
              <Text style={styles.retryText}>Open Editor (continue)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('FormImageEditor', { imageUri, formName: params.formName })}
        >
          <Text style={styles.editBtnText}>Open Editor</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, backgroundColor: '#0EA5A4' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  imageWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F7FAFD',
  },
  image: { width: W - 24, height: H * 0.6, backgroundColor: '#fff' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },
  editBtn: { backgroundColor: '#0EA5A4', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  editBtnText: { color: '#fff', fontWeight: '700' },
  centered: { position: 'absolute', alignItems: 'center', zIndex: 10 },
  loadingText: { marginTop: 8 },
  errorBox: {
    position: 'absolute',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderColor: '#eee',
    borderWidth: 1,
    zIndex: 11,
  },
  errorText: { color: '#b00020', fontWeight: '700' },
  retryBtn: {
    marginTop: 10,
    backgroundColor: '#0EA5A4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '700' },
});
