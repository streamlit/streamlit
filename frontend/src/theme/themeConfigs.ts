import {
  LightTheme,
  DarkTheme,
  lightThemePrimitives,
  darkThemePrimitives,
} from "baseui"
import { lightBaseUITheme, darkBaseUITheme } from "./baseui"
import base from "./baseTheme"
import light from "./lightTheme"
import dark from "./darkTheme"
import { ThemeConfig } from "./types"
import { AUTO_THEME_NAME, getSystemTheme } from "./utils"

export const baseTheme: ThemeConfig = {
  name: "base",
  emotion: base,
  baseweb: LightTheme,
  basewebTheme: lightBaseUITheme,
  primitives: lightThemePrimitives,
}

export const darkTheme: ThemeConfig = {
  name: "Dark",
  emotion: dark,
  baseweb: DarkTheme,
  basewebTheme: darkBaseUITheme,
  primitives: darkThemePrimitives,
}

export const lightTheme: ThemeConfig = {
  name: "Light",
  emotion: light,
  baseweb: LightTheme,
  basewebTheme: lightBaseUITheme,
  primitives: lightThemePrimitives,
}

export const createAutoTheme = (): ThemeConfig => ({
  ...getSystemTheme(),
  name: AUTO_THEME_NAME,
})

// Update auto theme in case it has changed
export const createPresetThemes = (): ThemeConfig[] => [
  createAutoTheme(),
  lightTheme,
  darkTheme,
]
