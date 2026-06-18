import { DailyStats, MonthlyStats, RecommendationData } from '../types';

export const getRecommendations = (
  dailyStats: DailyStats,
  monthlyStats: MonthlyStats,
  trend: 'improving' | 'stable' | 'worsening'
): RecommendationData => {
  const severityLevel = dailyStats.severity;
  let recommendation = '';
  let actionItems: string[] = [];
  let trendMessage = '';

  // Trend message
  if (trend === 'improving') {
    trendMessage = 'Your snoring is improving! Keep up the good practices.';
  } else if (trend === 'worsening') {
    trendMessage = 'Your snoring frequency is increasing. Pay close attention to your sleep habits.';
  } else {
    trendMessage = 'Your snoring patterns are stable. Continue monitoring.';
  }

  // Severity-based recommendations
  if (severityLevel === 'normal') {
    recommendation = 'Your sleep quality is within normal range. Continue monitoring your sleep patterns.';
    actionItems = [
      'Maintain regular sleep schedule (consistent bedtime and wake time)',
      'Keep bedroom cool and well-ventilated',
      'Avoid heavy meals, alcohol, and sedatives before bed',
      'Sleep on your side when possible',
      'Stay hydrated during the day',
    ];
  } else if (severityLevel === 'bad') {
    recommendation =
      'Your snoring frequency is elevated. Consider lifestyle adjustments to improve sleep quality.';
    actionItems = [
      'Try sleeping on your side using a body pillow or positional device',
      'Maintain healthy weight and exercise regularly',
      'Practice nasal clearing techniques before bed',
      'Use a humidifier to keep airways moist',
      'Elevate your head during sleep using an extra pillow',
      'Avoid antihistamines and muscle relaxants before bed',
    ];
  } else {
    // danger level
    recommendation =
      'Your snoring frequency is significantly elevated and requires professional attention. Please seek medical evaluation from a sleep specialist.';
    actionItems = [
      'Schedule an appointment with a sleep specialist or ENT doctor',
      'Consider a sleep study (polysomnography) to assess for sleep apnea',
      'Do not ignore these symptoms as they may indicate a serious sleep disorder',
      'In the meantime, try sleeping on your side and elevate your head',
      'Track your symptoms and share this data with your healthcare provider',
    ];
  }

  return {
    severityLevel,
    recommendation,
    actionItems,
    trendMessage,
  };
};

export const getSeverityColor = (severity: 'normal' | 'bad' | 'danger'): string => {
  switch (severity) {
    case 'normal':
      return '#10b981'; // Green
    case 'bad':
      return '#f59e0b'; // Amber
    case 'danger':
      return '#ef4444'; // Red
    default:
      return '#6b7280'; // Gray
  }
};

export const getSeverityLabel = (severity: 'normal' | 'bad' | 'danger'): string => {
  switch (severity) {
    case 'normal':
      return 'Normal';
    case 'bad':
      return 'Elevated';
    case 'danger':
      return 'Critical';
    default:
      return 'Unknown';
  }
};
