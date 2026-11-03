import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import Svg, { Circle, Line, Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import type { BLEDevice } from '../types';

type Props = {
  scanning?: boolean;
  connected?: boolean;
  paired?: boolean;
  size?: number;
  devices?: BLEDevice[];
  onSelectDevice?: (device: BLEDevice) => void;
};

function hashAngle(id: string, index: number, total: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  // Spread evenly, then nudge with hash so positions feel organic but stable
  const base = (index / Math.max(total, 1)) * 360;
  const nudge = (h % 48) - 24;
  return (base + nudge + 360) % 360;
}

/** Stronger RSSI → closer to center. Typical BLE: -35 near … -95 far. */
function rssiToRadius(rssi: number, maxR: number): number {
  const clamped = Math.max(-95, Math.min(-35, rssi));
  const t = (clamped + 35) / (-95 + 35); // 0 near → 1 far
  return maxR * (0.28 + t * 0.62);
}

function shortName(name: string): string {
  const cleaned = name.replace(/^HAGOKILLER\s*/i, '').trim() || name;
  return cleaned.length > 14 ? `${cleaned.slice(0, 13)}…` : cleaned;
}

/**
 * Radar-style Bluetooth visual for the pairing screen.
 * Nearby pillows appear as blips (distance ≈ signal strength).
 */
export const BleRadarAnimation: React.FC<Props> = ({
  scanning = false,
  connected = false,
  paired = false,
  size = 220,
  devices = [],
  onSelectDevice,
}) => {
  const sweep = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const blipPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    sweep.setValue(0);
    const spin = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: scanning ? 1600 : 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => spin.stop();
  }, [scanning, sweep]);

  useEffect(() => {
    const makePulse = (value: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(value, {
            toValue: 1,
            duration: scanning ? 1300 : 2100,
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
    const b = makePulse(pulse2, scanning ? 650 : 1050);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [scanning, pulse, pulse2]);

  useEffect(() => {
    blipPulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blipPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(blipPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blipPulse]);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.42;
  const rotate = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const pulseStyle = (value: Animated.Value) => ({
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.35, 1],
        }),
      },
    ],
    opacity: value.interpolate({
      inputRange: [0, 0.15, 1],
      outputRange: [0.5, 0.32, 0],
    }),
  });

  const accent = connected ? '#10b981' : scanning ? '#0ea5e9' : paired ? '#ea580c' : '#0284c7';
  const caption = connected
    ? 'Link active'
    : scanning
      ? devices.length > 0
        ? `${devices.length} pillow${devices.length === 1 ? '' : 's'} on radar`
        : 'Scanning nearby…'
      : paired
        ? 'Paired · offline'
        : devices.length > 0
          ? `${devices.length} pillow${devices.length === 1 ? '' : 's'} on radar`
          : 'Ready to scan';

  const wedgePath = `M ${cx} ${cy} L ${cx} ${cy - maxR} A ${maxR} ${maxR} 0 0 1 ${cx + maxR * 0.55} ${cy - maxR * 0.84} Z`;

  const blips = useMemo(
    () =>
      devices.map((device, index) => {
        const angleDeg = hashAngle(device.id, index, devices.length);
        const angleRad = (angleDeg * Math.PI) / 180;
        const r = rssiToRadius(device.signalStrength, maxR);
        // 0° = up (same as sweep arm)
        const x = cx + r * Math.sin(angleRad);
        const y = cy - r * Math.cos(angleRad);
        return { device, x, y, angleDeg };
      }),
    [devices, cx, cy, maxR],
  );

  const blipGlow = {
    opacity: blipPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 0.85],
    }),
    transform: [
      {
        scale: blipPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.55],
        }),
      },
    ],
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.radar, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle
            cx={cx}
            cy={cy}
            r={maxR}
            stroke="rgba(14,165,233,0.14)"
            strokeWidth={1.5}
            fill="rgba(240,249,255,0.9)"
          />
          <Circle cx={cx} cy={cy} r={maxR * 0.7} stroke="rgba(14,165,233,0.16)" strokeWidth={1} fill="none" />
          <Circle cx={cx} cy={cy} r={maxR * 0.42} stroke="rgba(14,165,233,0.2)" strokeWidth={1} fill="none" />
          <Line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="rgba(14,165,233,0.1)" strokeWidth={1} />
          <Line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="rgba(14,165,233,0.1)" strokeWidth={1} />
        </Svg>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              width: maxR * 2,
              height: maxR * 2,
              borderRadius: maxR,
              borderColor: accent,
            },
            pulseStyle(pulse),
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              width: maxR * 2,
              height: maxR * 2,
              borderRadius: maxR,
              borderColor: accent,
            },
            pulseStyle(pulse2),
          ]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ rotate }] },
          ]}
        >
          <Svg width={size} height={size}>
            <Defs>
              <LinearGradient id="radarFade" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor={accent} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={accent} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path d={wedgePath} fill="url(#radarFade)" />
            <Line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy - maxR}
              stroke={accent}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <Circle cx={cx} cy={cy - maxR + 3} r={3.5} fill={accent} />
          </Svg>
        </Animated.View>

        {blips.map(({ device, x, y }) => (
          <TouchableOpacity
            key={device.id}
            activeOpacity={0.75}
            onPress={() => onSelectDevice?.(device)}
            style={[
              styles.blipHit,
              {
                left: x - 36,
                top: y - 22,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Pair ${device.name}, ${device.signalStrength} dBm`}
          >
            <View style={styles.blipCluster}>
              <Animated.View style={[styles.blipHalo, { backgroundColor: accent }, blipGlow]} />
              <View style={[styles.blipDot, { backgroundColor: accent, borderColor: '#ffffff' }]} />
              <View style={styles.blipLabel}>
                <Text style={styles.blipName} numberOfLines={1}>
                  {shortName(device.name)}
                </Text>
                <Text style={styles.blipMeta}>{device.signalStrength} dBm · Pair</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={[styles.core, { backgroundColor: accent }]} pointerEvents="none">
          <FontAwesome5 name={connected ? 'link' : 'bluetooth-b'} size={14} color="#ffffff" />
        </View>
      </View>

      <Text style={[styles.caption, { color: accent }]}>{caption}</Text>
      {scanning && devices.length === 0 ? (
        <Text style={styles.sub}>Looking for HAGOKILLER Pillow</Text>
      ) : null}
      {devices.length > 0 && !paired ? (
        <Text style={styles.sub}>Tap a blip to pair · closer = stronger signal</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  radar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  core: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  blipHit: {
    position: 'absolute',
    width: 72,
    height: 52,
    zIndex: 4,
    alignItems: 'center',
  },
  blipCluster: {
    alignItems: 'center',
  },
  blipHalo: {
    position: 'absolute',
    top: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  blipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    marginTop: 8,
    zIndex: 1,
  },
  blipLabel: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.2)',
    maxWidth: 88,
    alignItems: 'center',
  },
  blipName: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  blipMeta: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: '700',
    color: '#0284c7',
  },
  caption: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sub: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
