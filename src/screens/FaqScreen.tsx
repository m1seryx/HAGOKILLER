import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../constants/theme';

const FAQ = [
  {
    q: 'When does the pillow inflate?',
    a: 'Three snores inside the detection window (15 seconds by default) start one pump run. It lasts for the maximum pump time in Settings, 40 seconds unless you change it.',
  },
  {
    q: 'Does it keep pumping all night?',
    a: 'No. It pumps once, up to the maximum time you set, then the pillow stays raised. If snoring continues for 10 seconds after that, the phone alarm starts. Air is released only when you open the valve in Settings.',
  },
  {
    q: 'How do I test the mic?',
    a: 'In Settings → Detection & inflation, pause overnight listening, then use Test snore mic. It shows live snore and non-snore percentages with a verdict. It does not count sleep events or run the pump.',
  },
  {
    q: 'What name should I look for in Bluetooth?',
    a: 'The pillow advertises as HAGOKILLER Pillow. The demo PIN is 1234567. The mic only listens while the app stays connected.',
  },
  {
    q: 'Where is the snore count?',
    a: 'History Logs shows the snoring count. The Overview screen shows a live volume trace while the pillow is connected.',
  },
  {
    q: 'How do I stop the alarm ringtone?',
    a: 'The alarm starts by itself if snoring continues for 10 seconds after the pump reaches its maximum time. It also plays when you tap Play test alarm. It loops until you tap Stop in Settings or Stop on the notification.',
  },
];

const FaqItem = ({
  question,
  answer,
  expanded,
  onPress,
  showDivider,
}: {
  question: string;
  answer: string;
  expanded: boolean;
  onPress: () => void;
  showDivider: boolean;
}) => {
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [bodyHeight, setBodyHeight] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [expanded, progress]);

  const height = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, bodyHeight],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.item}>
      {showDivider ? <View style={styles.divider} /> : null}
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        <Text style={styles.question}>{question}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <FontAwesome5 name="chevron-down" size={11} color={colors.accentDark} />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={[styles.answerClip, { height, opacity }]}>
        <Text style={styles.answer}>{answer}</Text>
      </Animated.View>
      <View style={styles.measure} pointerEvents="none" onLayout={({ nativeEvent }) => {
        const next = Math.ceil(nativeEvent.layout.height);
        if (next > 0 && next !== bodyHeight) setBodyHeight(next);
      }}>
        <Text style={styles.answer}>{answer}</Text>
      </View>
    </View>
  );
};

export const FaqScreen = () => {
  const navigation = useNavigation();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <FontAwesome5 name="chevron-left" size={12} color={colors.accentDark} />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.title}>FAQ</Text>
        <Text style={styles.subtitle}>Short answers about the pillow and the app.</Text>

        <View style={styles.card}>
          {FAQ.map((item, index) => (
            <FaqItem
              key={item.q}
              question={item.q}
              answer={item.a}
              expanded={open === index}
              showDivider={index > 0}
              onPress={() => setOpen(open === index ? null : index)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7f9' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 36, maxWidth: 720, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 8 },
  backText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 16 },
  item: { position: 'relative' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 4,
    shadowColor: '#142c43',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  question: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  answerClip: { overflow: 'hidden' },
  answer: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e7edf2', marginLeft: 16 },
});
