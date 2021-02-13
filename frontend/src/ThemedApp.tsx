import React from "react"
import { BaseProvider } from "baseui"
import { Global } from "@emotion/core"
import ThemeProvider from "components/core/ThemeProvider"
import { LocalStore } from "lib/storageUtils"
import {
  AUTO_THEME,
  ThemeConfig,
  getDefaultTheme,
  globalStyles,
  lightTheme,
  darkTheme,
  createAutoTheme,
  createPresetThemes,
} from "theme"
import AppWithScreencast from "./App"

const ThemedApp = (): JSX.Element => {
  const [theme, setTheme] = React.useState<ThemeConfig>(getDefaultTheme())
  const [availableThemes, setAvailableThemes] = React.useState<ThemeConfig[]>(
    createPresetThemes()
  )

  const addThemes = (themeConfigs: ThemeConfig[]): void => {
    setAvailableThemes([...createPresetThemes(), ...themeConfigs])
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

  const updateAutoTheme = (): void => {
    if (theme.name === AUTO_THEME) {
      updateTheme(createAutoTheme())
    }
    const constantThemes = availableThemes.filter(
      theme => theme.name !== AUTO_THEME
    )
    setAvailableThemes([createAutoTheme(), ...constantThemes])
  }

  React.useEffect(() => {
    const mediaMatch = window.matchMedia("(prefers-color-scheme: dark)")
    mediaMatch.addEventListener("change", updateAutoTheme)

    return () => mediaMatch.removeEventListener("change", updateAutoTheme)
  }, [theme, availableThemes])

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
