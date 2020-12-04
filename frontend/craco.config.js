const webpack = require("webpack")
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
    configure: (webpackConfig, { env, paths }) => {
      webpackConfig.resolve.mainFields = ["main", "module"]

      // HardSourceWebpackPlugin adds aggressive build caching
      // to speed up our slow builds.
      // https://github.com/mzgoddard/hard-source-webpack-plugin
      webpackConfig.plugins.unshift(new HardSourceWebpackPlugin())

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
    plugins: [
      // Hide critical dependency warnings from Webpack, as CircleCI treats them as errors.
      // https://medium.com/tomincode/hiding-critical-dependency-warnings-from-webpack-c76ccdb1f6c1
      // Remove after updating bokehjs to 2.0.0
      // https://github.com/bokeh/bokeh/issues/9594#issuecomment-577227353
      new webpack.ContextReplacementPlugin(/\/bokehjs\//, data => {
        for (let i in data.dependencies) {
          delete data.dependencies[i].critical
        }
        return data
      }),
    ],
  },
}
