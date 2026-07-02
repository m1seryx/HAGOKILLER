import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { isValidPairingPin } from '../utils/pinValidation';

interface PairingPinScreenProps {
  onPinSubmit: (pin: string) => void;
}

export const PairingPinScreen: React.FC<PairingPinScreenProps> = ({ onPinSubmit }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (isValidPairingPin(pin)) {
      setError('');
      onPinSubmit(pin);
      return;
    }

    setError('Enter a 7-digit pairing PIN');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text style={styles.title}>Pairing PIN</Text>
        <Text style={styles.subtitle}>Enter the 7-digit PIN to access the dashboard.</Text>
        <TextInput
          style={styles.input}
          placeholder="1234567"
          placeholderTextColor="#6b7280"
          value={pin}
          onChangeText={(value) => {
            setPin(value);
            if (error) setError('');
          }}
          keyboardType="number-pad"
          maxLength={7}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, pin.length !== 7 && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={pin.length !== 7}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3d3d5c',
    marginBottom: 12,
    letterSpacing: 4,
  },
  button: {
    width: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#2d2d44',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  error: {
    color: '#fca5a5',
    marginBottom: 8,
  },
});
