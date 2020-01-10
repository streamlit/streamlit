const HardSourceWebpackPlugin = require("hard-source-webpack-plugin")

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      webpackConfig.resolve.mainFields = ["main", "module"]

      // HardSourceWebpackPlugin adds aggressive build caching
      // to speed up our slow builds.
      // https://github.com/mzgoddard/hard-source-webpack-plugin
      webpackConfig.plugins.unshift(new HardSourceWebpackPlugin())

      // Add support for .mjs as Apache Arrow library is using it
      webpackConfig.module.rules.push({
        include: /node_modules/,
        test: /\.mjs$/,
        type: "javascript/auto",
      })

      return webpackConfig
    },
  },
}
