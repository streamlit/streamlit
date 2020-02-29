const HardSourceWebpackPlugin = require("hard-source-webpack-plugin")

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      webpackConfig.resolve.mainFields = ["main", "module"]

      // HardSourceWebpackPlugin adds aggressive build caching
      // to speed up our slow builds.
      // https://github.com/mzgoddard/hard-source-webpack-plugin
      // TODO permanently disable this on circleci builds?
      // TODO try with it enabled after memory issues are resolved
      // webpackConfig.plugins.unshift(new HardSourceWebpackPlugin())

      return webpackConfig
    },
  },
}
