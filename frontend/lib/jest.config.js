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
  // look in src directory for tests
  roots: ["<rootDir>/src"],
  // get coverage for test files but ignore bokeh files and type files
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.min.js",
  ],
  // needed for vegalite tests as vega uses canvas
  setupFiles: ["jest-canvas-mock"],
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"],
  testMatch: ["<rootDir>/src/**/*.{test,}.{js,jsx,ts,tsx}"],
  // for things such as global window and more. https://github.com/jsdom/jsdom
  testEnvironment: "jsdom",
  // transpilation for jest since we use typescript
  // transform files copied from here: https://github.com/facebook/create-react-app/tree/main/packages/react-scripts/config/jest
  transform: {
    // use babelTransform.js for all (js|jsx|mjs|cjs|ts|tsx) files to transform to browser-compatible-js
    "^.+\\.(js|jsx|mjs|cjs|ts|tsx)$": "<rootDir>/../jest/babelTransform.js",
    // transform our css with cssTransform.js to empty css since css is not necessary to test
    "^.+\\.css$": "<rootDir>/../jest/cssTransform.js",
    // Importing images is a way to include them in your browser bundle, but they are not valid JavaScript.
    // One way of handling it in Jest is to replace the imported value with its filename.
    "^(?!.*\\.(js|jsx|mjs|cjs|ts|tsx|css|json)$)":
      "<rootDir>/../jest/fileTransform.js",
  },
  transformIgnorePatterns: [
    // ignore (css|sass|scss) files
    "^.+\\.module\\.(css|sass|scss)$",
    // There is an issue with glide data grid in combination with jest.
    // The commonJS distribution is apparently not used by jest causing an error.
    // This can be fixed by adding it to transformIgnorePatterns
    "/node_modules/(?!glideapps)/.+\\.js$",
  ],
  modulePaths: [],
  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/src/$1",
  },
  reporters: ["default", "jest-github-actions-reporter"],
  moduleFileExtensions: [
    "web.js",
    "js",
    "web.ts",
    "ts",
    "web.tsx",
    "tsx",
    "json",
    "web.jsx",
    "jsx",
    "node",
  ],
  watchPlugins: [
    "jest-watch-typeahead/filename",
    "jest-watch-typeahead/testname",
  ],
  resetMocks: false,
  coverageReporters: ["text", "html"],
  // enzyme snapshot testing
  snapshotSerializers: ["enzyme-to-json/serializer"],
}
