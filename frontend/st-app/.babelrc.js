console.log("Using custom babel file!")
module.exports = {
  presets: [
    ['react-app', { flow: false, typescript: true, runtime: 'automatic', absoluteRuntime: false }],
  ],
  plugins: ['@emotion', 'tsconfig-paths-module-resolver'],
  ignore: ['./src/autogen/**', '**/*.test.ts', '**/*.test.tsx', '**/*.d.ts'],
}
