/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
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
  },
  jest: {
    configure: jestConfig => {
      jestConfig.setupFiles = ["jest-canvas-mock"]

      return jestConfig
    },
  },
  babel: {
    plugins: ["emotion"],
    loaderOptions: {
      cacheDirectory: true,
    },
  },
  webpack: {
    configure: webpackConfig => {
      webpackConfig.resolve.mainFields = ["main", "module"]

      // hardsource appears to make React app server start more slowly in our
      // end-to-end tests, as well as our production builds, so adding an
      // environment variable to disable it
      if (!process.env.BUILD_AS_FAST_AS_POSSIBLE) {
        // HardSourceWebpackPlugin adds aggressive build caching
        // to speed up our slow builds.
        // https://github.com/mzgoddard/hard-source-webpack-plugin
        webpackConfig.plugins.unshift(new HardSourceWebpackPlugin())
      }

      // handle terser plugin
      const minimizerPlugins = webpackConfig.optimization.minimizer
      const isTerserPlugin = item => item.options.terserOptions
      const terserPluginIndex = minimizerPlugins.findIndex(isTerserPlugin)

      if (process.env.BUILD_AS_FAST_AS_POSSIBLE) {
        // remove terser
        minimizerPlugins.splice(terserPluginIndex, 1)

        // When we're running E2E tests or building for PR preview, we can just
        // skip type checking and linting; these are handled in separate tests.
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
        const parallel = process.env.CIRCLECI ? 4 : true
        minimizerPlugins[terserPluginIndex].options.parallel = parallel
      }

      return webpackConfig
    },
  },
}
