module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest/setup.js'],
  moduleNameMapper: { '\\.css$': '<rootDir>/jest/styleMock.js' },
  transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native(-[a-z-]+)?|@react-native(-community)?|@react-native-async-storage|@notifee)/)'],
};
