import {
  breakpoints,
  fonts,
  fontSizes,
  fontWeights,
  genericFonts,
  iconSizes,
  lineHeights,
  letterSpacings,
  radii,
  sizes,
  spacing,
  zIndices,
} from "../primitives"
import genericColors from "./themeColors"
import { createEmotionColors } from "../utils"

export default {
  inSidebar: false,
  breakpoints,
  colors: createEmotionColors(genericColors),
  genericColors,
  fonts,
  fontSizes,
  fontWeights,
  genericFonts,
  iconSizes,
  lineHeights,
  letterSpacings,
  radii,
  sizes,
  spacing,
  zIndices,
}
