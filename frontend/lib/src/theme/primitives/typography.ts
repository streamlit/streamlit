/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export const fonts: { [key: string]: string } = {
  sansSerif: '"Source Sans", sans-serif',
  monospace: '"Source Code Pro", monospace',
  serif: '"Source Serif", serif',
  materialIcons: "Material Symbols Rounded",
}

export const genericFonts = {
  bodyFont: fonts.sansSerif,
  codeFont: fonts.monospace,
  headingFont: fonts.sansSerif,
  iconFont: fonts.materialIcons,
}

export const fontSizes = {
  // baseFontSize equals to md, but in pixels (this value can also be configured by the user)
  // The baseFontSize should only be used in global styles.
  baseFontSize: 16,
  twoSm: "0.75rem",
  sm: "0.875rem",
  md: "1rem",
  mdLg: "1.125rem",
  lg: "1.25rem",
  xl: "1.5rem",
  twoXL: "1.75rem",
  threeXL: "2.25rem",
  fourXL: "2.75rem",
  codeFontSize: "0.875rem",
  // Inline code font size as em value for proper scaling w/ headers, captions,
  // sidebar, etc.
  inlineCodeFontSize: "0.75em",

  // Header font sizes - unaffected by baseFontSize, configured via headingFontSizes
  h1FontSize: "2.75rem",
  h2FontSize: "2.25rem",
  h3FontSize: "1.75rem",
  h4FontSize: "1.5rem",
  h5FontSize: "1.25rem",
  h6FontSize: "1rem",
}

export const fontWeights = {
  normal: 400,
  semiBold: 500,
  bold: 600,
  extrabold: 700,
  // codeFontWeight separately configurable
  code: 400,
  codeBold: 600,
  codeExtraBold: 700,
  // baseFontWeight config does not affect headers
  // defaults set here for h1-h6
  h1FontWeight: 700,
  h2FontWeight: 600,
  h3FontWeight: 600,
  h4FontWeight: 600,
  h5FontWeight: 600,
  h6FontWeight: 600,
}

export const lineHeights = {
  none: 1,
  headings: 1.2,
  tight: 1.25,
  inputWidget: 1.4,
  small: 1.5,
  base: 1.6,
  menuItem: 2,
}
