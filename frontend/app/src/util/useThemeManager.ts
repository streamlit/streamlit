/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
  createAutoTheme,
  createPresetThemes,
  createTheme,
  CUSTOM_THEME_NAME,
  getDefaultTheme,
  getHostSpecifiedTheme,
  isPresetTheme,
  removeCachedTheme,
  setCachedTheme,
  ThemeConfig,
} from "@streamlit/lib"
import { CustomThemeConfig, ICustomThemeConfig } from "@streamlit/protobuf"

export type FontSources = Record<string, string>
export interface ThemeManager {
  activeTheme: ThemeConfig
  availableThemes: ThemeConfig[]
  setTheme: (theme: ThemeConfig) => void
  addThemes: (themes: ThemeConfig[]) => void
  setImportedTheme: (themeInfo: ICustomThemeConfig) => void
}

export function useThemeManager(): [
  ThemeManager,
  object[],
  FontSources | null,
] {
  const defaultTheme = getDefaultTheme()
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme)
  const [fontFaces, setFontFaces] = useState<object[]>(
    defaultTheme.themeInput?.fontFaces ?? []
  )
  const [fontSources, setFontSources] = useState<FontSources | null>(null)
  const [availableThemes, setAvailableThemes] = useState<ThemeConfig[]>(() => [
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
      updateTheme(getHostSpecifiedTheme())
    }
    const constantThemes = availableThemes.filter(
      currTheme => currTheme.name !== AUTO_THEME_NAME
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

      // Collect and process font sources from both main theme and sidebar theme
      const allFontSources = [
        ...(themeInfo.fontSources || []),
        ...(themeInfo.sidebar?.fontSources || []),
      ]

      const newFontSources: FontSources = {}
      allFontSources.forEach(fontSource => {
        // Should never be the case that configName or sourceUrl is undefined
        if (fontSource.sourceUrl && fontSource.configName) {
          newFontSources[fontSource.configName] = fontSource.sourceUrl
        }
      })

      // Set valid font sources if there are any
      setFontSources(
        Object.keys(newFontSources).length > 0 ? newFontSources : null
      )

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
      window.removeEventListener("afterprint", updateAutoTheme)
      mediaMatch.removeEventListener("change", updateAutoTheme)
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
    fontSources,
  ]
}
