console.log("Using custom babel file!")
module.exports = {
  presets: [
    ['./scripts/babel-preset-dev-env.js'],
  ],
  plugins: ['@emotion', 'tsconfig-paths-module-resolver'],
  ignore: ['./src/autogen/**', '**/*.test.ts', '**/*.test.tsx', '**/*.d.ts'],
}
