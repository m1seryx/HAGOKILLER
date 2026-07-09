module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules[\\/](?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?[\\/].*|@expo-google-fonts[\\/].*|react-navigation|@react-navigation[\\/].*|@unimodules[\\/].*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
