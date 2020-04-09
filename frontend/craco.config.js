const webpack = require("webpack")
const HardSourceWebpackPlugin = require("hard-source-webpack-plugin")

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      webpackConfig.resolve.mainFields = ["main", "module"]

      // HardSourceWebpackPlugin adds aggressive build caching
      // to speed up our slow builds.
      // https://github.com/mzgoddard/hard-source-webpack-plugin
      webpackConfig.plugins.unshift(new HardSourceWebpackPlugin())

      return webpackConfig
    },
    plugins: [
      // Hide critical dependency warnings from Webpack, as CircleCI treats them as errors.
      // https://medium.com/tomincode/hiding-critical-dependency-warnings-from-webpack-c76ccdb1f6c1
      // Remove after updating bokehjs to 2.0.0
      // https://github.com/bokeh/bokeh/issues/9594#issuecomment-577227353
      new webpack.ContextReplacementPlugin(/\/bokehjs\//, data => {
        for (var i in data.dependencies) {
          delete data.dependencies[i].critical
        }
        return data
      }),
    ],
  },
  jest: {
    configure: jestConfig => {
      jestConfig.setupFiles = ["jest-canvas-mock"]

      return jestConfig
    },
  },
}
