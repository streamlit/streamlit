import React, { ReactElement, ReactNode } from "react"
import { ThemeProvider as BaseUIThemeProvider } from "baseui"
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react"

import { Theme, lightBaseUITheme, LightBaseUITheme } from "src/theme"

export interface ThemeProviderProps {
  theme: Theme
  baseuiTheme?: LightBaseUITheme
  children: ReactNode
}

function ThemeProvider({
  theme,
  baseuiTheme,
  children,
}: ThemeProviderProps): ReactElement {
  return (
    <BaseUIThemeProvider theme={baseuiTheme || lightBaseUITheme}>
      <EmotionThemeProvider theme={theme}>{children}</EmotionThemeProvider>
    </BaseUIThemeProvider>
  )
}

export default ThemeProvider
