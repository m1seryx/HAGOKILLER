import { calculateInterventionEffectiveness } from './statsCalculator';

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runChecks = () => {
  const improvingResult = calculateInterventionEffectiveness([
    { id: '1', timestamp: 1, duration: 40, severity: 'medium', interventionTriggered: true, interventionDuration: 12 },
    { id: '2', timestamp: 2, duration: 50, severity: 'high', interventionTriggered: true, interventionDuration: 12 },
    { id: '3', timestamp: 3, duration: 60, severity: 'high', interventionTriggered: false, interventionDuration: 0 },
    { id: '4', timestamp: 4, duration: 42, severity: 'medium', interventionTriggered: true, interventionDuration: 10 },
  ] as any);

  assert(improvingResult.totalTriggers === 3, 'Expected 3 triggers');
  assert(improvingResult.successfulAdjustments === 2, 'Expected 2 successful adjustments');
  assert(Math.abs(improvingResult.successRatio - 0.6667) < 0.0001, 'Expected success ratio to be 0.6667');
  assert(improvingResult.trend === 'improving', 'Expected improving trend');

  const worseningResult = calculateInterventionEffectiveness([
    { id: '1', timestamp: 1, duration: 70, severity: 'high', interventionTriggered: true, interventionDuration: 12 },
    { id: '2', timestamp: 2, duration: 65, severity: 'high', interventionTriggered: true, interventionDuration: 12 },
  ] as any);

  assert(worseningResult.successRatio === 0, 'Expected zero success ratio');
  assert(worseningResult.trend === 'worsening', 'Expected worsening trend');
};

runChecks();
