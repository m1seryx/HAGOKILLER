import moment from 'moment';
import { calculateInterventionEffectiveness, getNightKey, calculateNightDetail } from './statsCalculator';

describe('calculateInterventionEffectiveness', () => {
  test('evaluates sleep metrics and returns correct trend status', () => {
    const improvingResult = calculateInterventionEffectiveness([
      { id: '1', timestamp: 1, duration: 40, severity: 'medium', interventionTriggered: true, interventionDuration: 12 },
      { id: '2', timestamp: 2, duration: 50, severity: 'high', interventionTriggered: true, interventionDuration: 12 },
      { id: '3', timestamp: 3, duration: 60, severity: 'high', interventionTriggered: false, interventionDuration: 0 },
      { id: '4', timestamp: 4, duration: 42, severity: 'medium', interventionTriggered: true, interventionDuration: 10 },
    ] as any);

    expect(improvingResult.totalTriggers).toBe(3);
    expect(improvingResult.successfulAdjustments).toBe(2);
    expect(Math.abs(improvingResult.successRatio - 0.6667)).toBeLessThan(0.0001);
    expect(improvingResult.trend).toBe('improving');

    const worseningResult = calculateInterventionEffectiveness([
      { id: '1', timestamp: 1, duration: 70, severity: 'high', interventionTriggered: true, interventionDuration: 12 },
      { id: '2', timestamp: 2, duration: 65, severity: 'high', interventionTriggered: true, interventionDuration: 12 },
    ] as any);

    expect(worseningResult.successRatio).toBe(0);
    expect(worseningResult.trend).toBe('worsening');
  });
});

describe('night peak detail', () => {
  test('groups evening and early-morning events into one night and finds peak hour', () => {
    const tue = moment('2026-03-17T00:00:00');
    const events = [
      {
        id: 'a',
        timestamp: tue.clone().subtract(1, 'day').hour(22).minute(10).valueOf(),
        duration: 20,
        severity: 'low',
        interventionTriggered: false,
        interventionDuration: 0,
      },
      {
        id: 'b',
        timestamp: tue.clone().hour(2).minute(5).valueOf(),
        duration: 30,
        severity: 'medium',
        interventionTriggered: true,
        interventionDuration: 12,
      },
      {
        id: 'c',
        timestamp: tue.clone().hour(2).minute(40).valueOf(),
        duration: 25,
        severity: 'high',
        interventionTriggered: false,
        interventionDuration: 0,
      },
      {
        id: 'd',
        timestamp: tue.clone().hour(5).minute(15).valueOf(),
        duration: 15,
        severity: 'low',
        interventionTriggered: false,
        interventionDuration: 0,
      },
    ] as any;

    expect(getNightKey(events[0].timestamp)).toBe('2026-03-17');
    expect(getNightKey(events[1].timestamp)).toBe('2026-03-17');

    const night = calculateNightDetail(events, '2026-03-17');
    expect(night.totalSnoreEvents).toBe(4);
    expect(night.peakHour).toBe(2);
    expect(night.peakWindowLabel).toContain('2:00');
    expect(night.interventionCount).toBe(1);
    expect(night.topPeakHours[0]).toBe(2);
  });
});
