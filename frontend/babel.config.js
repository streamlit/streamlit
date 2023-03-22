console.log("Using custom babel file to preserve modules and other things!")
module.exports = {
  presets: [
    ['./scripts/babel-preset-dev-env.js'],
  ],
  plugins: ['@emotion'],
  ignore: ['./src/autogen/**', '**/*.test.ts', '**/*.test.tsx', '**/*.d.ts'],
}