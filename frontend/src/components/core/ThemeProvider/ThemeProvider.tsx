import React, { ReactElement, ReactNode } from "react"
import { ThemeProvider as BaseUIThemeProvider } from "baseui"
import { ThemeProvider as EmotionThemeProvider } from "emotion-theming"

import {
  Theme,
  mainBaseUITheme,
  MainBaseUITheme,
  SidebarBaseUITheme,
} from "theme"

export interface ThemeProviderProps {
  theme: Theme
  baseuiTheme?: MainBaseUITheme | SidebarBaseUITheme
  children: ReactNode
}

function ThemeProvider({
  theme,
  baseuiTheme,
  children,
}: ThemeProviderProps): ReactElement {
  return (
    <BaseUIThemeProvider theme={baseuiTheme || mainBaseUITheme}>
      <EmotionThemeProvider theme={theme}>{children}</EmotionThemeProvider>
    </BaseUIThemeProvider>
  )
}

export default ThemeProvider
