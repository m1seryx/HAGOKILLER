import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import type { MicTestPreview, MicTestVerdict } from '../services/esp32Protocol';

type Props = {
  active?: boolean;
  preview?: MicTestPreview | null;
  size?: number;
};

function accentFor(verdict: MicTestVerdict | 'idle', active: boolean): string {
  if (!active) return '#94a3b8';
  if (verdict === 'snore') return '#2563eb';
  if (verdict === 'non_snore') return '#dc2626';
  if (verdict === 'quiet') return '#94a3b8';
  return colors.accentDark;
}

function captionFor(verdict: MicTestVerdict | 'idle', active: boolean): string {
  if (!active) return 'Mic test idle';
  if (verdict === 'snore') return 'Verdict: snoring';
  if (verdict === 'non_snore') return 'Verdict: not snoring';
  if (verdict === 'quiet') return 'Listening… quiet';
  return 'Listening…';
}

/**
 * Radar-style mic visual for Settings → Test snore mic.
 * Sweep speed rises with snore %; rings tint by verdict.
 */
export const MicTestRadar: React.FC<Props> = ({
  active = false,
  preview = null,
  size = 200,
}) => {
  const sweep = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;

  const verdict = preview?.verdict ?? 'idle';
  const snorePct = preview?.snorePercent ?? 0;
  const nonPct = preview?.nonSnorePercent ?? 0;
  const accent = accentFor(verdict === 'idle' ? 'idle' : verdict, active);
  const sweepMs = active ? Math.max(900, 2200 - snorePct * 12) : 3200;

  useEffect(() => {
    sweep.setValue(0);
    const spin = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: sweepMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => spin.stop();
  }, [active, sweepMs, sweep]);

  useEffect(() => {
    const makePulse = (value: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(value, {
            toValue: 1,
            duration: active ? 1100 : 2000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    pulse.setValue(0);
    pulse2.setValue(0);
    const a = makePulse(pulse, 0);
    const b = makePulse(pulse2, active ? 550 : 1000);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [active, pulse, pulse2]);

  const half = size / 2;
  const rotate = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ringStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [
      {
        scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.05] }),
      },
    ],
  });

  return (
    <View style={[styles.wrap, { width: size, height: size + 56 }]}>
      <View style={[styles.radar, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="micRadarFill" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={accent} stopOpacity="0.18" />
              <Stop offset="100%" stopColor={accent} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          <Circle cx={half} cy={half} r={half - 4} fill="url(#micRadarFill)" />
          <Circle cx={half} cy={half} r={half * 0.72} stroke={accent} strokeOpacity={0.22} strokeWidth={1} fill="none" />
          <Circle cx={half} cy={half} r={half * 0.48} stroke={accent} strokeOpacity={0.28} strokeWidth={1} fill="none" />
          <Circle cx={half} cy={half} r={half * 0.24} stroke={accent} strokeOpacity={0.35} strokeWidth={1} fill="none" />
        </Svg>

        <Animated.View
          pointerEvents="none"
          style={[styles.pulseRing, { borderColor: accent }, ringStyle(pulse)]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.pulseRing, { borderColor: accent }, ringStyle(pulse2)]}
        />

        <Animated.View
          style={[
            styles.sweepArm,
            {
              width: half - 8,
              left: half,
              top: half - 1,
              backgroundColor: accent,
              transform: [{ rotate }, { translateX: 0 }],
            },
          ]}
        />

        <View style={[styles.core, { backgroundColor: `${accent}22`, borderColor: accent }]}>
          <FontAwesome5 name="microphone" size={22} color={accent} />
        </View>
      </View>

      <Text style={[styles.caption, { color: accent }]}>
        {captionFor(verdict === 'idle' ? 'idle' : verdict, active)}
      </Text>
      <Text style={styles.scores}>
        Snore {snorePct}% · Non-snore {nonPct}%
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    alignSelf: 'center',
  },
  radar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 2,
  },
  sweepArm: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    transformOrigin: 'left center',
  },
  core: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  caption: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
  },
  scores: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
});
