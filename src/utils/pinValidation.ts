/** Must match firmware PAIR_PIN on the mic ESP32. */
export const EXPECTED_PAIRING_PIN = '1234567';

export const isValidPairingPin = (pin: string): boolean => /^\d{7}$/.test(pin);

/** True only when the PIN matches the pillow label / firmware. */
export const isCorrectPairingPin = (pin: string): boolean => pin === EXPECTED_PAIRING_PIN;
