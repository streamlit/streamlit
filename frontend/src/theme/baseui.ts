import {
  lightThemePrimitives as lightBaseThemePrimitives,
  darkThemePrimitives as darkBaseThemePrimitives,
} from "baseui"
import lightTheme from "./lightTheme"
import darkTheme from "./darkTheme"
import { createBaseUiTheme } from "./utils"

export const lightBaseUITheme = createBaseUiTheme(
  lightTheme,
  lightBaseThemePrimitives
)

export const darkBaseUITheme = createBaseUiTheme(
  darkTheme,
  darkBaseThemePrimitives
)

export type LightBaseUITheme = typeof lightBaseUITheme
