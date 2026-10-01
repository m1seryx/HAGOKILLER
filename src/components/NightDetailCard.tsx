import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import moment from 'moment';
import { NightDetail, SleepEvent } from '../types';
import { getSeverityColor } from '../utils/recommendations';
import { formatPeakWindow, getNightLabel } from '../utils/statsCalculator';
import { analyzeInterventionOutcomes } from '../utils/wellnessAnalytics';

interface NightDetailCardProps {
  night: NightDetail;
  nightKeys: string[];
  selectedKey: string;
  onSelectNight: (nightKey: string) => void;
  events: SleepEvent[];
}

export const NightDetailCard: React.FC<NightDetailCardProps> = ({
  night,
  nightKeys,
  selectedKey,
  onSelectNight,
  events,
}) => {
  const { width } = useWindowDimensions();
  const severityColor = getSeverityColor(night.severity);

  const visibleHours = useMemo(
    () => night.hourly.filter((h) => h.hour >= 21 || h.hour <= 8),
    [night.hourly],
  );

  const chartWidth = Math.min(width - 28, 560);
  const eventTimeline = useMemo(
    () => [...events].sort((a, b) => a.timestamp - b.timestamp),
    [events],
  );
  const interventionOutcomes = useMemo(
    () => analyzeInterventionOutcomes(eventTimeline),
    [eventTimeline],
  );
  const outcomesByEvent = useMemo(
    () => new Map(interventionOutcomes.map((outcome) => [outcome.event.id, outcome])),
    [interventionOutcomes],
  );
  const successfulInterventions = interventionOutcomes.filter((outcome) => outcome.appearedEffective).length;
  const observedOutcomes = interventionOutcomes.filter((outcome) => outcome.minutesToNext !== null);
  const averageResponseMinutes = observedOutcomes.length > 0
    ? Math.round((observedOutcomes.reduce((sum, outcome) => sum + (outcome.minutesToNext ?? 0), 0) / observedOutcomes.length) * 10) / 10
    : null;
  const comparableOutcomes = interventionOutcomes.filter((outcome) => outcome.nextEvent);
  const averageBefore = comparableOutcomes.length > 0
    ? Math.round(comparableOutcomes.reduce((sum, outcome) => sum + outcome.event.duration, 0) / comparableOutcomes.length)
    : null;
  const averageAfter = comparableOutcomes.length > 0
    ? Math.round(comparableOutcomes.reduce((sum, outcome) => sum + (outcome.nextEvent?.duration ?? 0), 0) / comparableOutcomes.length)
    : null;

  const chartData = useMemo(() => {
    const labels = visibleHours.map((h) => moment().hour(h.hour).minute(0).format('ha'));
    const counts = visibleHours.map((h) => h.count);
    // chart-kit crashes on empty/all-zero in some cases — keep a floor dataset shape
    const data = counts.every((c) => c === 0) ? counts.map(() => 0) : counts;

    return {
      labels,
      datasets: [
        {
          data: data.length ? data : [0],
          colors: visibleHours.map((bucket) => {
            const isPeak = bucket.hour === night.peakHour && bucket.count > 0;
            return (opacity = 1) => {
              if (bucket.count === 0) return `rgba(14, 165, 233, ${opacity * 0.18})`;
              if (isPeak) {
                // Severity color with opacity
                const hex = severityColor.replace('#', '');
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
              }
              return `rgba(14, 165, 233, ${opacity * 0.85})`;
            };
          }),
        },
      ],
    };
  }, [visibleHours, night.peakHour, severityColor]);

  const chartConfig = {
    backgroundColor: '#0b1834',
    backgroundGradientFrom: '#0b1834',
    backgroundGradientTo: '#132b52',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(203, 225, 255, ${opacity})`,
    barPercentage: 0.65,
    propsForBackgroundLines: {
      strokeDasharray: '4',
      stroke: 'rgba(191, 219, 254, 0.14)',
    },
    style: { borderRadius: 16 },
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleIndicator} />
          <Text style={styles.title}>Night Detail</Text>
        </View>
        <Text style={styles.subtitle}>Peak snore times for this sleep night</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.nightChips}
      >
        {nightKeys.map((key) => {
          const active = key === selectedKey;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelectNight(key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {getNightLabel(key)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.peakCard, { borderColor: `${severityColor}55` }]}>
        <View style={[styles.peakIcon, { backgroundColor: `${severityColor}22` }]}>
          <FontAwesome5 name="clock" size={16} color={severityColor} />
        </View>
        <View style={styles.peakCopy}>
          <Text style={styles.peakEyebrow}>Peak snoring time</Text>
          <Text style={[styles.peakValue, { color: severityColor }]}>
            {night.totalSnoreEvents > 0 ? night.peakWindowLabel : 'No peak recorded'}
          </Text>
          <Text style={styles.peakMeta}>
            {night.totalSnoreEvents > 0
              ? `${night.hourly.find((h) => h.hour === night.peakHour)?.count ?? 0} events occurred during this hour`
              : 'A peak time will appear after the pillow records a snoring event.'}
          </Text>
        </View>
      </View>

      {night.totalSnoreEvents === 0 ? (
        <View style={styles.emptyWrap}>
          <FontAwesome5 name="moon" size={18} color="#7dd3fc" />
          <Text style={styles.emptyTitle}>No snoring recorded</Text>
          <Text style={styles.emptyHint}>This night has no logged snore events yet.</Text>
        </View>
      ) : (
        <>
          {night.topPeakHours.length > 1 ? (
            <View style={styles.topPeaksRow}>
              {night.topPeakHours.map((hour, index) => {
                const count = night.hourly.find((h) => h.hour === hour)?.count ?? 0;
                return (
                  <View key={`${hour}-${index}`} style={styles.topPeakPill}>
                    <Text style={styles.topPeakRank}>#{index + 1}</Text>
                    <Text style={styles.topPeakTime}>{formatPeakWindow(hour)}</Text>
                    <Text style={styles.topPeakCount}>{count}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={styles.timelineLabel}>Overnight timeline</Text>
          <View style={styles.chartWrapper}>
            <BarChart
              data={chartData}
              width={chartWidth}
              height={200}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={chartConfig}
              style={styles.chart}
              fromZero
              showValuesOnTopOfBars
              withCustomBarColorFromData
              flatColor
              withInnerLines
            />
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#38bdf8' }]} />
              <Text style={styles.legendLabel}>Hourly snores</Text>
            </View>
            <View style={styles.legendDivider} />
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: severityColor }]} />
              <Text style={styles.legendLabel}>Peak hour</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{night.totalSnoreEvents}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{night.interventionCount}</Text>
              <Text style={styles.statLabel}>Inflates</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{night.averageDuration}s</Text>
              <Text style={styles.statLabel}>Avg</Text>
            </View>
          </View>

          <View style={styles.effectivenessCard}>
            <View style={styles.effectivenessHeader}>
              <View style={styles.effectivenessIcon}>
                <FontAwesome5 name="wind" size={13} color="#34d399" />
              </View>
              <View style={styles.effectivenessCopy}>
                <Text style={styles.effectivenessEyebrow}>PILLOW RESPONSE</Text>
                <Text style={styles.effectivenessTitle}>
                  {interventionOutcomes.length > 0
                    ? `${interventionOutcomes.length} interventions, ${successfulInterventions} appeared effective`
                    : 'No pillow interventions this night'}
                </Text>
              </View>
            </View>
            {interventionOutcomes.length > 0 ? (
              <View style={styles.effectivenessMetrics}>
                <View style={styles.effectivenessMetric}>
                  <Text style={styles.effectivenessValue}>
                    {Math.round((successfulInterventions / interventionOutcomes.length) * 100)}%
                  </Text>
                  <Text style={styles.effectivenessLabel}>Success</Text>
                </View>
                <View style={styles.effectivenessMetric}>
                  <Text style={styles.effectivenessValue}>{averageResponseMinutes ?? '—'}{averageResponseMinutes !== null ? 'm' : ''}</Text>
                  <Text style={styles.effectivenessLabel}>Next event</Text>
                </View>
                <View style={styles.effectivenessMetric}>
                  <Text style={styles.effectivenessValue}>
                    {averageBefore !== null && averageAfter !== null ? `${averageBefore}s → ${averageAfter}s` : '—'}
                  </Text>
                  <Text style={styles.effectivenessLabel}>Before / after</Text>
                </View>
              </View>
            ) : null}
            <Text style={styles.effectivenessNote}>
              “Appeared effective” means the next event was quieter, shorter, at least 30 minutes later, or no later event was recorded.
            </Text>
          </View>

          <Text style={styles.eventTimelineTitle}>Event and intervention timeline</Text>
          <View style={styles.eventTimeline}>
            {eventTimeline.slice(0, 16).map((event, index) => {
              const outcome = outcomesByEvent.get(event.id);
              return (
                <View key={event.id} style={styles.eventRow}>
                  <View style={styles.eventRail}>
                    <View style={[styles.eventDot, event.interventionTriggered && styles.eventDotIntervention]} />
                    {index < Math.min(eventTimeline.length, 16) - 1 ? <View style={styles.eventLine} /> : null}
                  </View>
                  <View style={styles.eventContent}>
                    <View style={styles.eventHeadingRow}>
                      <Text style={styles.eventTime}>{moment(event.timestamp).format('h:mm A')}</Text>
                      <Text style={styles.eventMeta}>{event.duration}s · {event.severity}</Text>
                    </View>
                    <Text style={styles.eventName}>
                      {event.interventionTriggered ? `Snore detected · pillow inflated ${event.interventionDuration}s` : 'Snore detected'}
                    </Text>
                    {outcome ? (
                      <Text style={[styles.eventOutcome, outcome.appearedEffective ? styles.eventOutcomeGood : styles.eventOutcomeWatch]}>
                        {outcome.appearedEffective ? 'Appeared effective · ' : 'Keep monitoring · '}{outcome.explanation}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          {night.firstSnoreAt && night.lastSnoreAt ? (
            <Text style={styles.spanText}>
              First {moment(night.firstSnoreAt).format('h:mm A')} · Last{' '}
              {moment(night.lastSnoreAt).format('h:mm A')}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 8,
    marginBottom: 16,
  },
  header: { marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  titleIndicator: {
    width: 4,
    height: 14,
    backgroundColor: '#38bdf8',
    borderRadius: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#eef7ff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  subtitle: { fontSize: 12, color: '#a9bfdf' },
  nightChips: { gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#15294c',
    borderWidth: 1,
    borderColor: '#294a78',
  },
  chipActive: {
    backgroundColor: '#123d68',
    borderColor: '#38bdf8',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: '#a9bfdf' },
  chipTextActive: { color: '#e0f2fe' },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#eef7ff' },
  emptyHint: { fontSize: 12, color: '#a9bfdf', textAlign: 'center' },
  peakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#132747',
    borderWidth: 1,
    marginBottom: 12,
  },
  peakIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peakCopy: { flex: 1 },
  peakEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a9bfdf',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  peakValue: { fontSize: 18, fontWeight: '800' },
  peakMeta: { fontSize: 12, color: '#a9bfdf', marginTop: 2 },
  topPeaksRow: { gap: 8, marginBottom: 14 },
  topPeakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#102342',
  },
  topPeakRank: { fontSize: 11, fontWeight: '800', color: '#7dd3fc', width: 22 },
  topPeakTime: { flex: 1, fontSize: 12, fontWeight: '600', color: '#eef7ff' },
  topPeakCount: { fontSize: 12, fontWeight: '700', color: '#a9bfdf' },
  timelineLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a9bfdf',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartWrapper: {
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0b1834',
  },
  chart: {
    marginVertical: 4,
    borderRadius: 12,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendColor: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: '#a9bfdf', fontWeight: '500' },
  legendDivider: { width: 1, height: 10, backgroundColor: '#294a78' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#294a78',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#eef7ff' },
  statLabel: { fontSize: 11, color: '#a9bfdf', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: '#294a78' },
  spanText: {
    marginTop: 10,
    fontSize: 11,
    color: '#a9bfdf',
    textAlign: 'center',
  },
  effectivenessCard: { marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: '#102342', borderWidth: 1, borderColor: '#235177' },
  effectivenessHeader: { flexDirection: 'row', alignItems: 'center' },
  effectivenessIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(52, 211, 153, 0.12)', marginRight: 10 },
  effectivenessCopy: { flex: 1 },
  effectivenessEyebrow: { color: '#6ee7b7', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  effectivenessTitle: { color: '#eef7ff', fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 2 },
  effectivenessMetrics: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#294a78' },
  effectivenessMetric: { flex: 1, alignItems: 'center', paddingHorizontal: 3 },
  effectivenessValue: { color: '#eef7ff', fontSize: 14, fontWeight: '900' },
  effectivenessLabel: { color: '#8fa8c7', fontSize: 8, marginTop: 3, textAlign: 'center' },
  effectivenessNote: { color: '#7890aa', fontSize: 9, lineHeight: 14, marginTop: 12 },
  eventTimelineTitle: { color: '#a9bfdf', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 20, marginBottom: 12 },
  eventTimeline: { paddingHorizontal: 2 },
  eventRow: { flexDirection: 'row', minHeight: 74 },
  eventRail: { width: 22, alignItems: 'center' },
  eventDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5, backgroundColor: '#38bdf8', borderWidth: 2, borderColor: '#0b1834' },
  eventDotIntervention: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#34d399' },
  eventLine: { flex: 1, width: 1, backgroundColor: '#294a78', marginVertical: 3 },
  eventContent: { flex: 1, paddingBottom: 14, paddingLeft: 8 },
  eventHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTime: { color: '#eef7ff', fontSize: 12, fontWeight: '800' },
  eventMeta: { color: '#7890aa', fontSize: 9, textTransform: 'capitalize' },
  eventName: { color: '#a9bfdf', fontSize: 10, marginTop: 3 },
  eventOutcome: { fontSize: 9, lineHeight: 13, marginTop: 4, fontWeight: '600' },
  eventOutcomeGood: { color: '#6ee7b7' },
  eventOutcomeWatch: { color: '#fbbf24' },
});
