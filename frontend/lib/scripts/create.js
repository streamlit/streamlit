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

// this is copied from here: https://github.com/facebook/create-react-app/blob/main/packages/babel-preset-react-app/create.js

console.log("Using custom babel plugin. This is needed for glide data grid.")

module.exports = function (api, opts, env) {
  if (!opts) {
    opts = {}
  }

  var isEnvDevelopment = env === "development"
  var isEnvProduction = env === "production"
  var isEnvTest = env === "test"

  var isTypeScriptEnabled = true

  if (!isEnvDevelopment && !isEnvProduction && !isEnvTest) {
    throw new Error(
      "Using this script requires that you specify `NODE_ENV` or " +
        '`BABEL_ENV` environment variables. Valid values are "development", ' +
        '"test", and "production". Instead, received: ' +
        JSON.stringify(env) +
        "."
    )
  }

  return {
    presets: [
      isEnvTest && [
        // ES features necessary for user's Node version
        require("@babel/preset-env").default,
        {
          targets: {
            node: "current",
          },
        },
      ],
      (isEnvProduction || isEnvDevelopment) && [
        // Latest stable ECMAScript features
        require("@babel/preset-env").default,
        {
          // ensure ES6 is supported
          modules: false,
          // Allow importing core-js in entrypoint and use browserlist to select polyfills
          useBuiltIns: "entry",
          // Set the corejs version we are using to avoid warnings in console
          corejs: 3,
          // Exclude transforms that make all code slower
          exclude: ["transform-typeof-symbol", "proposal-dynamic-import"],
        },
      ],
      [
        require("@babel/preset-react").default,
        {
          // Will use the native built-in instead of trying to polyfill
          // behavior for any plugins that require one.
          ...{ useBuiltIns: true },
          runtime: "automatic",
        },
      ],
      isTypeScriptEnabled && [require("@babel/preset-typescript").default],
    ].filter(Boolean),
    plugins: [
      // Experimental macros support. Will be documented after it's had some time
      // in the wild.
      require("babel-plugin-macros"),
      // Turn on legacy decorators for TypeScript files
      isTypeScriptEnabled && [
        require("@babel/plugin-proposal-decorators").default,
        false,
      ],
      // class { handleClick = () => { } }
      // Enable loose mode to use assignment instead of defineProperty
      // See discussion in https://github.com/facebook/create-react-app/issues/4263
      // Note:
      // 'loose' mode configuration must be the same for
      // * @babel/plugin-proposal-class-properties
      // * @babel/plugin-proposal-private-methods
      // * @babel/plugin-proposal-private-property-in-object
      // (when they are enabled)
      [
        require("@babel/plugin-proposal-class-properties").default,
        {
          loose: true,
        },
      ],
      [
        require("@babel/plugin-proposal-private-methods").default,
        {
          loose: true,
        },
      ],
      [
        require("@babel/plugin-proposal-private-property-in-object").default,
        {
          loose: true,
        },
      ],
      isEnvProduction && [
        // Remove PropTypes from production build
        require("babel-plugin-transform-react-remove-prop-types").default,
        {
          removeImport: true,
        },
      ],
    ].filter(Boolean),
    overrides: [
      isTypeScriptEnabled && {
        test: /\.tsx?$/,
        plugins: [
          [
            require("@babel/plugin-proposal-decorators").default,
            { legacy: true },
          ],
        ],
      },
    ].filter(Boolean),
  }
}
