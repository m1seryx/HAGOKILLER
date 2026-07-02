export const isValidPairingPin = (pin: string): boolean => /^\d{7}$/.test(pin);
