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
  },
  webpack: {
    configure: webpackConfig => {
      webpackConfig.resolve.mainFields = ["main", "module"]

      // hardsource appears to make React app server start more slowly in our
      // end-to-end tests, so adding an environment variable to disable it
      if (!process.env.DISABLE_HARDSOURCE_CACHING) {
        // HardSourceWebpackPlugin adds aggressive build caching
        // to speed up our slow builds.
        // https://github.com/mzgoddard/hard-source-webpack-plugin
        webpackConfig.plugins.unshift(new HardSourceWebpackPlugin())
      }

      const minimizerIndex = webpackConfig.optimization.minimizer.findIndex(
        item => item.options.terserOptions
      )

      // ⚠️ If you use Circle CI or any other environment that doesn't
      // provide real available count of CPUs then you need to setup
      // explicitly number of CPUs to avoid Error: Call retries were exceeded
      // Ran into issues setting number of CPUs so disabling parallel in the
      // meantime. Issue #1720 created to optimize this.
      const runParallel = process.env.CIRCLECI ? false : true
      webpackConfig.optimization.minimizer[
        minimizerIndex
      ].options.parallel = runParallel

      return webpackConfig
    },
  },
}
