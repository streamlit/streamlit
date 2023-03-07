// https://stackoverflow.com/questions/57127606/ts2307-cannot-find-module-images-logo-png
declare module "*.png" {
  const value: string;
  export default value;
}