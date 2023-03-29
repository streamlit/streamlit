/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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