import { parseLlmAdvice } from './llmAdviceParser';

describe('parseLlmAdvice', () => {
  test('accepts fenced JSON with a trailing comma', () => {
    const parsed = parseLlmAdvice(`\`\`\`json
      {"recommendation":"Your late caffeine may be relevant.","progressMessage":"","actionItems":["Move your last coffee before 2 PM.","Dim screens for 30 minutes before bed.",],}
    \`\`\``, false);
    expect(parsed.actionItems).toHaveLength(2);
    expect(parsed.recommendation).toContain('caffeine');
  });

  test('recovers actions from a truncated response and uses the safe summary', () => {
    const parsed = parseLlmAdvice(
      '{"actionItems":["Use saline 20 minutes before bed.","Sleep on your side tonight."',
      false,
      'Safe sensor-based summary.',
    );
    expect(parsed.recommendation).toBe('Safe sensor-based summary.');
    expect(parsed.actionItems).toEqual([
      'Use saline 20 minutes before bed.',
      'Sleep on your side tonight.',
    ]);
  });

  test('never shows progress language when measurements are not improving', () => {
    const parsed = parseLlmAdvice(
      '{"recommendation":"Keep monitoring.","progressMessage":"Great improvement!","actions":["Keep a fixed bedtime tonight."]}',
      false,
    );
    expect(parsed.progressMessage).toBe('');
  });
});
