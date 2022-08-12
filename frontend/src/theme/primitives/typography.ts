export const fonts: { [key: string]: string } = {
  sansSerif: '"Source Sans Pro", sans-serif',
  monospace: '"Source Code Pro", monospace',
  serif: '"Source Serif Pro", serif',
}

export const genericFonts = {
  bodyFont: fonts.sansSerif,
  codeFont: fonts.monospace,
  headingFont: fonts.sansSerif,
}

// Same as in variables.scss
const fontSizeTwoSmall = 12
const fontSizeSmall = 14

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
}

export const fontWeights = {
  normal: 400,
  bold: 600,
  extrabold: 700, // Use sparingly! Only h1 for now.
}

export const lineHeights = {
  normal: "normal",
  none: 1,
  tight: 1.25,
  table: 1.5,
  base: 1.6,
  menuItem: 2,
}

export const letterSpacings = {
  tighter: "-0.05em",
  tight: "-0.025em",
  normal: "0",
  wide: "0.025em",
  wider: "0.05em",
  widest: "0.1em",
}
