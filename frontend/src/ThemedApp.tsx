import React from "react"
import { BaseProvider } from "baseui"
import { Global } from "@emotion/core"
import ThemeProvider from "components/core/ThemeProvider"
import { LocalStore } from "lib/storageUtils"
import {
  ThemeConfig,
  getDefaultTheme,
  globalStyles,
  lightTheme,
  darkTheme,
} from "theme"
import AppWithScreencast from "./App"

const ThemedApp = (): JSX.Element => {
  const [theme, setTheme] = React.useState<ThemeConfig>(getDefaultTheme())
  const [availableThemes, setAvailableThemes] = React.useState<ThemeConfig[]>([
    lightTheme,
    darkTheme,
  ])

  const updateTheme = (newTheme: ThemeConfig): void => {
    if (newTheme !== theme) {
      setTheme(newTheme)
      window.localStorage.setItem(
        LocalStore.ACTIVE_THEME,
        JSON.stringify(newTheme)
      )
    }
  }

  return (
    <BaseProvider
      theme={theme.baseweb}
      zIndex={theme.emotion.zIndices.popupMenu}
    >
      <ThemeProvider theme={theme.emotion} baseuiTheme={theme.basewebTheme}>
        <Global styles={globalStyles} />)
        <AppWithScreencast
          theme={{
            setTheme: updateTheme,
            activeTheme: theme,
            setAvailableThemes,
            availableThemes,
          }}
        />
      </ThemeProvider>
    </BaseProvider>
  )
}

export default ThemedApp
