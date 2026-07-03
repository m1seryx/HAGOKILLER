import { calculateInterventionEffectiveness } from './statsCalculator';

describe('calculateInterventionEffectiveness', () => {
  it('returns an improving success ratio when more interventions are successful', () => {
    const result = calculateInterventionEffectiveness([
      { id: '1', timestamp: 1, duration: 40, severity: 'medium', interventionTriggered: true, interventionDuration: 12 },
      { id: '2', timestamp: 2, duration: 50, severity: 'high', interventionTriggered: true, interventionDuration: 12 },
      { id: '3', timestamp: 3, duration: 60, severity: 'high', interventionTriggered: false, interventionDuration: 0 },
      { id: '4', timestamp: 4, duration: 42, severity: 'medium', interventionTriggered: true, interventionDuration: 10 },
    ] as any);

    expect(result.totalTriggers).toBe(3);
    expect(result.successfulAdjustments).toBe(2);
    expect(result.successRatio).toBeCloseTo(0.6667, 4);
    expect(result.trend).toBe('improving');
  });

  it('returns a worsening trend when few interventions succeed', () => {
    const result = calculateInterventionEffectiveness([
      { id: '1', timestamp: 1, duration: 70, severity: 'high', interventionTriggered: true, interventionDuration: 12 },
      { id: '2', timestamp: 2, duration: 65, severity: 'high', interventionTriggered: true, interventionDuration: 12 },
    ] as any);

    expect(result.successRatio).toBe(0);
    expect(result.trend).toBe('worsening');
  });
});
