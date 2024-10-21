/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
  sansSerif: '"Source Sans Pro", sans-serif',
  monospace: '"Source Code Pro", monospace',
  serif: '"Source Serif Pro", serif',
  materialIcons: "Material Symbols Rounded",
}

export const genericFonts = {
  bodyFont: fonts.sansSerif,
  codeFont: fonts.monospace,
  headingFont: fonts.sansSerif,
  iconFont: fonts.materialIcons,
}

// Same as in variables.scss
const fontSizeTwoSmall = 12
const fontSizeSmall = 14
const fontSizeMedium = 16

export const fontSizes = {
  twoSm: `${fontSizeTwoSmall}px`, // Use px to force sm to be a round number.
  sm: `${fontSizeSmall}px`, // Use px to force sm to be a round number.
  md: "1rem",
  mdLg: "1.125rem",
  lg: "1.25rem",
  xl: "1.5rem",
  twoXL: "1.75rem",
  threeXL: "2.25rem",
  fourXL: "2.75rem",

  twoSmPx: fontSizeTwoSmall, // twoSm but as a number, in pixels
  smPx: fontSizeSmall, // sm but as a number, in pixels
  mdPx: fontSizeMedium, // med but as a number, in pixels
}

export const fontWeights = {
  normal: 400,
  bold: 600,
  extrabold: 700, // Use sparingly! Only h1 for now.
}

export const lineHeights = {
  none: 1,
  tight: 1.25,
  inputWidget: 1.4,
  small: 1.5,
  base: 1.6,
  menuItem: 2,
}
