import { qualityCheckActions, selectVerifiedActions } from './wellnessKnowledge';

describe('verified wellness knowledge', () => {
  test('prioritizes a reported habit and avoids unsuccessful similar actions', () => {
    const selected = selectVerifiedActions(
      { date: '2026-10-01', activities: ['caffeine'], updatedAt: 1 } as any,
      [{ actionKey: 'x', actionText: 'Move your final caffeinated drink to at least 8 hours before bedtime tomorrow.', feedback: 'not_helpful', planDate: '2026-09-30', updatedAt: 2 }],
    );
    expect(selected.some((entry) => entry.id === 'caffeine-cutoff')).toBe(false);
  });

  test('only offers habit actions supported by a paperwork check-in', () => {
    const selected = selectVerifiedActions(
      { date: '2026-10-01', activities: [], otherActivityNote: 'I had a lot of paperworks', updatedAt: 1 } as any,
      [],
    );
    expect(selected.some((entry) => entry.id === 'stress-reset')).toBe(true);
    expect(selected.some((entry) => entry.id === 'alcohol-buffer')).toBe(false);
    expect(selected.some((entry) => entry.id === 'screen-winddown')).toBe(false);
  });

  test('rejects vague and unsafe generated actions', () => {
    const checked = qualityCheckActions(
      ['Relax more.', 'Try mouth taping tonight.', 'Dim screens for 30 minutes before bedtime tonight.'],
      ['Keep a fixed wake time tomorrow.'],
    );
    expect(checked).toContain('Dim screens for 30 minutes before bedtime tonight.');
    expect(checked.join(' ')).not.toMatch(/mouth tap/i);
  });
});
