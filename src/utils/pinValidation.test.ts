import { isValidPairingPin } from './pinValidation';

describe('isValidPairingPin', () => {
  it('accepts any 7-digit numeric code', () => {
    expect(isValidPairingPin('1234567')).toBe(true);
    expect(isValidPairingPin('0000000')).toBe(true);
  });

  it('rejects codes that are not exactly 7 digits', () => {
    expect(isValidPairingPin('123456')).toBe(false);
    expect(isValidPairingPin('12345678')).toBe(false);
    expect(isValidPairingPin('abc1234')).toBe(false);
    expect(isValidPairingPin('')).toBe(false);
  });
});
