import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { isValidPairingPin } from "../utils/pinValidation";
import { bleService } from "../services/mockBLEService";

interface PairingPinScreenProps {
  onPinSubmit: (pin: string) => void;
  onSkipDemo?: () => void;
}

const PIN_LENGTH = 7;

export const PairingPinScreen: React.FC<PairingPinScreenProps> = ({
  onPinSubmit,
  onSkipDemo,
}) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handlePinChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (error) setError("");
  };

  const handleSubmit = async () => {
    if (!isValidPairingPin(pin)) {
      setError("Please enter all 7 digits from your pillow label.");
      return;
    }

    setError("");
    setConnecting(true);
    try {
      const devices = await bleService.scanForDevices();
      const target = devices[0];
      if (!target) {
        throw new Error("No smart pillow found nearby.");
      }
      await bleService.pair(target, pin);
      onPinSubmit(pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing failed. Try again.");
    } finally {
      setConnecting(false);
    }
  };

  const digits = pin.split("");
  while (digits.length < PIN_LENGTH) {
    digits.push("");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <FontAwesome5 name="lock" size={20} color="#ffffff" />
            </View>
          <Text style={styles.title}>Connect Your Pillow</Text>
          <Text style={styles.subtitle}>
            Find the 7-digit PIN on the sticker under your smart pillow, then
            enter it below. Demo PIN: 1234567
          </Text>
        </View>

        <TouchableOpacity
          style={styles.pinRow}
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
        >
          {digits.map((digit, index) => (
            <View
              key={index}
              style={[
                styles.pinBox,
                digit ? styles.pinBoxFilled : null,
                index === pin.length && pin.length < PIN_LENGTH
                  ? styles.pinBoxActive
                  : null,
              ]}
            >
              <Text style={styles.pinDigit}>{digit}</Text>
            </View>
          ))}
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={pin}
          onChangeText={handlePinChange}
          keyboardType="number-pad"
          maxLength={PIN_LENGTH}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          accessibilityLabel="Pairing PIN"
        />

        <Text style={styles.progressText}>
          {pin.length} of {PIN_LENGTH} digits entered
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            styles.button,
            (pin.length !== PIN_LENGTH || connecting) && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={pin.length !== PIN_LENGTH || connecting}
          activeOpacity={0.85}
        >
          {connecting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text
              style={[
                styles.buttonText,
                pin.length !== PIN_LENGTH && styles.buttonTextDisabled,
              ]}
            >
              Pair & Connect
            </Text>
          )}
        </TouchableOpacity>

        {onSkipDemo ? (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={async () => {
              setConnecting(true);
              try {
                const devices = await bleService.scanForDevices();
                if (devices[0]) {
                  await bleService.pair(devices[0], "1234567");
                }
              } catch (_) {
                // Demo still continues
              } finally {
                setConnecting(false);
                onSkipDemo();
              }
            }}
            disabled={connecting}
          >
            <Text style={styles.skipText}>Continue without device (demo)</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#090b14",
  },
  container: {
    flex: 1,
    backgroundColor: "#090b14",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  content: {
    backgroundColor: "rgba(18, 21, 42, 0.95)",
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 10,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 32,
    backgroundColor: "rgba(99, 102, 241, 0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  pinRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 6,
  },
  pinBox: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  pinBoxFilled: {
    borderColor: "rgba(99, 102, 241, 0.5)",
    backgroundColor: "rgba(99, 102, 241, 0.1)",
  },
  pinBoxActive: {
    borderColor: "#6366f1",
  },
  pinDigit: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 0,
    width: 0,
  },
  progressText: {
    color: "#9ca3af",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 14,
  },
  button: {
    width: "100%",
    backgroundColor: "#6366f1",
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 5,
    minHeight: 52,
  },
  buttonDisabled: {
    backgroundColor: "rgba(99, 102, 241, 0.25)",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  buttonTextDisabled: {
    color: "#c7d2fe",
  },
  error: {
    color: "#fca5a5",
    marginBottom: 12,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  skipText: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "600",
  },
});
