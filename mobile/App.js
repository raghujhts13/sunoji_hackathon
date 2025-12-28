import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import HomeScreen from './src/screens/HomeScreen';
import { colors } from './src/theme';

/**
 * Sunoji.me - AI Voice Companion
 * 
 * A low-latency speech-to-speech AI companion application
 * that analyzes user intent, tone, and phrases to generate
 * emotionally-appropriate voice responses.
 */
export default function App() {
  return (
    <View style={styles.container}>
      {/* Gradient Background */}
      <View style={styles.gradientContainer}>
        <LinearGradient
          colors={['rgba(102, 126, 234, 0.15)', 'transparent']}
          style={styles.gradientTopLeft}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={['rgba(118, 75, 162, 0.15)', 'transparent']}
          style={styles.gradientBottomRight}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
        />
      </View>

      <HomeScreen />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradientContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  gradientTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '60%',
    height: '40%',
  },
  gradientBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '60%',
    height: '40%',
  },
});
