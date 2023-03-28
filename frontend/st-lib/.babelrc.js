console.log("Using st-lib custom babel file to preserve modules")
module.exports = {
  presets: [
    ['./scripts/babel-preset-dev-env.js'],
  ],
  plugins: ['@emotion'],
  ignore: ['./src/autogen/**', '**/*.test.ts', '**/*.test.tsx', '**/*.d.ts'],
  env: { test: { "plugins": ["@babel/plugin-transform-modules-commonjs"] } }
}