import { LightTheme, lightThemePrimitives } from "baseui"

import { CustomThemeConfig } from "src/autogen/proto"

import base from "./baseTheme"
import { lightBaseUITheme } from "./baseui"

export type Theme = typeof base

export type ThemeConfig = {
  name: string
  emotion: Theme
  // For use with the BaseProvider that adds a LayersManager and ThemeProvider.
  // Unfortunately Theme is required.
  baseweb: typeof LightTheme
  // For use with Baseweb's ThemeProvider. This is required in order for us to
  // create separate themes for in the children. Currently required to accommodate
  // sidebar theming.
  basewebTheme: typeof lightBaseUITheme
  primitives: typeof lightThemePrimitives
}

export type CachedTheme = {
  name: string

  themeInput?: Partial<CustomThemeConfig>
}

type IconSizes = typeof base.iconSizes
type ThemeSpacings = typeof base.spacing
type ThemeColors = typeof base.colors

export type IconSize = keyof IconSizes
export type ThemeColor = Extract<keyof ThemeColors, string>
export type ThemeSpacing = keyof ThemeSpacings
