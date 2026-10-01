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
  Image,
  Modal,
  ScrollView,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import moment from "moment";
import { UserProfile } from "../types";
import { colors } from "../constants/theme";

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
  const starAnim = React.useRef(new Animated.Value(0.35)).current;
  const cometAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const stars = Animated.loop(
      Animated.sequence([
        Animated.timing(starAnim, { toValue: 1, duration: 1700, useNativeDriver: true }),
        Animated.timing(starAnim, { toValue: 0.35, duration: 1900, useNativeDriver: true }),
      ]),
    );
    const comet = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(cometAnim, { toValue: 1, duration: 2300, useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(cometAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    stars.start();
    comet.start();
    return () => {
      stars.stop();
      comet.stop();
    };
  }, [cometAnim, starAnim]);

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
            <View style={styles.setupBadge}>
              <View style={styles.setupBadgeIcon}>
                <FontAwesome5 name="moon" size={10} color="#7dd3fc" solid />
              </View>
              <Text style={styles.setupBadgeText}>HAGOKILLER PROFILE SETUP</Text>
              <View style={styles.setupBadgeDot} />
              <Text style={styles.setupBadgeStep}>ONE STEP</Text>
            </View>

            <View style={styles.heroPanel}>
              <View style={styles.heroGlow} />
              <Image
                source={require("../../assets/moon-pillow-comets.png")}
                style={styles.heroArtwork}
                resizeMode="contain"
              />
              <View pointerEvents="none" style={styles.skyAnimation}>
                <Animated.View style={[styles.star, styles.starOne, { opacity: starAnim }]}>
                  <FontAwesome5 name="star" size={8} color="#fde68a" solid />
                </Animated.View>
                <Animated.View
                  style={[
                    styles.star,
                    styles.starTwo,
                    { opacity: starAnim.interpolate({ inputRange: [0.35, 1], outputRange: [1, 0.3] }) },
                  ]}
                >
                  <FontAwesome5 name="star" size={5} color="#7dd3fc" solid />
                </Animated.View>
                <Animated.View style={[styles.star, styles.starThree, { opacity: starAnim }]}>
                  <FontAwesome5 name="star" size={6} color="#ffffff" solid />
                </Animated.View>
                <Animated.View
                  style={[
                    styles.comet,
                    {
                      opacity: cometAnim.interpolate({
                        inputRange: [0, 0.08, 0.82, 1],
                        outputRange: [0, 0.9, 0.9, 0],
                      }),
                      transform: [
                        {
                          translateX: cometAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-80, 330],
                          }),
                        },
                        {
                          translateY: cometAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-14, 74],
                          }),
                        },
                        { rotate: "12deg" },
                      ],
                    },
                  ]}
                >
                  <View style={styles.cometTail} />
                  <View style={styles.cometHead} />
                </Animated.View>
              </View>
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.eyebrow}>YOUR SLEEP SPACE</Text>
              <Text style={styles.title}>Welcome aboard</Text>
              <Text style={styles.subtitle}>
                A few details help shape your nightly insights.
              </Text>
            </View>

            <View style={styles.formSection}>
              <View style={styles.labelRow}>
                <FontAwesome5 name="user" size={11} color="#38bdf8" solid />
                <Text style={styles.fieldLabel}>YOUR NAME</Text>
              </View>
              <TextInput
                style={[styles.input, nameTouched && !name.trim() && styles.inputError]}
                placeholder="Enter your full name"
                placeholderTextColor="#7890aa"
                value={name}
                onChangeText={setName}
                onBlur={() => setNameTouched(true)}
                returnKeyType="next"
              />
              {nameTouched && !name.trim() ? (
                <Text style={styles.fieldError}>Please enter your name to continue.</Text>
              ) : null}

              <View style={styles.labelRow}>
                <FontAwesome5 name="birthday-cake" size={11} color="#38bdf8" solid />
                <Text style={styles.fieldLabel}>BIRTHDATE</Text>
                <Text style={styles.optionalLabel}>Optional</Text>
              </View>
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

              <View style={[styles.labelRow, styles.goalLabelRow]}>
                <FontAwesome5 name="moon" size={11} color="#38bdf8" solid />
                <Text style={styles.fieldLabel}>SLEEP GOAL</Text>
              </View>
              <TouchableOpacity
                style={styles.goalSelect}
                onPress={() => setGoalModalVisible(true)}
              >
                <View>
                  <Text style={styles.goalHint}>Your nightly target</Text>
                  <Text style={styles.goalValue}>
                    {sleepGoal === "other"
                      ? otherGoal
                        ? `${otherGoal} hrs`
                        : "Custom goal"
                      : sleepGoal
                        ? `${sleepGoal} hours`
                        : "Select a goal"}
                  </Text>
                </View>
                <View style={styles.chevronButton}>
                  <FontAwesome5 name="chevron-down" size={11} color="#38bdf8" />
                </View>
              </TouchableOpacity>

              {sleepGoal === "other" && (
                <TextInput
                  style={styles.customGoalInput}
                  placeholder="Enter custom hours"
                  placeholderTextColor="#7890aa"
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
                    Build my sleep profile
                  </Text>
                  <FontAwesome5
                    name="arrow-right"
                    size={12}
                    color={!name.trim() ? "#7890aa" : "#ffffff"}
                    style={styles.buttonIcon}
                  />
                </TouchableOpacity>
              </Animated.View>
            </View>
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
    backgroundColor: colors.nightSoft,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.nightBorder,
    maxHeight: "70%",
  },
  modalTitle: {
    color: "#f8fbff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  list: { maxHeight: 360 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.nightBorder,
  },
  optionText: { color: "#e0f2fe", fontSize: 16, fontWeight: "600" },
  backdrop: { ...StyleSheet.absoluteFillObject },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.night },
  container: { flex: 1, backgroundColor: colors.night },
  scrollContent: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
  },
  card: {
    width: "100%",
    alignItems: "center",
  },
  setupBadge: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 4,
  },
  setupBadgeIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "rgba(14, 165, 233, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.18)",
  },
  setupBadgeText: { color: "#bae6fd", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  setupBadgeDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#38bdf8", marginHorizontal: 8 },
  setupBadgeStep: { color: "#7890aa", fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  heroPanel: {
    width: "100%",
    height: 210,
    alignItems: "center",
    justifyContent: "center",
  },
  heroGlow: {
    position: "absolute",
    width: 260,
    height: 130,
    borderRadius: 130,
    backgroundColor: "rgba(14, 165, 233, 0.11)",
  },
  heroArtwork: { width: "116%", height: "116%" },
  skyAnimation: { ...StyleSheet.absoluteFillObject, overflow: "hidden", borderRadius: 28 },
  star: { position: "absolute", shadowColor: "#ffffff", shadowOpacity: 0.8, shadowRadius: 5 },
  starOne: { left: "15%", top: "28%" },
  starTwo: { right: "14%", top: "23%" },
  starThree: { right: "24%", bottom: "22%" },
  comet: {
    position: "absolute",
    left: 0,
    top: 34,
    width: 62,
    height: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  cometTail: {
    width: 54,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#7dd3fc",
    shadowColor: "#38bdf8",
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  cometHead: {
    width: 7,
    height: 7,
    marginLeft: -1,
    borderRadius: 4,
    backgroundColor: "#fef3c7",
    shadowColor: "#fde68a",
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  textContainer: { alignItems: "flex-start", width: "100%", paddingTop: 2, paddingBottom: 22 },
  eyebrow: { color: "#38bdf8", fontSize: 9, fontWeight: "900", letterSpacing: 1.8, marginBottom: 7 },
  title: { fontSize: 29, fontWeight: "900", color: "#f8fbff", marginBottom: 7, letterSpacing: 0.1 },
  subtitle: { fontSize: 13, color: "#a9bfdf", lineHeight: 19, maxWidth: 330 },
  formSection: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "rgba(16, 36, 66, 0.72)",
    borderWidth: 1,
    borderColor: colors.nightBorder,
    padding: 18,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  fieldLabel: { color: "#bae6fd", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  optionalLabel: { marginLeft: "auto", color: "#7e97b8", fontSize: 10, fontWeight: "600" },
  input: {
    width: "100%",
    backgroundColor: "rgba(7, 17, 38, 0.76)",
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "600",
    color: "#f8fbff",
    borderWidth: 1,
    borderColor: colors.nightBorder,
    marginBottom: 17,
  },
  inputError: { borderColor: "rgba(239, 68, 68, 0.6)" },
  fieldError: { color: "#b91c1c", fontSize: 12, alignSelf: "flex-start", marginTop: -8, marginBottom: 10 },
  birthRow: { flexDirection: "row", gap: 8 },
  birthSelect: {
    flex: 1,
    backgroundColor: "rgba(7, 17, 38, 0.76)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.nightBorder,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  birthSelectHint: { color: "#7890aa", fontSize: 10, marginBottom: 4 },
  birthSelectValue: { color: "#f8fbff", fontSize: 13, fontWeight: "700" },
  clearBirth: { color: "#38bdf8", fontSize: 12, fontWeight: "700", marginTop: 10, textAlign: "center" },
  goalLabelRow: { marginTop: 18 },
  goalSelect: {
    width: "100%",
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(7, 17, 38, 0.76)",
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.nightBorder,
    marginBottom: 16,
  },
  goalHint: { color: "#7890aa", fontSize: 10, marginBottom: 3 },
  goalValue: { color: "#f8fbff", fontSize: 15, fontWeight: "800" },
  chevronButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(14, 165, 233, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  customGoalInput: {
    width: "100%",
    backgroundColor: "rgba(7, 17, 38, 0.76)",
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    color: "#f8fbff",
    borderWidth: 1,
    borderColor: colors.nightBorder,
    marginTop: -7,
    marginBottom: 16,
  },
  button: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: "#0ea5e9",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 9,
    elevation: 3,
  },
  buttonDisabled: { backgroundColor: "#203959", shadowOpacity: 0, elevation: 0 },
  buttonText: { fontSize: 15, fontWeight: "700", color: "#ffffff", letterSpacing: 0.5 },
  buttonTextDisabled: { color: "#7890aa" },
  buttonIcon: { marginLeft: 9, marginTop: 2 },
});
