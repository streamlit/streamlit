// Including this polyfill type declaration prevents typescript checker from 
// parsing bokeh-mathjax-2.4.3 JS source file that has TS deems invalid (\u2118)
// https://mothereff.in/js-variables
declare const plugin;
export default plugin;
