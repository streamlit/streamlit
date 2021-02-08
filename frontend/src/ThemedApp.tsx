import React from "react"
import { BaseProvider } from "baseui"
import { Global } from "@emotion/core"
import ThemeProvider from "components/core/ThemeProvider"
import { LocalStore } from "lib/storageUtils"
import {
  AUTO_THEME,
  ThemeConfig,
  getDefaultTheme,
  getSystemTheme,
  globalStyles,
  lightTheme,
  darkTheme,
} from "theme"
import AppWithScreencast from "./App"

const autoTheme = {
  ...getSystemTheme(),
  name: AUTO_THEME,
}

const presetThemes = [autoTheme, lightTheme, darkTheme]

const ThemedApp = (): JSX.Element => {
  const [theme, setTheme] = React.useState<ThemeConfig>(getDefaultTheme())
  const [availableThemes, setAvailableThemes] = React.useState<ThemeConfig[]>(
    presetThemes
  )

  const addThemes = (themeConfigs: ThemeConfig[]): void => {
    setAvailableThemes([...presetThemes, ...themeConfigs])
  }

  const updateTheme = (newTheme: ThemeConfig): void => {
    if (newTheme !== theme) {
      setTheme(newTheme)

      // Only save to localStorage if it is not Auto since auto is the default.
      // Important to not save since it can change depending on time of day.
      if (newTheme.name === AUTO_THEME) {
        window.localStorage.removeItem(LocalStore.ACTIVE_THEME)
      } else {
        window.localStorage.setItem(
          LocalStore.ACTIVE_THEME,
          JSON.stringify(newTheme)
        )
      }
    }
  }

  React.useEffect(() => {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        updateTheme(getSystemTheme())
      })
  }, [])

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
            addThemes,
            availableThemes,
          }}
        />
      </ThemeProvider>
    </BaseProvider>
  )
}

export default ThemedApp
