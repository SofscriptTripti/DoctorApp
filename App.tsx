import React from 'react';
import { StatusBar, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientScreen from './android/src/PatientScreen';
import FormType from './android/src/FormType';
import { FormImageScreen } from './android/src/FormImageScreen';
import FormImageEditor from './android/src/FormImageEditor';
// NOTE: FormImageEditor will be lazy-required (see below)

const Stack = createNativeStackNavigator();

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Patients" component={PatientScreen} />
          <Stack.Screen name="FormType" component={FormType} />

          {/* Lazy-load the editor to avoid requiring native module at app startup
          <Stack.Screen
            name="FormImageEditor"
            getComponent={() => require('./android/src/FormImageEditor').default}
          /> */}
           <Stack.Screen name="FormImageEditor" component={FormImageEditor} />

          <Stack.Screen name="FormImageScreen" component={FormImageScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
