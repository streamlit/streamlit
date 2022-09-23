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

const HardSourceWebpackPlugin = require("hard-source-webpack-plugin")

module.exports = {
  devServer: {
    headers: {
      // This allows static files request other static files in development mode.
      "Access-Control-Allow-Origin": "*",
    },
    watchOptions: {
      ignored: [/node_modules/, "*.test.{ts,tsx}", /cypress/],
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

      // Apache Arrow uses .mjs
      webpackConfig.module.rules.push({
        include: /node_modules/,
        test: /\.mjs$/,
        type: "javascript/auto",
      })

      // find terser plugin
      const minimizerPlugins = webpackConfig.optimization.minimizer
      const terserPluginIndex = minimizerPlugins.findIndex(
        item => item.options.terserOptions
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
        const parallel = process.env.CIRCLECI ? false : true
        minimizerPlugins[terserPluginIndex].options.parallel = parallel

        // HardSourceWebpackPlugin adds aggressive build caching.
        // More info: https://github.com/mzgoddard/hard-source-webpack-plugin
        //
        // This speeds up builds for local development.  Empirically, however, it
        // seems to slow down one-time production builds, so we are making it
        // possible to turn it off via setting BUILD_AS_FAST_AS_POSSIBLE=1.  This
        // is useful in CircleCI, when doing releases, etc.
        webpackConfig.plugins.unshift(new HardSourceWebpackPlugin())
      }

      return webpackConfig
    },
  },
}
