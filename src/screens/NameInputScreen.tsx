import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface NameInputScreenProps {
  onNameSubmit: (name: string) => void;
}

export const NameInputScreen: React.FC<NameInputScreenProps> = ({ onNameSubmit }) => {
  const [name, setName] = useState('');

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <FontAwesome5 name="bed" size={64} color="#3b82f6" style={styles.logo} />
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
