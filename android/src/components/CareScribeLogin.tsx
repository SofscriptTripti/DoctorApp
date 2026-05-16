import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Image,
  Alert,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { login } from '../api/authApi';
import { saveAuth, getAccessToken, getUserInfo } from '../storage/authStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';



type Theme = 'light' | 'dark';
const USER_STORAGE_KEYS = {
  userId: 'userId',
  fullName: 'fullName',
  tenantCode: 'tenantCode',
  department: 'department', // ✅ Added
};

// ... (saveUserContext function remains same)
const saveUserContext = async (
  userId: string,
  fullName: string,
  tenantCode: string,
  department: string // ✅ Added
) => {
  try {
    await AsyncStorage.multiSet([
      [USER_STORAGE_KEYS.userId, userId || ''],
      [USER_STORAGE_KEYS.fullName, fullName || ''],
      [USER_STORAGE_KEYS.tenantCode, tenantCode || ''],
      [USER_STORAGE_KEYS.department, department || ''], // ✅ Added
    ]);

    console.log('✅ User context saved', {
      userId,
      fullName,
      tenantCode,
      department,
    });
  } catch (e) {
    console.error('❌ Failed to save user context', e);
  }
};


const BRAND = {
  name: 'Slate',
  primary: '#0EA5A4',
  accent: '#06B6D4',
  success: '#10B981',
  danger: '#EF4444',
};

export default function CareScribeLogin({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');

  const [emailError, setEmailError] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // OTP States
  const [otpVisible, setOtpVisible] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [tempAuthData, setTempAuthData] = useState<any>(null);

  const otpInputs = useRef<Array<TextInput | null>>([]);

  // Auto-login check
  useEffect(() => {
    const checkUser = async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          console.log('🔄 Found existing token, auto-logging in...');

          // ✅ NEW: Restore user context from storage to ensure individual keys exist
          try {
            const userInfo = await getUserInfo();
            if (userInfo && userInfo.userId) {
              console.log('Restoring user context for:', userInfo.fullName);
              await saveUserContext(
                userInfo.userId,
                userInfo.fullName || 'Unknown Doctor',
                userInfo.tenantCode || 'HOSP1',
                userInfo.department || 'Unavailable'
              );
            }
          } catch (restoreErr) {
            console.warn('Failed to restore user context during auto-login', restoreErr);
          }

          navigation.reset({
            index: 0,
            routes: [{ name: 'PatientScreen' }],
          });
        }
      } catch (e) {
        console.error('Auto-login check failed', e);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkUser();
  }, []);

  // animation
  const cardAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!checkingAuth) {
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [cardAnim, checkingAuth]);

  const validate = () => {
    let ok = true;

    if (!email.trim()) {
      setEmailError('Username is required');
      ok = false;
    } else {
      setEmailError(null);
    }

    if (password.length < 6) {
      setPwdError('Password must be at least 6 characters');
      ok = false;
    } else {
      setPwdError(null);
    }

    return ok;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      const response = await login(
        email.trim(),
        password,
        'HOSP1'
      );


      // Store response and show OTP modal instead of immediate navigation
      setTempAuthData(response);
      setOtpVisible(true);
      setOtp(['', '', '', '']); // Reset OTP on open
      setOtpError(null); // Clear previous errors
    } catch (error: any) {
      console.error('Login error', error);
      Alert.alert(
        'Login Failed',
        error?.response?.data?.message ||
        'Unable to login. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (otpError) setOtpError(null); // Clear error on typing

    // Auto-focus next input
    if (value && index < 3) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpString = otp.join('');
    if (otpString.length === 0) {
      setOtpError('Filling OTP is Mandatory.');
      return;
    }
    if (otpString.length < 4) {
      setOtpError('Please fill all 4 digits.');
      return;
    }

    try {
      setOtpLoading(true);
      // Simulate verification delay
      await new Promise(resolve => setTimeout(() => resolve(null), 800));

      // Proceed with saving auth and navigation
      const response = tempAuthData;
      await saveAuth(response.accessToken, response.refreshToken, response.userInfo);

      await saveUserContext(
        response.userInfo.userId,
        response.userInfo.fullName, // Pass fullName
        response.userInfo.tenantCode,
        response.userInfo.department || 'Unavailable'
      );

      setOtpVisible(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'PatientScreen' }],
      });
    } catch (error) {
      Alert.alert('Verification Failed', 'Invalid OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };


  const handleSocial = (provider: string) => {
    Alert.alert('Social Login', `${provider} login clicked`);
  };

  const isDark = theme === 'dark';
  const bg = isDark ? stylesDark : stylesLight;

  const translateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  const cardScale = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  if (checkingAuth) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }, bg.container]}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

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
            bounces={false}
          >
            {/* Logo Header */}
            <View style={styles.logoContainer}>
              {/* <View style={styles.logoBadge}> */}
              <Image
                source={require('../Images/Slatelogo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.logoTagline}>
                Turning data into compassionate care ...
              </Text>

              {/* </View> */}



            </View>

            <Animated.View
              style={[
                styles.fullScreenCard,
                bg.card,
                {
                  transform: [{ translateY }, { scale: cardScale }],
                  opacity: cardAnim,
                  minHeight: screenHeight - insets.top - 3800,
                },
              ]}
            >
              {/* subtle top accent */}
              <View style={styles.cardAccentBar} />

              {/* Welcome Section */}
              <View style={styles.welcomeSection}>
                <Text style={[styles.h1, bg.text]}>Welcome</Text>
                <Text style={[styles.sub, bg.subText]}>
                  Sign in to continue to {BRAND.name}
                </Text>
              </View>

              {/* Login Form */}
              <View style={styles.formContainer}>
                {/* Email */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, bg.label]}>Email Address</Text>
                  <TextInput
                    style={[styles.input, bg.input]}
                    placeholder="you@domain.com"
                    placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="username"
                    autoComplete="email"
                    value={email}
                    onChangeText={setEmail}
                    returnKeyType="next"
                    blurOnSubmit={false}
                  />
                  {!!emailError && (
                    <Text style={styles.errText}>{emailError}</Text>
                  )}
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
                    textContentType="password"
                    autoComplete="password"
                    value={password}
                    onChangeText={setPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  {!!pwdError && (
                    <Text style={styles.errText}>{pwdError}</Text>
                  )}
                </View>

                {/* Security Footer (kept, just colored line) */}
                <View style={styles.securityFooter}>

                </View>
              </View>

              {/* Sign In Button at bottom INSIDE card */}
              <View style={styles.cardBottomSection}>
                <TouchableOpacity
                  style={[
                    styles.bottomButton,
                    { backgroundColor: loading ? '#94A3B8' : BRAND.primary },
                  ]}
                  onPress={handleLogin}
                  disabled={loading}
                >

                  <Text style={styles.bottomButtonText}>
                    {loading ? 'Signing in...' : 'Sign in to Continue'}
                  </Text>

                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* OTP Verification Modal */}
        <Modal
          visible={otpVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setOtpVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <Animated.View style={[styles.otpCard, bg.otpCard]}>
              <TouchableOpacity
                style={styles.otpCloseButton}
                onPress={() => setOtpVisible(false)}
              >
                <Ionicons name="close" size={24} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
              <View style={styles.otpHeader}>
                {/* <Text style={[styles.otpTitle, bg.text]}>Verify Identity</Text> */}
                <Text style={[styles.otpSub, bg.subText]}>
                  Please enter the 4-digit code sent to your registered Email ID.
                </Text>
              </View>

              <View style={styles.otpInputRow}>
                {otp.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(ref) => { otpInputs.current[idx] = ref; }}
                    style={[styles.otpBox, bg.otpBox, (digit ? styles.otpBoxActive : null)]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(val) => handleOtpChange(val, idx)}
                    onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                    placeholder="•"
                    placeholderTextColor={isDark ? '#334155' : '#CBD5E1'}
                  />
                ))}
              </View>

              <View style={styles.otpFooter}>
                {!!otpError && (
                  <Text style={styles.otpErrorText}>{otpError}</Text>
                )}
                <TouchableOpacity
                  style={[styles.otpButton, { backgroundColor: otpLoading ? '#94A3B8' : BRAND.primary }]}
                  onPress={handleVerifyOtp}
                  disabled={otpLoading}
                >
                  {otpLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.otpButtonText}>Confirm & Continue</Text>
                  )}
                </TouchableOpacity>


              </View>
            </Animated.View>
          </View>
        </Modal>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

// Updated Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  logoContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: -15, // Pulls the container up to reduce the top gap
    paddingTop: 0,
    paddingBottom: 20,
    paddingHorizontal: 0, // Removed padding entirely for maximum width
  },
  logoTagline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#010e0eff',       // CareScribe primary color
    marginTop: -45,           // Pulled up further to compensate for the larger logo height
    textAlign: 'center',
    letterSpacing: 0.3,
    // bottom:75
  },

  logoBadge: {
    // ensures image stays inside circle
  },

  logo: {
    width: Dimensions.get('window').width * 1.4, // Massively scaled beyond screen width
    height: Dimensions.get('window').width * 0.5, // Height increased proportionally
    resizeMode: 'contain',
    color: "#0EA5A4",
  },


  logoText: {
    fontSize: 30,
    fontWeight: '900',
    color: BRAND.primary,
    marginTop: 10,
    marginBottom: 6,
    letterSpacing: 0.5,
  },

  taglinePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(6,182,212,0.12)',
  },

  tagline: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },

  fullScreenCard: {
    flex: 1,
    marginHorizontal: 16,
    // marginTop: 8,
    borderRadius: 24,
    padding: 24,
    elevation: 8,
    shadowColor: '#0EA5A4',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(14,165,164,0.18)',
  },

  cardAccentBar: {
    height: 4,
    borderRadius: 999,
    backgroundColor: BRAND.accent,
    marginBottom: 18,
    width: 80,
    alignSelf: 'flex-start',
  },

  welcomeSection: {
    marginBottom: 24,
  },

  h1: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },

  sub: {
    fontSize: 16,
    fontWeight: '400',
  },

  formContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },

  inputGroup: {
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },

  input: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    fontSize: 16,
    fontWeight: '400',
  },

  rowSpace: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  checkboxTick: {
    width: 10,
    height: 10,
    backgroundColor: '#fff',
    borderRadius: 2,
  },

  smallText: {
    fontSize: 14,
  },

  showText: {
    fontSize: 14,
    fontWeight: '600',
  },

  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },

  orLine: {
    flex: 1,
    height: 1,
  },

  orText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },

  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },

  socialBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
  },

  socialText: {
    fontWeight: '600',
    fontSize: 14,
  },

  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  securityFooter: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(14,165,164,0.18)',
    marginTop: 'auto',
  },

  footerText: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 10,
  },

  // Bottom section INSIDE card
  cardBottomSection: {
    marginTop: 24,
  },

  bottomButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#0EA5A4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },

  bottomButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  errText: {
    color: BRAND.danger,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },

  // OTP Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  otpCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#0EA5A4',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  otpCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  otpHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  otpTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },
  otpSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  otpInputRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  otpBox: {
    width: 56,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
  },
  otpBoxActive: {
    borderColor: BRAND.primary,
    backgroundColor: 'rgba(14, 165, 164, 0.05)',
  },
  otpFooter: {
    width: '100%',
  },
  otpButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
  },
  otpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  otpCancel: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  otpCancelText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  otpErrorText: {
    color: BRAND.danger,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
});

// Light Theme
const stylesLight = StyleSheet.create({
  container: { backgroundColor: '#ECFEFF' }, // more colorful, teal tint
  card: { backgroundColor: '#FFFFFF' },
  text: { color: '#0F172A' },
  subText: { color: '#0F766E' },
  label: { color: '#0F766E' },
  input: {
    color: '#0F172A',
    borderColor: '#BAE6FD',
    backgroundColor: '#F0FDFA',
  },
  showText: { color: BRAND.accent },
  smallText: { color: '#64748B' },
  socialBtn: { borderColor: '#E2E8F0' },
  orLine: { backgroundColor: '#E2E8F0' },
  otpCard: { backgroundColor: '#FFFFFF' },
  otpBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    color: '#0F172A'
  },
});

// Dark Theme
const stylesDark = StyleSheet.create({
  container: { backgroundColor: '#020617' },
  card: { backgroundColor: '#020617' },
  text: { color: '#F1F5F9' },
  subText: { color: '#67E8F9' },
  label: { color: '#E2E8F0' },
  input: {
    color: '#F1F5F9',
    borderColor: '#334155',
    backgroundColor: '#020617',
  },
  showText: { color: '#67E8F9' },
  smallText: { color: '#94A3B8' },
  socialBtn: { borderColor: '#334155' },
  orLine: { backgroundColor: '#334155' },
  otpCard: { backgroundColor: '#020617', borderColor: 'rgba(14,165,164,0.3)', borderWidth: 1 },
  otpBox: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    color: '#F1F5F9'
  },
});
