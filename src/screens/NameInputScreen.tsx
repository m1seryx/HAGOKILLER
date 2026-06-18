import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

const ZzzDot: React.FC<{ letter: string; delay: number; baseX: number }> = ({ letter, delay, baseX }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -30, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(600 - delay),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.Text style={[styles.zzz, { left: baseX, opacity, transform: [{ translateY }, { scale }] }]}>
      {letter}
    </Animated.Text>
  );
};

interface NameInputScreenProps {
  onNameSubmit: (name: string) => void;
}

export const NameInputScreen: React.FC<NameInputScreenProps> = ({ onNameSubmit }) => {
  const [name, setName] = useState('');

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <FontAwesome5 name="bed" size={64} color="#3b82f6" />
          <ZzzDot letter="z" delay={0}   baseX={52} />
          <ZzzDot letter="Z" delay={350} baseX={66} />
          <ZzzDot letter="Z" delay={700} baseX={80} />
        </View>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>What should we call you?</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          placeholderTextColor="#6b7280"
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && onNameSubmit(name.trim())}
        />
        <TouchableOpacity
          style={[styles.button, !name.trim() && styles.buttonDisabled]}
          onPress={() => name.trim() && onNameSubmit(name.trim())}
          disabled={!name.trim()}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 32 },
  iconWrapper: { marginBottom: 24, width: 120, height: 80, justifyContent: 'flex-end', alignItems: 'flex-start' },
  zzz: { position: 'absolute', bottom: 60, color: '#93c5fd', fontWeight: '800', fontSize: 18 },
  logo: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#9ca3af', marginBottom: 40 },
  input: {
    width: '100%', backgroundColor: '#2d2d44', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    color: '#ffffff', borderWidth: 1, borderColor: '#3d3d5c', marginBottom: 16,
  },
  button: {
    width: '100%', backgroundColor: '#3b82f6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#2d2d44' },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
});
