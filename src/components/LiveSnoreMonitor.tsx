import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Rect, Circle } from 'react-native-svg';
import { FontAwesome5 } from '@expo/vector-icons';
import { SleepEvent } from '../types';
import { bleService } from '../services/bleService';
import { useDevice } from '../context/DeviceContext';
import { colors } from '../constants/theme';

const WINDOW_SEC = 60;
const TICK_MS = 500;
const SLOT_COUNT = Math.floor((WINDOW_SEC * 1000) / TICK_MS);
const RMS_SCALE = 2000;
const CHART_HEIGHT = 168;
const TRACE = '#0ea5e9';
const TRACE_SOFT = '#7dd3fc';
const GRID_MINOR = 'rgba(14, 165, 233, 0.08)';
const GRID_MAJOR = 'rgba(2, 132, 199, 0.16)';
const SCREEN_BG = '#f8fbff';

type Sample = { t: number; rms: number };

function rmsFromEvent(event: SleepEvent): number {
  if (typeof event.rms === 'number' && event.rms > 0) return event.rms;
  return 0;
}

function emptySlots(now: number): Sample[] {
  const start = now - (SLOT_COUNT - 1) * TICK_MS;
  return Array.from({ length: SLOT_COUNT }, (_, i) => ({
    t: start + i * TICK_MS,
    rms: 0,
  }));
}

/** ECG-like polyline: flat baseline with QRS-shaped spikes on snores. */
function buildTracePoints(
  samples: Sample[],
  width: number,
  height: number,
): { points: string; tip: { x: number; y: number } | null } {
  const padL = 28;
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const baselineY = padT + h * 0.72;
  const step = samples.length > 1 ? w / (samples.length - 1) : w;

  const coords: Array<{ x: number; y: number }> = [];

  samples.forEach((s, i) => {
    const x = padL + i * step;
    if (s.rms <= 0) {
      coords.push({ x, y: baselineY });
      return;
    }

    const amp = Math.min(1, s.rms / RMS_SCALE) * h * 0.62;
    const half = Math.min(step * 0.9, 10);
    coords.push({ x: x - half, y: baselineY });
    coords.push({ x: x - half * 0.45, y: baselineY - amp * 0.18 });
    coords.push({ x: x - half * 0.12, y: baselineY + amp * 0.12 });
    coords.push({ x, y: baselineY - amp });
    coords.push({ x: x + half * 0.18, y: baselineY + amp * 0.22 });
    coords.push({ x: x + half * 0.55, y: baselineY - amp * 0.1 });
    coords.push({ x: x + half, y: baselineY });
  });

  const points = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const tip = coords.length ? coords[coords.length - 1] : null;
  return { points, tip };
}

interface LiveSnoreMonitorProps {
  connected?: boolean;
}

/**
 * Live snore RMS monitor — ECG-style trace, styled to match the dashboard.
 */
export const LiveSnoreMonitor: React.FC<LiveSnoreMonitorProps> = ({
  connected: connectedProp,
}) => {
  const { connected: deviceConnected } = useDevice();
  const connected = connectedProp ?? deviceConnected;
  const [samples, setSamples] = useState<Sample[]>(() => emptySlots(Date.now()));
  const [chartWidth, setChartWidth] = useState(0);
  const [lastRms, setLastRms] = useState(0);
  const [snoresInWindow, setSnoresInWindow] = useState(0);
  const [pulseOn, setPulseOn] = useState(true);
  const pendingRms = useRef(0);

  useEffect(() => {
    if (!connected) {
      pendingRms.current = 0;
      setLastRms(0);
      setSnoresInWindow(0);
      setSamples(emptySlots(Date.now()));
      return;
    }

    const unsub = bleService.subscribeEvents((event: SleepEvent) => {
      if (event.maxElevationHold) return;
      const rms = rmsFromEvent(event);
      pendingRms.current = Math.max(pendingRms.current, rms);
      setLastRms(rms);
    });

    const timer = setInterval(() => {
      const now = Date.now();
      const spike = pendingRms.current;
      pendingRms.current = 0;

      setSamples((prev) => {
        const next = prev
          .filter((s) => now - s.t <= WINDOW_SEC * 1000)
          .concat({ t: now, rms: spike });
        while (next.length < SLOT_COUNT) {
          next.unshift({ t: (next[0]?.t ?? now) - TICK_MS, rms: 0 });
        }
        while (next.length > SLOT_COUNT) next.shift();
        setSnoresInWindow(next.filter((s) => s.rms > 0).length);
        return next;
      });
    }, TICK_MS);

    const pulse = setInterval(() => setPulseOn((v) => !v), 700);

    return () => {
      unsub();
      clearInterval(timer);
      clearInterval(pulse);
    };
  }, [connected]);

  const { points, tip } = useMemo(() => {
    if (chartWidth <= 0 || samples.length === 0) {
      return { points: '', tip: null as { x: number; y: number } | null };
    }
    return buildTracePoints(samples, chartWidth, CHART_HEIGHT);
  }, [samples, chartWidth]);

  const rateLabel = useMemo(() => {
    if (!connected) return '—';
    return (snoresInWindow / WINDOW_SEC).toFixed(2);
  }, [connected, snoresInWindow]);

  const gridLines = useMemo(() => {
    if (chartWidth <= 0) return { h: [] as number[], v: [] as number[] };
    const h: number[] = [];
    const v: number[] = [];
    for (let y = 0; y <= CHART_HEIGHT; y += 14) h.push(y);
    for (let x = 0; x <= chartWidth; x += 14) v.push(x);
    return { h, v };
  }, [chartWidth]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <FontAwesome5 name="heartbeat" size={13} color="#7dd3fc" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>LIVE SNORE TRACE</Text>
          <Text style={styles.title}>RMS over time</Text>
        </View>
        <View style={[styles.livePill, !connected && styles.livePillOff]}>
          <View
            style={[
              styles.liveDot,
              {
                backgroundColor: connected ? '#10b981' : '#94a3b8',
                opacity: connected ? (pulseOn ? 1 : 0.4) : 0.6,
              },
            ]}
          />
          <Text style={[styles.liveText, !connected && { color: '#94a3b8' }]}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>RMS</Text>
          <Text style={styles.summaryValue}>
            {connected ? lastRms : '—'}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>RATE</Text>
          <Text style={styles.summaryValue}>
            {rateLabel}
            <Text style={styles.summaryUnit}>{connected ? '/s' : ''}</Text>
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>LAST 60S</Text>
          <Text style={styles.summaryValue}>{connected ? snoresInWindow : '—'}</Text>
        </View>
      </View>

      <View
        style={styles.chartWrapper}
        onLayout={({ nativeEvent }) => setChartWidth(Math.floor(nativeEvent.layout.width))}
      >
        {chartWidth > 0 ? (
          <Svg width={chartWidth} height={CHART_HEIGHT}>
            <Rect x={0} y={0} width={chartWidth} height={CHART_HEIGHT} fill={SCREEN_BG} rx={14} />

            {gridLines.h.map((y) => (
              <Line
                key={`h${y}`}
                x1={0}
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke={y % 56 === 0 ? GRID_MAJOR : GRID_MINOR}
                strokeWidth={y % 56 === 0 ? 1 : 0.7}
              />
            ))}
            {gridLines.v.map((x) => (
              <Line
                key={`v${x}`}
                x1={x}
                y1={0}
                x2={x}
                y2={CHART_HEIGHT}
                stroke={x % 56 === 0 ? GRID_MAJOR : GRID_MINOR}
                strokeWidth={x % 56 === 0 ? 1 : 0.7}
              />
            ))}

            {points.length > 0 ? (
              <>
                <Polyline
                  points={points}
                  fill="none"
                  stroke={connected ? TRACE_SOFT : '#cbd5e1'}
                  strokeWidth={4}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.45}
                />
                <Polyline
                  points={points}
                  fill="none"
                  stroke={connected ? TRACE : '#94a3b8'}
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            ) : null}

            {connected && tip ? (
              <Circle
                cx={tip.x}
                cy={tip.y}
                r={3.5}
                fill={TRACE}
                stroke="#ffffff"
                strokeWidth={1.5}
                opacity={pulseOn ? 1 : 0.5}
              />
            ) : null}
          </Svg>
        ) : (
          <View style={{ height: CHART_HEIGHT }} />
        )}

        <View style={styles.scaleCol} pointerEvents="none">
          <Text style={styles.scaleText}>{RMS_SCALE}</Text>
          <Text style={styles.scaleText}>{RMS_SCALE / 2}</Text>
          <Text style={styles.scaleText}>0</Text>
        </View>

        <View style={styles.axisRow}>
          <Text style={styles.axisText}>−{WINDOW_SEC}s</Text>
          <Text style={styles.axisCenter}>RMS</Text>
          <Text style={styles.axisText}>now →</Text>
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: TRACE }]} />
          <Text style={styles.legendLabel}>Snore spike (time · RMS)</Text>
        </View>
        <Text style={styles.legendHelp}>
          {connected ? 'Totals in History Logs' : 'Connect pillow to start'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: '#164e73',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: '#7dd3fc',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  livePillOff: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: {
    color: '#047857',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  summaryUnit: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  chartWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: SCREEN_BG,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  scaleCol: {
    position: 'absolute',
    left: 5,
    top: 10,
    bottom: 26,
    justifyContent: 'space-between',
  },
  scaleText: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '700',
  },
  axisRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  axisText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  axisCenter: {
    color: 'rgba(82, 103, 123, 0.45)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  legend: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  legendColor: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  legendHelp: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
});
