// only for one part of the project
console.log("HELLO WORLD")
module.exports = {
  // i think we want to change this
  presets: [
    ['react-app', { flow: false, typescript: true, runtime: 'automatic', absoluteRuntime: false }],
    ['@babel/preset-env', {modules: false}],
  ],
  plugins: ['@emotion', 'tsconfig-paths-module-resolver'],
  ignore: ['./src/autogen/**', '**/*.test.ts', '**/*.test.tsx', '**/*.d.ts'],
};
