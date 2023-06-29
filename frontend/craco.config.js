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
const CircularDependencyPlugin = require("circular-dependency-plugin")

module.exports = {
  devServer: {
    static: {
      watch: {
        ignored: [/node_modules/, "*.test.{ts,tsx}", /cypress/],
      },
    },
  },
  jest: {
    configure: jestConfig => {
      jestConfig.setupFiles = ["jest-canvas-mock"]

      // There is an issue with glide data grid in combination with jest.
      // The commonJS distribution is apparently not used by jest causing an error.
      // This can be fixed by adding it to transformIgnorePatterns
      jestConfig.transformIgnorePatterns = [
        "/node_modules/(?!glideapps)/.+\\.js$",
      ]
      if ("GITHUB_ACTION" in process.env) {
        jestConfig.reporters = ["default", "jest-github-actions-reporter"]
      }
      return jestConfig
    },
  },
  babel: {
    plugins: ["@emotion"],
    loaderOptions: {
      cacheDirectory: true,
    },
  },
  webpack: {
    configure: webpackConfig => {
      webpackConfig.resolve.mainFields = ["module", "main"]
      // Webpack 5 requires polyfills. We don't need them, so resolve to an empty module
      webpackConfig.resolve.fallback ||= {}
      webpackConfig.resolve.fallback.tty = false
      webpackConfig.resolve.fallback.os = false

      // Apache Arrow uses .mjs
      webpackConfig.module.rules.push({
        include: /node_modules/,
        test: /\.mjs$/,
        type: "javascript/auto",
      })

      // find terser plugin
      const minimizerPlugins = webpackConfig.optimization.minimizer
      const terserPluginIndex = minimizerPlugins.findIndex(
        item => item.constructor.name === "TerserPlugin"
      )

      if (process.env.BUILD_AS_FAST_AS_POSSIBLE) {
        // remove terser
        minimizerPlugins.splice(terserPluginIndex, 1)

        // skip type checking and linting
        const pluginsToRemove = [
          "ForkTsCheckerWebpackPlugin",
          "ESLintWebpackPlugin",
        ]
        webpackConfig.plugins = webpackConfig.plugins.filter(
          plugin => !pluginsToRemove.includes(plugin.constructor.name)
        )

        // turn off sourcemaps
        webpackConfig.devtool = "eval"
      } else {
        minimizerPlugins[terserPluginIndex].options.parallel = true
      }

      // detect circular dependency plugins as these can cause runtime errors
      // no circular dependencies also mean better jest test runtimes, code organization, and better code splitting
      webpackConfig.plugins.push(
        new CircularDependencyPlugin({
          // exclude detection of files based on a RegExp
          exclude: /node_modules/,
          // add errors to webpack compiltion instead of warnings
          failOnError: true,
          // allow import cycles that include an asyncronous import,
          // e.g. via import(/* webpackMode: "weak" */ './file.js')
          allowAsyncCycles: false,
        })
      )

      return webpackConfig
    },
  },
}
