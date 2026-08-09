import React, { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import moment from "moment";
import { UserProfile } from "../types";

interface NameInputScreenProps {
  onProfileSubmit: (profile: UserProfile) => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const NameInputScreen: React.FC<NameInputScreenProps> = ({
  onProfileSubmit,
}) => {
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [birthdate, setBirthdate] = useState<string | null>(null);
  const [sleepGoal, setSleepGoal] = useState<number | "other" | null>(8);
  const [otherGoal, setOtherGoal] = useState("");
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [birthPickerVisible, setBirthPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(
    moment().subtract(25, "years").toDate(),
  );
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

  const handleSubmit = () => {
    setNameTouched(true);
    if (!name.trim()) return;
    const profile: UserProfile = {
      name: name.trim(),
      birthdate: birthdate ?? null,
      sleepGoalHours:
        sleepGoal === "other"
          ? otherGoal
            ? parseFloat(otherGoal)
            : undefined
          : sleepGoal || undefined,
    };
    onProfileSubmit(profile);
  };

  const viewMonth = moment(pickerDate);
  const today = moment();
  const minYear = today.year() - 79;
  const daysInMonth = viewMonth.daysInMonth();
  const startWeekday = viewMonth.clone().startOf("month").day();
  const calendarCells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  const isFutureDay = (day: number) =>
    viewMonth.clone().date(day).isAfter(today, "day");

  const handleSelectDay = (day: number) => {
    if (isFutureDay(day)) return;
    setPickerDate(viewMonth.clone().date(day).toDate());
  };

  const shiftMonth = (delta: number) => {
    const next = viewMonth.clone().add(delta, "month");
    const clamped = next.isAfter(today, "month")
      ? today.clone().startOf("month")
      : next;
    const day = Math.min(moment(pickerDate).date(), clamped.daysInMonth());
    setPickerDate(clamped.date(day).toDate());
  };

  const shiftYear = (delta: number) => {
    const nextYear = Math.min(
      today.year(),
      Math.max(minYear, viewMonth.year() + delta),
    );
    const next = viewMonth.clone().year(nextYear);
    const day = Math.min(moment(pickerDate).date(), next.daysInMonth());
    setPickerDate(next.date(day).toDate());
  };

  const handleClearBirthdate = () => {
    setBirthdate(null);
    setPickerDate(moment().subtract(25, "years").toDate());
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
          autoFocus
          returnKeyType="next"
        />
        {nameTouched && !name.trim() ? (
          <Text style={styles.fieldError}>Please enter your name to continue.</Text>
        ) : null}

        <View style={styles.fieldRow}>
          <TouchableOpacity
            style={[styles.smallInput, styles.dateInput]}
            onPress={() => {
              setPickerDate(
                birthdate
                  ? moment(birthdate).toDate()
                  : moment().subtract(25, "years").toDate(),
              );
              setBirthPickerVisible(true);
            }}
          >
            <Text
              style={[
                styles.fieldLabel,
                birthdate ? styles.fieldLabelActive : undefined,
              ]}
            >
              Birthdate (optional)
            </Text>
            <Text style={styles.dateText}>
              {birthdate
                ? moment(birthdate).format("MMMM D, YYYY")
                : "Tap to choose your birthdate"}
            </Text>
          </TouchableOpacity>
          {birthdate ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearBirthdate}
            >
              <FontAwesome5 name="times" size={14} color="#ffffff" />
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

        <Animated.View
          style={{ transform: [{ scale: scaleAnim }], width: "100%" }}
        >
          <TouchableOpacity
            style={[styles.button, !name.trim() && styles.buttonDisabled]}
            onPress={handleSubmit}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={!name.trim()}
            activeOpacity={0.9}
          >
            <Text
              style={[
                styles.buttonText,
                !name.trim() && styles.buttonTextDisabled,
              ]}
            >
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

        <Modal
          transparent
          visible={goalModalVisible}
          animationType="fade"
          onRequestClose={() => setGoalModalVisible(false)}
        >
          <View style={modalStyles.overlay} pointerEvents="box-none">
            <TouchableWithoutFeedback
              onPress={() => setGoalModalVisible(false)}
            >
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

        {sleepGoal === "other" && (
          <TextInput
            style={[styles.smallInput, { marginTop: 8 }]}
            placeholder="Enter custom hours"
            placeholderTextColor="#6b7280"
            value={otherGoal}
            onChangeText={(v) => setOtherGoal(v.replace(/[^0-9\.]/g, ""))}
            keyboardType="decimal-pad"
          />
        )}
        <Modal
          transparent
          visible={birthPickerVisible}
          animationType="fade"
          onRequestClose={() => setBirthPickerVisible(false)}
        >
          <View style={modalStyles.overlay} pointerEvents="box-none">
            <TouchableWithoutFeedback
              onPress={() => setBirthPickerVisible(false)}
            >
              <View style={modalStyles.backdrop} />
            </TouchableWithoutFeedback>
            <View style={modalStyles.menu}>
              <View style={modalStyles.modalHeader}>
                <Text style={modalStyles.modalTitle}>
                  Choose your birthdate
                </Text>
                <Text style={modalStyles.modalSubtitle}>
                  Tap a day on the calendar to select your birthdate.
                </Text>
              </View>

              <View style={styles.calendarNav}>
                <TouchableOpacity
                  style={styles.calendarNavButton}
                  onPress={() => shiftMonth(-1)}
                >
                  <FontAwesome5 name="chevron-left" size={14} color="#e5e7eb" />
                </TouchableOpacity>
                <Text style={styles.calendarMonthLabel}>
                  {viewMonth.format("MMMM YYYY")}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.calendarNavButton,
                    viewMonth.isSame(today, "month") && styles.calendarNavButtonDisabled,
                  ]}
                  onPress={() => shiftMonth(1)}
                  disabled={viewMonth.isSame(today, "month")}
                >
                  <FontAwesome5 name="chevron-right" size={14} color="#e5e7eb" />
                </TouchableOpacity>
              </View>

              <View style={styles.yearNav}>
                <Text style={styles.yearNavLabel}>Year</Text>
                <TouchableOpacity
                  style={styles.calendarNavButton}
                  onPress={() => shiftYear(-1)}
                  disabled={viewMonth.year() <= minYear}
                >
                  <FontAwesome5 name="minus" size={12} color="#e5e7eb" />
                </TouchableOpacity>
                <Text style={styles.yearNavValue}>{viewMonth.year()}</Text>
                <TouchableOpacity
                  style={styles.calendarNavButton}
                  onPress={() => shiftYear(1)}
                  disabled={viewMonth.year() >= today.year()}
                >
                  <FontAwesome5 name="plus" size={12} color="#e5e7eb" />
                </TouchableOpacity>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((day) => (
                  <Text key={day} style={styles.weekdayText}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.dayGrid}>
                {calendarCells.map((day, index) => {
                  if (!day) {
                    return <View key={`blank-${index}`} style={styles.dayCell} />;
                  }

                  const selected =
                    day === moment(pickerDate).date() &&
                    viewMonth.month() === moment(pickerDate).month() &&
                    viewMonth.year() === moment(pickerDate).year();
                  const disabled = isFutureDay(day);

                  return (
                    <TouchableOpacity
                      key={`day-${day}-${index}`}
                      style={[
                        styles.dayCell,
                        selected && styles.dayCellSelected,
                        disabled && styles.dayCellDisabled,
                      ]}
                      onPress={() => handleSelectDay(day)}
                      disabled={disabled}
                    >
                      <Text
                        style={[
                          styles.dayCellText,
                          selected && styles.dayCellTextSelected,
                          disabled && styles.dayCellTextDisabled,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.selectedDateText}>
                {moment(pickerDate).format("MMMM D, YYYY")}
              </Text>

              <View style={modalStyles.modalFooter}>
                <TouchableOpacity
                  style={modalStyles.modalButton}
                  onPress={() => setBirthPickerVisible(false)}
                >
                  <Text style={modalStyles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={modalStyles.modalButton}
                  onPress={() => {
                    setBirthdate(moment(pickerDate).format("YYYY-MM-DD"));
                    setBirthPickerVisible(false);
                  }}
                >
                  <Text style={modalStyles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
              {birthdate ? (
                <TouchableOpacity
                  style={modalStyles.clearLink}
                  onPress={handleClearBirthdate}
                >
                  <Text style={modalStyles.clearLinkText}>Clear birthdate</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
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
  },
  modalHeader: { marginBottom: 12 },
  modalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  modalSubtitle: { color: "#cbd5e1", fontSize: 13 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2d2d52",
  },
  optionText: { color: "#e5e7eb", fontSize: 16, fontWeight: "600" },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  modalButton: {
    flex: 1,
    backgroundColor: "#6366f1",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginHorizontal: 4,
  },
  modalButtonText: { color: "#fff", fontWeight: "700" },
  modalButtonSecondary: { backgroundColor: "rgba(255,255,255,0.08)" },
  modalButtonSecondaryText: { color: "#9ca3af" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  clearLink: {
    marginTop: 14,
    alignSelf: "center",
  },
  clearLinkText: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "600",
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0a0b10",
  },
  container: {
    flex: 1,
    backgroundColor: "#0a0b10",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "rgba(26, 27, 38, 0.75)",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
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
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 14,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
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
  inputError: {
    borderColor: 'rgba(239, 68, 68, 0.6)',
  },
  fieldError: {
    color: '#fca5a5',
    fontSize: 12,
    alignSelf: 'flex-start',
    marginTop: -8,
    marginBottom: 10,
  },
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
  fieldRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateInput: {
    flex: 1,
  },
  fieldLabel: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 4,
  },
  fieldLabelActive: {
    color: "#c7d2fe",
  },
  dateText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  clearButton: {
    marginLeft: 10,
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: "#6366f1",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  buttonTextDisabled: {
    color: "#6b7280",
  },
  calendarNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarNavButtonDisabled: {
    opacity: 0.35,
  },
  calendarMonthLabel: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  yearNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 14,
  },
  yearNavLabel: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
    marginRight: 4,
  },
  yearNavValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    minWidth: 48,
    textAlign: "center",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "700",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 4,
  },
  dayCellSelected: {
    backgroundColor: "#6366f1",
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayCellText: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
  },
  dayCellTextSelected: {
    color: "#ffffff",
    fontWeight: "800",
  },
  dayCellTextDisabled: {
    color: "#6b7280",
  },
  selectedDateText: {
    color: "#cbd5e1",
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 12,
  },
});
