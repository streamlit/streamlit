import main from "./mainTheme"

export type Theme = typeof main
type IconSizes = typeof main.iconSizes
type ThemeSpacings = typeof main.spacing
type ThemeColors = typeof main.colors

export type IconSize = keyof IconSizes
export type ThemeColor = keyof ThemeColors
export type ThemeSpacing = keyof ThemeSpacings
