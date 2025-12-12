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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Theme = 'light' | 'dark';

const BRAND = {
  name: 'CareScribe',
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

  // animation
  const cardAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cardAnim]);

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
    outputRange: [50, 0],
  });

  const cardScale = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
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
            bounces={false}
          >
            {/* Logo Header */}
            <View style={styles.logoContainer}>
            {/* <View style={styles.logoBadge}> */}
  <Image
    source={require('../Images/Carescribe_logo with text-01.png')}
    style={styles.logo}
    resizeMode="contain"
  />
  <Text style={styles.logoTagline}>
  Turning data into compassionate care ...
</Text>

{/* </View> */}


           
            </View>

            {/* Full Screen Card */}
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
                  style={[styles.bottomButton, { backgroundColor: BRAND.primary }]}
                  onPress={handleLogin}
                >
                  <Text style={styles.bottomButtonText}>
                    Sign in to Continue
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  paddingTop: 0,
  paddingBottom: 20,
   paddingHorizontal: 20, 
},
logoTagline: {
  fontSize: 14,
  fontWeight: '600',
  color: '#010e0eff',       // CareScribe primary color
  // marginTop: 8,
  textAlign: 'center',
  letterSpacing: 0.3,
  bottom:75
},

  logoBadge: {
     // ensures image stays inside circle
  },
  
 logo: {
   width: Dimensions.get('window').width -140,
  height: Dimensions.get('window').width * 0.35, // keep aspect ratio (adjust as needed)
  resizeMode: 'contain', // or 'contain'
  padding:10,
  color:"#0EA5A4",
  
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
});
