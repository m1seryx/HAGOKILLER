import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface NameInputScreenProps {
  onNameSubmit: (name: string) => void;
}

export const NameInputScreen: React.FC<NameInputScreenProps> = ({ onNameSubmit }) => {
  const [name, setName] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.iconRing}>
          <View style={styles.iconCircle}>
            <FontAwesome5 name="user-astronaut" size={32} color="#6366f1" />
          </View>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>Welcome Aboard</Text>
          <Text style={styles.subtitle}>Personalize your sleep analytics profile</Text>
        </View>

        <View style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused
        ]}>
          <FontAwesome5 
            name="user" 
            size={14} 
            color={isFocused ? '#6366f1' : '#6b7280'} 
            style={styles.inputIcon} 
          />
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor="#6b7280"
            value={name}
            onChangeText={setName}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => name.trim() && onNameSubmit(name.trim())}
          />
        </View>

        <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%' }}>
          <TouchableOpacity
            style={[styles.button, !name.trim() && styles.buttonDisabled]}
            onPress={() => name.trim() && onNameSubmit(name.trim())}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={!name.trim()}
            activeOpacity={0.9}
          >
            <Text style={[styles.buttonText, !name.trim() && styles.buttonTextDisabled]}>
              Initialize Dashboard
            </Text>
            <FontAwesome5 
              name="arrow-right" 
              size={12} 
              color={!name.trim() ? '#6b7280' : '#ffffff'} 
              style={{ marginLeft: 8, marginTop: 2 }} 
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0b10', 
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: { 
    backgroundColor: 'rgba(26, 27, 38, 0.75)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(26, 27, 38, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#ffffff', 
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: { 
    fontSize: 13, 
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%', 
    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
    borderRadius: 16,
    paddingHorizontal: 16, 
    borderWidth: 1.5, 
    borderColor: 'rgba(255, 255, 255, 0.08)', 
    marginBottom: 24,
  },
  inputContainerFocused: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16, 
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff', 
  },
  button: {
    flexDirection: 'row',
    width: '100%', 
    backgroundColor: '#6366f1', 
    borderRadius: 16,
    paddingVertical: 16, 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { 
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  buttonTextDisabled: {
    color: '#6b7280',
  },
});
