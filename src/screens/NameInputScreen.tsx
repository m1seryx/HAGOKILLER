import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  ScrollView,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import moment from "moment";
import { UserProfile } from "../types";

interface NameInputScreenProps {
  onProfileSubmit: (profile: UserProfile) => void;
}

type BirthField = "month" | "day" | "year";

const MONTHS = moment.months();

export const NameInputScreen: React.FC<NameInputScreenProps> = ({
  onProfileSubmit,
}) => {
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [birthMonth, setBirthMonth] = useState<number | null>(null);
  const [birthDay, setBirthDay] = useState<number | null>(null);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [sleepGoal, setSleepGoal] = useState<number | "other" | null>(8);
  const [otherGoal, setOtherGoal] = useState("");
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [birthField, setBirthField] = useState<BirthField | null>(null);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const today = moment();
  const minYear = today.year() - 80;
  const maxYear = today.year() - 5;
  const yearOptions = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i),
    [maxYear, minYear],
  );

  const daysInSelectedMonth =
    birthMonth !== null && birthYear !== null
      ? moment({ year: birthYear, month: birthMonth }).daysInMonth()
      : 31;

  const dayOptions = useMemo(
    () => Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1),
    [daysInSelectedMonth],
  );

  const birthdate =
    birthMonth !== null && birthDay !== null && birthYear !== null
      ? moment({ year: birthYear, month: birthMonth, day: birthDay }).format("YYYY-MM-DD")
      : null;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  const handleSubmit = () => {
    setNameTouched(true);
    if (!name.trim()) return;
    onProfileSubmit({
      name: name.trim(),
      birthdate,
      sleepGoalHours:
        sleepGoal === "other"
          ? otherGoal
            ? parseFloat(otherGoal)
            : undefined
          : sleepGoal || undefined,
    });
  };

  const selectBirthValue = (value: number) => {
    if (birthField === "month") {
      setBirthMonth(value);
      if (birthDay && birthYear) {
        const maxDay = moment({ year: birthYear, month: value }).daysInMonth();
        if (birthDay > maxDay) setBirthDay(maxDay);
      }
    } else if (birthField === "day") {
      setBirthDay(value);
    } else if (birthField === "year") {
      setBirthYear(value);
      if (birthDay && birthMonth !== null) {
        const maxDay = moment({ year: value, month: birthMonth }).daysInMonth();
        if (birthDay > maxDay) setBirthDay(maxDay);
      }
    }
    setBirthField(null);
  };

  const pickerItems =
    birthField === "month"
      ? MONTHS.map((label, index) => ({ label, value: index }))
      : birthField === "day"
        ? dayOptions.map((day) => ({ label: String(day), value: day }))
        : yearOptions.map((year) => ({ label: String(year), value: year }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.iconRing}>
              <View style={styles.iconCircle}>
                <FontAwesome5 name="user-astronaut" size={32} color="#6366f1" />
              </View>
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.title}>Welcome Aboard</Text>
              <Text style={styles.subtitle}>
                Personalize your sleep analytics profile
              </Text>
            </View>

            <TextInput
              style={[styles.input, nameTouched && !name.trim() && styles.inputError]}
              placeholder="Full name"
              placeholderTextColor="#6b7280"
              value={name}
              onChangeText={setName}
              onBlur={() => setNameTouched(true)}
              returnKeyType="next"
            />
            {nameTouched && !name.trim() ? (
              <Text style={styles.fieldError}>Please enter your name to continue.</Text>
            ) : null}

            <View style={styles.birthSection}>
              <Text style={styles.fieldLabel}>Birthdate (optional)</Text>
              <View style={styles.birthRow}>
                <TouchableOpacity style={styles.birthSelect} onPress={() => setBirthField("month")}>
                  <Text style={styles.birthSelectHint}>Month</Text>
                  <Text style={styles.birthSelectValue}>
                    {birthMonth !== null ? MONTHS[birthMonth] : "Select"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.birthSelect} onPress={() => setBirthField("day")}>
                  <Text style={styles.birthSelectHint}>Day</Text>
                  <Text style={styles.birthSelectValue}>{birthDay ?? "Select"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.birthSelect} onPress={() => setBirthField("year")}>
                  <Text style={styles.birthSelectHint}>Year</Text>
                  <Text style={styles.birthSelectValue}>{birthYear ?? "Select"}</Text>
                </TouchableOpacity>
              </View>
              {birthdate ? (
                <TouchableOpacity onPress={() => { setBirthMonth(null); setBirthDay(null); setBirthYear(null); }}>
                  <Text style={styles.clearBirth}>Clear birthdate</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.smallInput}
              onPress={() => setGoalModalVisible(true)}
            >
              <Text style={{ color: "#ffffff", fontSize: 15 }}>
                Sleep goal:{" "}
                {sleepGoal === "other"
                  ? otherGoal || "Other"
                  : sleepGoal
                    ? `${sleepGoal} hrs`
                    : "Select"}
              </Text>
            </TouchableOpacity>

            {sleepGoal === "other" && (
              <TextInput
                style={[styles.smallInput, { marginTop: 0 }]}
                placeholder="Enter custom hours"
                placeholderTextColor="#6b7280"
                value={otherGoal}
                onChangeText={(v) => setOtherGoal(v.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
              />
            )}

            <Animated.View style={{ transform: [{ scale: scaleAnim }], width: "100%" }}>
              <TouchableOpacity
                style={[styles.button, !name.trim() && styles.buttonDisabled]}
                onPress={handleSubmit}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={!name.trim()}
                activeOpacity={0.9}
              >
                <Text style={[styles.buttonText, !name.trim() && styles.buttonTextDisabled]}>
                  Continue
                </Text>
                <FontAwesome5
                  name="arrow-right"
                  size={12}
                  color={!name.trim() ? "#6b7280" : "#ffffff"}
                  style={{ marginLeft: 8, marginTop: 2 }}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        visible={goalModalVisible}
        animationType="fade"
        onRequestClose={() => setGoalModalVisible(false)}
      >
        <View style={modalStyles.overlay} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={() => setGoalModalVisible(false)}>
            <View style={modalStyles.backdrop} />
          </TouchableWithoutFeedback>
          <View style={modalStyles.menu}>
            {[6, 7, 8, 9, 10].map((g) => (
              <TouchableOpacity
                key={g}
                style={modalStyles.option}
                onPress={() => {
                  setSleepGoal(g);
                  setOtherGoal("");
                  setGoalModalVisible(false);
                }}
              >
                <Text style={modalStyles.optionText}>{g} hours</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={modalStyles.option}
              onPress={() => {
                setSleepGoal("other");
                setGoalModalVisible(false);
              }}
            >
              <Text style={modalStyles.optionText}>Other</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={birthField !== null}
        animationType="fade"
        onRequestClose={() => setBirthField(null)}
      >
        <View style={modalStyles.overlay} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={() => setBirthField(null)}>
            <View style={modalStyles.backdrop} />
          </TouchableWithoutFeedback>
          <View style={modalStyles.menu}>
            <Text style={modalStyles.modalTitle}>
              {birthField === "month" ? "Select month" : birthField === "day" ? "Select day" : "Select year"}
            </Text>
            <FlatList
              data={pickerItems}
              keyExtractor={(item) => String(item.value)}
              style={modalStyles.list}
              renderItem={({ item }) => (
                <TouchableOpacity style={modalStyles.option} onPress={() => selectBirthValue(item.value)}>
                  <Text style={modalStyles.optionText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000cc",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  menu: {
    backgroundColor: "#171a2a",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxHeight: "70%",
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  list: { maxHeight: 360 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2d2d52",
  },
  optionText: { color: "#e5e7eb", fontSize: 16, fontWeight: "600" },
  backdrop: { ...StyleSheet.absoluteFillObject },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0a0b10" },
  container: { flex: 1, backgroundColor: "#0a0b10" },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 16 },
  card: {
    backgroundColor: "rgba(26, 27, 38, 0.75)",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  iconRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    backgroundColor: "rgba(99, 102, 241, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(26, 27, 38, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: { alignItems: "center", marginBottom: 22 },
  title: { fontSize: 28, fontWeight: "800", color: "#ffffff", marginBottom: 8, letterSpacing: 0.8 },
  subtitle: { fontSize: 14, color: "#cbd5e1", textAlign: "center", lineHeight: 22, maxWidth: 300 },
  input: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 14,
  },
  inputError: { borderColor: "rgba(239, 68, 68, 0.6)" },
  fieldError: { color: "#fca5a5", fontSize: 12, alignSelf: "flex-start", marginTop: -8, marginBottom: 10 },
  smallInput: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 14,
  },
  fieldLabel: { color: "#9ca3af", fontSize: 12, marginBottom: 8, fontWeight: "600" },
  birthSection: { width: "100%", marginBottom: 14 },
  birthRow: { flexDirection: "row", gap: 8 },
  birthSelect: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  birthSelectHint: { color: "#94a3b8", fontSize: 11, marginBottom: 4 },
  birthSelectValue: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  clearBirth: { color: "#93c5fd", fontSize: 12, fontWeight: "600", marginTop: 10, textAlign: "center" },
  button: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: "#6366f1",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { backgroundColor: "rgba(255, 255, 255, 0.05)" },
  buttonText: { fontSize: 15, fontWeight: "700", color: "#ffffff", letterSpacing: 0.5 },
  buttonTextDisabled: { color: "#6b7280" },
});
