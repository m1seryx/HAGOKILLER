import {
  Image, ImageSourcePropType, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import moment from 'moment';
import { CalibrationLogEntry, SleepEvent } from '../types';
import { colors } from '../constants/theme';

const TRACE = '#0ea5e9';
const RMS_FULL_SCALE = 250;
const SEGMENT_COUNT = 10;

export type LogItem =
  | { kind: 'event'; key: string; timestamp: number; event: SleepEvent }
  | { kind: 'calibration'; key: string; timestamp: number; entry: CalibrationLogEntry };

export interface LogBadge {
  label: string;
  color: string;
  bg: string;
}

interface Props {
  item: LogItem | null;
  artwork?: ImageSourcePropType;
  badge?: LogBadge;
  onClose: () => void;
}

interface DetailRow {
  label: string;
  value: string;
  mono?: boolean;
}

// Must match the mic firmware sound gate: rms > noiseRms * RMS_RATIO + RMS_MARGIN.
const FIRMWARE_RMS_RATIO = 1.35;
const FIRMWARE_RMS_MARGIN = 120;

const EVENT_CODE_NAMES: Record<number, string> = {
  1: 'Sound / snore',
  2: 'Heartbeat',
  3: 'Pump stop',
  4: 'Open valve',
  5: 'Snore keepalive',
  6: 'Valve pulse',
  7: 'Mic calibrated (legacy)',
  9: 'Mic test preview',
};

const SOURCE_NAMES: Record<string, string> = {
  esp32: 'Smart pillow (ESP32)',
  mock: 'Demo pillow',
  seed: 'Sample data',
};

const formatFullTime = (timestamp: number) => moment(timestamp).format('dddd, MMMM D, YYYY · h:mm:ss A');

function eventTitle(event: SleepEvent) {
  if (event.maxElevationHold) return 'Still snoring at max elevation';
  return event.interventionTriggered ? 'Pillow inflated' : 'Snore detected';
}

function eventSummary(event: SleepEvent) {
  if (event.maxElevationHold) {
    return 'Snoring continued for 10 seconds after the pump reached its maximum time, so the pillow held its position and the phone alarm started.';
  }
  if (event.interventionTriggered) {
    return 'Enough snores were heard in the time window, so the pillow inflated for the maximum pump time and stayed raised.';
  }
  return 'Hagosaur heard a snore. It counts toward the trigger window but did not inflate the pillow on its own.';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function volumeLevel(event: SleepEvent): number | null {
  if (typeof event.level !== 'number') return null;
  return clamp(Math.round(event.level), 0, SEGMENT_COUNT);
}

function rmsSegments(rms?: number): number | null {
  if (typeof rms !== 'number') return null;
  if (rms <= 0) return 0;
  return clamp(Math.round((rms / RMS_FULL_SCALE) * SEGMENT_COUNT), 1, SEGMENT_COUNT);
}

function formatSnoreLength(seconds: number) {
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}

function SegmentMeter({
  label,
  valueText,
  filled,
  color,
}: {
  label: string;
  valueText: string;
  filled: number;
  color: string;
}) {
  return (
    <View style={styles.meter}>
      <View style={styles.meterHead}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={styles.meterValue}>{valueText}</Text>
      </View>
      <View style={styles.segments} accessibilityLabel={`${label} ${valueText}`}>
        {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
          <View
            key={index}
            style={[styles.segment, { backgroundColor: index < filled ? color : '#e0f2fe' }]}
          />
        ))}
      </View>
    </View>
  );
}

export function SleepEventMeters({ event, variant = 'card' }: { event: SleepEvent; variant?: 'card' | 'sheet' }) {
  const level = volumeLevel(event);
  const rmsFilled = rmsSegments(event.rms);
  const sheet = variant === 'sheet';

  return (
    <View style={sheet ? styles.chartCard : styles.cardMeters}>
      <View style={styles.ecgHead}>
        <Text style={styles.meterLabel}>SNORE LENGTH</Text>
        <Text style={styles.meterValue}>{formatSnoreLength(event.duration)}</Text>
      </View>
      {level != null || rmsFilled != null ? (
        <View style={[styles.meterRow, sheet && styles.meterRowSheet]}>
          {level != null ? (
            <SegmentMeter label="VOLUME" valueText={`${level}/10`} filled={level} color={TRACE} />
          ) : null}
          {rmsFilled != null ? (
            <SegmentMeter label="RMS" valueText={String(event.rms)} filled={rmsFilled} color="#0284c7" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function eventRows(event: SleepEvent): DetailRow[] {
  const rows: DetailRow[] = [
    { label: 'Date & time', value: formatFullTime(event.timestamp) },
    { label: 'Severity', value: event.severity.charAt(0).toUpperCase() + event.severity.slice(1) },
  ];
  if (event.snoreStreak != null) rows.push({ label: 'Snores in window', value: String(event.snoreStreak) });
  rows.push({ label: 'Pillow inflated', value: event.interventionTriggered ? 'Yes' : 'No' });
  if (event.maxElevationHold) rows.push({ label: 'Max elevation alert', value: 'Yes' });
  if (event.source) rows.push({ label: 'Source', value: SOURCE_NAMES[event.source] ?? event.source });
  if (event.eventCode != null) {
    rows.push({
      label: 'Firmware event',
      value: `${event.eventCode} · ${EVENT_CODE_NAMES[event.eventCode] ?? 'Unknown'}`,
    });
  }
  if (event.rawPayload) rows.push({ label: 'Raw packet', value: event.rawPayload, mono: true });
  rows.push({ label: 'Log ID', value: event.id, mono: true });
  return rows;
}

function calibrationRows(entry: CalibrationLogEntry): DetailRow[] {
  const triggerRms = Math.round(entry.noiseFloorRms * FIRMWARE_RMS_RATIO + FIRMWARE_RMS_MARGIN);
  return [
    { label: 'Date & time', value: formatFullTime(entry.timestamp) },
    { label: 'Type', value: entry.fresh ? 'New calibration' : 'Reused calibration' },
    { label: 'Room noise floor (RMS)', value: String(entry.noiseFloorRms) },
    { label: 'Sound trigger level', value: `≈ ${triggerRms} RMS` },
    { label: 'Mic shift (sensitivity)', value: `${entry.micShift} · lower = more sensitive` },
    { label: 'Log ID', value: entry.id, mono: true },
  ];
}

export function LogDetailSheet({ item, artwork, badge, onClose }: Props) {
  const isCalibration = item?.kind === 'calibration';
  const title = !item ? '' : item.kind === 'calibration' ? 'Mic calibrated' : eventTitle(item.event);
  const summary = !item
    ? ''
    : item.kind === 'calibration'
      ? 'The mic measured how quiet the room is. Only sounds clearly louder than this are checked for snoring.'
      : eventSummary(item.event);
  const rows = !item ? [] : item.kind === 'calibration' ? calibrationRows(item.entry) : eventRows(item.event);

  return (
    <Modal transparent visible={item !== null} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close log details" />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          {artwork ? (
            <View style={[styles.artWrap, { backgroundColor: badge?.bg ?? colors.backgroundMuted }]}>
              <Image source={artwork} style={styles.art} resizeMode="contain" />
            </View>
          ) : null}
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{isCalibration ? 'MIC CALIBRATION' : 'SLEEP EVENT'}</Text>
            <Text style={styles.title}>{title}</Text>
            {badge ? (
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
            <FontAwesome5 name="times" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.rows} showsVerticalScrollIndicator={false}>
          <Text style={styles.summary}>{summary}</Text>
          {item?.kind === 'event' ? <SleepEventMeters event={item.event} variant="sheet" /> : null}
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={[styles.rowValue, row.mono && styles.rowValueMono]} selectable>
                {row.value}
              </Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5, 6, 12, 0.5)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#f8fbff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderColor: '#dbeafe',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  artWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  art: { width: 60, height: 60 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 3 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  closeButton: { padding: 8, marginLeft: 8 },
  summary: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 14, marginBottom: 10 },
  rows: { flexShrink: 1 },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  cardMeters: { marginTop: 8 },
  ecgHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  meterRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  meterRowSheet: { marginTop: 12 },
  meter: { flex: 1, minWidth: 0 },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  meterLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  meterValue: { color: colors.text, fontSize: 12, fontWeight: '800' },
  segments: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 8, borderRadius: 3 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', flexShrink: 0 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right' },
  rowValueMono: { fontFamily: 'monospace', fontSize: 11, fontWeight: '500' },
});
