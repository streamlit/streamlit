/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { useCallback, useEffect, useState } from "react"
import {
  AUTO_THEME_NAME,
  CUSTOM_THEME_NAME,
  createAutoTheme,
  createPresetThemes,
  getDefaultTheme,
  isPresetTheme,
  removeCachedTheme,
  setCachedTheme,
  ThemeConfig,
  createTheme,
  CustomThemeConfig,
  ICustomThemeConfig,
} from "@streamlit/lib"

export interface ThemeManager {
  activeTheme: ThemeConfig
  availableThemes: ThemeConfig[]
  setTheme: (theme: ThemeConfig) => void
  addThemes: (themes: ThemeConfig[]) => void
  setImportedTheme: (themeInfo: ICustomThemeConfig) => void
}

export function useThemeManager(): [ThemeManager, object[]] {
  const defaultTheme = getDefaultTheme()
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme)
  const [fontFaces, setFontFaces] = useState<object[]>([])
  const [availableThemes, setAvailableThemes] = useState<ThemeConfig[]>([
    ...createPresetThemes(),
    ...(isPresetTheme(defaultTheme) ? [] : [defaultTheme]),
  ])

  const addThemes = (themeConfigs: ThemeConfig[]): void => {
    setAvailableThemes([...createPresetThemes(), ...themeConfigs])
  }

  const updateTheme = useCallback(
    (newTheme: ThemeConfig): void => {
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
    },
    [setTheme, theme]
  )

  const updateAutoTheme = useCallback((): void => {
    if (theme.name === AUTO_THEME_NAME) {
      updateTheme(createAutoTheme())
    }
    const constantThemes = availableThemes.filter(
      theme => theme.name !== AUTO_THEME_NAME
    )
    setAvailableThemes([createAutoTheme(), ...constantThemes])
  }, [theme.name, availableThemes, updateTheme])

  const setImportedTheme = useCallback(
    (themeInfo: ICustomThemeConfig): void => {
      // If fonts are coming from a URL, they need to be imported through the FontFaceDeclaration
      // component. So let's store them in state so we can pass them as props.
      if (themeInfo.fontFaces) {
        setFontFaces(themeInfo.fontFaces as object[])
      }

      const themeConfigProto = new CustomThemeConfig(themeInfo)
      const customTheme = createTheme(CUSTOM_THEME_NAME, themeConfigProto)
      updateTheme(customTheme)
    },
    [setFontFaces, updateTheme]
  )

  useEffect(() => {
    const mediaMatch = window.matchMedia("(prefers-color-scheme: dark)")
    mediaMatch.addEventListener("change", updateAutoTheme)
    // Browsers do not revert back to a dark theme after printing, so we
    // should check and update the theme after printing if necessary.
    window.addEventListener("afterprint", updateAutoTheme)
    return () => {
      mediaMatch.removeEventListener("change", updateAutoTheme)
      window.removeEventListener("afterprint", updateAutoTheme)
    }
  }, [theme, availableThemes, updateAutoTheme])

  return [
    {
      setTheme: updateTheme,
      activeTheme: theme,
      addThemes,
      availableThemes,
      setImportedTheme,
    },
    fontFaces,
  ]
}
