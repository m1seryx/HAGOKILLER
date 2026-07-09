import { calculateInterventionEffectiveness } from './statsCalculator';

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
