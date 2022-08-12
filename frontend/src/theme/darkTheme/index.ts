import baseTheme from "../baseTheme"
import genericColors from "./themeColors"
import { createEmotionColors } from "../utils"

export default {
  ...baseTheme,
  inSidebar: false,
  genericColors: {
    ...baseTheme.genericColors,
    ...genericColors,
  },
  colors: createEmotionColors({
    ...baseTheme.colors,
    ...genericColors,
  }),
}
