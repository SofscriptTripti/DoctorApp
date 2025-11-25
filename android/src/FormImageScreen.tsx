// src/FormImageScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';

const { width: W, height: H } = Dimensions.get('window');

const resolveImages = (): any | null => {
  try { return require('./Images').default ?? require('./Images'); } catch (_) {}
  try { return require('../android/src/Images').default ?? require('../android/src/Images'); } catch (_) {}
  try { return require('../src/Images').default ?? require('../src/Images'); } catch (_) {}
  return null;
};

const Images = resolveImages();
const REMOTE_TEST_IMAGE =
  'https://cdn.marketing123.123formbuilder.com/wp-content/uploads/2020/12/hospital-admission-form.png';

export function FormImageScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const params = (route.params as any) || {};

  const passedUri: string | undefined = params.imageUri;

  const localFirstImage =
    Images?.first ?? Images?.First ?? Images?.FIRST ?? Images?.firstJpeg ?? null;

  const initialSource: any = passedUri ? { uri: passedUri } : localFirstImage ?? { uri: REMOTE_TEST_IMAGE };
  const testImageSource: any = localFirstImage ?? { uri: REMOTE_TEST_IMAGE };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState<any>(initialSource);
  const [isLocal, setIsLocal] = useState<boolean>(Boolean(localFirstImage) && !passedUri);

  useEffect(() => {
    const newSource = passedUri ? { uri: passedUri } : localFirstImage ?? { uri: REMOTE_TEST_IMAGE };
    setSrc(newSource);
    setIsLocal(Boolean(localFirstImage) && !passedUri);
    setLoading(true);
    setError(null);
  }, [passedUri, localFirstImage]);

  const onLoad = () => {
    setLoading(false);
    setError(null);
  };

  const onError = (e: any) => {
    console.warn('[FormImageScreen] image load error:', e?.nativeEvent || e);
    setLoading(false);
    setError('Failed to load image');

    if (!isLocal && testImageSource) {
      setSrc(testImageSource);
      setIsLocal(Boolean(localFirstImage));
      setLoading(true);
      setError(null);
    }
  };

  const retryOriginal = () => {
    setError(null);
    setLoading(true);
    const original = passedUri ? { uri: passedUri } : localFirstImage ?? { uri: REMOTE_TEST_IMAGE };
    setSrc(original);
    setIsLocal(Boolean(localFirstImage) && !passedUri);
  };

  // Unique storage key per form (so saved strokes for one form don't overwrite another)
  const storageKeyForThisForm = `DoctorApp:strokesByForm:${(params.formName as string) ?? 'unnamed'}:v1`;

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

        {src ? (
          <Image
            source={src}
            style={styles.image}
            resizeMode="contain"
            onLoad={onLoad}
            onError={onError}
          />
        ) : (
          <View style={[styles.image, styles.missingBox]}>
            <Text style={styles.missingText}>No image available</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Unable to load image.</Text>

            <TouchableOpacity style={styles.retryBtn} onPress={retryOriginal}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.retryBtn, { marginTop: 8 }]}
              onPress={() => {
                // continue to editor even if image load failed
                navigation.navigate('FormImageEditor', {
                  imageUri: passedUri ?? null,
                  localImageModule: !passedUri && localFirstImage ? localFirstImage : null,
                  formName: params.formName,
                  singleImageMode: true,
                  storageKey: storageKeyForThisForm,
                });
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
          onPress={() =>
            navigation.navigate('FormImageEditor', {
              imageUri: passedUri ?? null,
              localImageModule: !passedUri && localFirstImage ? localFirstImage : null,
              formName: params.formName,
              singleImageMode: true,
              storageKey: storageKeyForThisForm,
            })
          }
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
  missingBox: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  missingText: { color: '#999' },
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
