import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Image,
  Alert,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';

// Doctor illustration provided by user
const DOCTOR_IMAGE =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS5xIdiEYl9QZrTM9v2uLGSxbulNWg3xxnXiw&s';

type Theme = 'light' | 'dark';

const BRAND = {
  name: 'CareScribe',
  primary: '#0EA5A4',
  accent: '#06B6D4',
  success: '#10B981',
  danger: '#EF4444',
};

export default function CareScribeLogin({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');

  const [emailError, setEmailError] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // animation
  const cardAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const validate = () => {
    let ok = true;

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email.trim())) {
      setEmailError('Please enter a valid email address');
      ok = false;
    } else setEmailError(null);

    if (password.length < 6) {
      setPwdError('Password must be at least 6 characters');
      ok = false;
    } else setPwdError(null);

    return ok;
  };

  const handleLogin = () => {
    if (!validate()) return;

    // Navigate to PatientScreen instead of showing alert
    navigation.navigate('PatientScreen');
  };

  const handleSocial = (provider: string) => {
    Alert.alert('Social Login', `${provider} login clicked`);
  };

  const isDark = theme === 'dark';
  const bg = isDark ? stylesDark : stylesLight;

  const translateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <SafeAreaView style={[styles.container, bg.container]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header / Hero */}
            <View style={[styles.header, { backgroundColor: BRAND.primary }]}>
              <View style={styles.headerInner}>
                <View style={styles.headerTextWrap}>
                  <Text style={styles.brandName}>{BRAND.name}</Text>
                  <Text style={styles.brandTag}>Care, Capture, Connect</Text>
                </View>
              </View>

              {/* Doctor illustration — sits centered and overlaps the card below */}
              {/* <View style={styles.heroWrap} pointerEvents="none">
                <Image source={{ uri: DOCTOR_IMAGE }} style={styles.heroImage} />
              </View> */}
            </View>

            {/* Card */}
            <Animated.View
              style={[
                styles.card,
                bg.card,
                {
                  transform: [{ translateY }],
                  opacity: cardAnim,
                },
              ]}
            >
              <Text style={[styles.h1, bg.text]}>Welcome </Text>
              <Text style={[styles.sub, bg.subText]}>
                Sign in to continue to {BRAND.name}
              </Text>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, bg.label]}>Email</Text>
                <TextInput
                  style={[styles.input, bg.input]}
                  placeholder="you@domain.com"
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    // Optionally focus next input
                  }}
                />
                {!!emailError && <Text style={styles.errText}>{emailError}</Text>}
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <View style={styles.rowSpace}>
                  <Text style={[styles.label, bg.label]}>Password</Text>
                  <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
                    <Text style={[styles.showText, bg.showText]}>
                      {showPwd ? 'Hide' : 'Show'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[styles.input, bg.input]}
                  placeholder="Your secure password"
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  secureTextEntry={!showPwd}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                {!!pwdError && <Text style={styles.errText}>{pwdError}</Text>}
              </View>

              {/* Remember / Forgot */}
              <View style={[styles.rowSpace, { marginTop: 8 }]}>
                <View style={styles.rowCenter}>
                  <TouchableOpacity onPress={() => setRemember(!remember)}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: remember ? BRAND.primary : '#D1D5DB',
                          backgroundColor: remember ? BRAND.primary : 'transparent',
                        },
                      ]}
                    >
                      {remember && <View style={styles.checkboxTick} />}
                    </View>
                  </TouchableOpacity>

                  <Text style={[styles.smallText, bg.smallText, { marginLeft: 8 }]}>
                    Remember me
                  </Text>
                </View>

                <TouchableOpacity onPress={() => Alert.alert('Forgot Password')}>
                  <Text style={[styles.smallText, { color: BRAND.primary }]}>
                    Forgot?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: BRAND.primary }]}
                onPress={handleLogin}
              >
                <Text style={styles.primaryBtnText}>Sign in</Text>
              </TouchableOpacity>

              {/* Optional: Add some spacing at the bottom for better scrolling */}
              <View style={styles.bottomSpacing} />
            </Animated.View>

            {/* FIXED FOOTER — always visible */}
            <View style={styles.footerPinned}>
              <Text style={[styles.footerText, bg.smallText]}>
                Secure • Private • Designed for caregivers
              </Text>

              <Text style={styles.signatureTextPinned}>
                Crafted with <Text style={styles.heart}>❤️</Text> by Sofscript
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

// Updated Styles
const styles = StyleSheet.create({
  container: { flex: 1 },
  
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 100, // Extra padding for footer
  },

  header: {
    height: 220,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    elevation: 6,
    overflow: 'visible',
  },

  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  headerTextWrap: { marginLeft: 6 },

  brandNameLite: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  brandName: { color: '#fff', fontSize: 26, fontWeight: '900' },
  brandTag: { color: 'rgba(255,255,255,0.9)', marginTop: 4, fontSize: 12 },

  heroWrap: {
    alignItems: 'center',
    marginTop: 6,
    // pull image down to overlap card
    marginBottom: -60,
  },
  heroImage: {
    width: 128,
    height: 128,
    borderRadius: 20,
    borderWidth: 6,
    borderColor: '#fff',
    backgroundColor: '#fff',
    // shadow
    elevation: 8,
  },

  card: {
    marginHorizontal: 18,
    marginTop: -40,
    padding: 18,
    borderRadius: 16,
    elevation: 6,
    marginBottom: 20,
  },

  h1: { fontSize: 22, fontWeight: '800' },
  sub: { marginTop: 6, fontSize: 13, marginBottom: 10 },

  inputGroup: { marginTop: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },

  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
  },

  rowSpace: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  rowCenter: { flexDirection: 'row', alignItems: 'center' },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxTick: {
    width: 10,
    height: 10,
    backgroundColor: '#fff',
    borderRadius: 2,
  },

  smallText: { fontSize: 12 },

  showText: { fontSize: 13, fontWeight: '700' },

  primaryBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  orRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E6EEF2' },
  orText: { marginHorizontal: 10, fontSize: 12 },

  socialRow: { flexDirection: 'row', marginTop: 12 },
  socialBtn: {
    flex: 1,
    marginHorizontal: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  socialText: { fontWeight: '700' },

  errText: { color: BRAND.danger, fontSize: 12, marginTop: 4 },

  // FIXED FOOTER
  footerPinned: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: { fontSize: 12, marginBottom: 6 },

  signatureTextPinned: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  heart: { color: '#EF4444' },

  bottomSpacing: {
    height: 40, // Extra spacing at bottom for better scrolling
  },
});

// Light Theme
const stylesLight = StyleSheet.create({
  container: { backgroundColor: '#F8FAFC' },
  card: { backgroundColor: '#fff' },
  text: { color: '#0F1724' },
  subText: { color: '#475569' },
  label: { color: '#0F1724' },
  input: { color: '#0F1724', borderColor: '#E5E7EB' },
  showText: { color: '#0F1724' },
  smallText: { color: '#475569' },
});

// Dark Theme
const stylesDark = StyleSheet.create({
  container: { backgroundColor: '#0B1220' },
  card: { backgroundColor: '#071229' },
  text: { color: '#E6EEF2' },
  subText: { color: '#94A3B8' },
  label: { color: '#E6EEF2' },
  input: { color: '#E6EEF2', borderColor: '#1F2937' },
  showText: { color: '#E6EEF2' },
  smallText: { color: '#94A3B8' },
});