import * as Crypto from 'expo-crypto';

/**
 * Production ID source for cycleRepository/entryRepository. Kept in its own
 * leaf file — importing expo-crypto pulls in react-native's Flow-syntax
 * source, which vitest/Vite can't parse, so no test file may import this
 * (directly or transitively). Only real screen code should.
 */
export function newId(): string {
  return Crypto.randomUUID();
}
