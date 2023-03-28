module.exports = {
    roots: ['<rootDir>/src'],
    collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.d.ts'],
    setupFiles: ['jest-canvas-mock'],
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
    testMatch: ['<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}', '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}'],
    testEnvironment: "jsdom",
    transform: {
      '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': '<rootDir>/../sharedConfigs/jest/babelTransform.js',
      '^.+\\.css$': '<rootDir>/../sharedConfigs/jest/cssTransform.js',
      '^(?!.*\\.(js|jsx|mjs|cjs|ts|tsx|css|json)$)': '<rootDir>/../sharedConfigs/jest/fileTransform.js',
    },
    transformIgnorePatterns: [
        '^.+\\.module\\.(css|sass|scss)$',
        "/node_modules/(?!glideapps)/.+\\.js$",
      ],
    modulePaths: [],
    moduleNameMapper: {
      '^react-native$': 'react-native-web',
      '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
      '^src/(.*)$': '<rootDir>/src/$1',
    },
    reporters: ["default", "jest-github-actions-reporter"],
    moduleFileExtensions: ['web.js', 'js', 'web.ts', 'ts', 'web.tsx', 'tsx', 'json', 'web.jsx', 'jsx', 'node'],
    watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],
    resetMocks: false,
    coverageReporters: ['text', 'html'],
    snapshotSerializers: ['enzyme-to-json/serializer', '@emotion/jest/enzyme-serializer'],
  };