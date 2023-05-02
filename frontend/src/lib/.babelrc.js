module.exports = {
  presets: [
    [
      // Latest stable ECMAScript features
      require("@babel/preset-env").default,
      {
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
    [require("@babel/preset-typescript").default],
  ],
  plugins: [
    "@emotion",
    // Experimental macros support. Will be documented after it's had some time
    // in the wild.
    require("babel-plugin-macros"),
    // Turn on legacy decorators for TypeScript files
    [require("@babel/plugin-proposal-decorators").default, false],
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
    [
      // Remove PropTypes from production build
      require("babel-plugin-transform-react-remove-prop-types").default,
      {
        removeImport: true,
      },
    ],
    [
      require.resolve("babel-plugin-module-resolver"),
      {
        root: ["."],
        alias: {
          "src/lib": "./",
        },
        cwd: "babelrc",
      },
    ],
  ],
  overrides: [
    {
      test: /\.tsx?$/,
      plugins: [
        [
          require("@babel/plugin-proposal-decorators").default,
          { legacy: true },
        ],
      ],
    },
  ],
}
