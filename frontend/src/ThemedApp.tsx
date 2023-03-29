/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { BaseProvider } from "baseui"
import { Global } from "@emotion/react"

import { CustomThemeConfig, ICustomThemeConfig } from "src/autogen/proto"

import FontFaceDeclaration from "src/components/core/FontFaceDeclaration"
import ThemeProvider from "src/components/core/ThemeProvider"
import {
  AUTO_THEME_NAME,
  CUSTOM_THEME_NAME,
  createAutoTheme,
  createPresetThemes,
  getDefaultTheme,
  globalStyles,
  isPresetTheme,
  removeCachedTheme,
  setCachedTheme,
  ThemeConfig,
  createTheme,
} from "src/theme"

import AppWithScreencast from "./App"
import { StyledDataFrameOverlay } from "./styled-components"

const ThemedApp = (): JSX.Element => {
  const defaultTheme = getDefaultTheme()

  const [theme, setTheme] = React.useState<ThemeConfig>(defaultTheme)
  const [fontFaces, setFontFaces] = React.useState<object[] | undefined>()
  const [availableThemes, setAvailableThemes] = React.useState<ThemeConfig[]>([
    ...createPresetThemes(),
    ...(isPresetTheme(defaultTheme) ? [] : [defaultTheme]),
  ])

  const addThemes = (themeConfigs: ThemeConfig[]): void => {
    setAvailableThemes([...createPresetThemes(), ...themeConfigs])
  }

  const updateTheme = (newTheme: ThemeConfig): void => {
    if (newTheme !== theme) {
      setTheme(newTheme)

      // Only save to localStorage if it is not Auto since auto is the default.
      // Important to not save since it can change depending on time of day.
      if (newTheme.name === AUTO_THEME_NAME) {
        removeCachedTheme()
      } else {
        setCachedTheme(newTheme)
      }
    }
  }

  const updateAutoTheme = (): void => {
    if (theme.name === AUTO_THEME_NAME) {
      updateTheme(createAutoTheme())
    }
    const constantThemes = availableThemes.filter(
      theme => theme.name !== AUTO_THEME_NAME
    )
    setAvailableThemes([createAutoTheme(), ...constantThemes])
  }

  const setImportedTheme = (themeConfigObj: ICustomThemeConfig): void => {
    // If fonts are coming from a URL, they need to be imported through the FontFaceDeclaration
    // component. So let's store them in state so we can pass them as props.
    if (themeConfigObj.fontFaces) {
      setFontFaces(themeConfigObj.fontFaces as object[] | undefined)
    }

    const themeConfigProto = new CustomThemeConfig(themeConfigObj)
    const customTheme = createTheme(CUSTOM_THEME_NAME, themeConfigProto)
    updateTheme(customTheme)
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
        <Global styles={globalStyles} />
        {theme.name === CUSTOM_THEME_NAME && fontFaces && (
          <FontFaceDeclaration fontFaces={fontFaces} />
        )}
        <AppWithScreencast
          theme={{
            setTheme: updateTheme,
            activeTheme: theme,
            addThemes,
            availableThemes,
            setImportedTheme,
          }}
        />
        {/* The data grid requires one root level portal element for rendering cell overlays */}
        <StyledDataFrameOverlay id="portal" />
      </ThemeProvider>
    </BaseProvider>
  )
}

export default ThemedApp
