/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { useCallback, useEffect, useRef, useState } from "react"

import {
  AUTO_THEME_NAME,
  createAutoTheme,
  createPresetThemes,
  createTheme,
  CUSTOM_THEME_AUTO_NAME,
  CUSTOM_THEME_DARK_NAME,
  CUSTOM_THEME_LIGHT_NAME,
  CUSTOM_THEME_NAME,
  getDefaultTheme,
  getHostSpecifiedTheme,
  getSystemThemePreference,
  isPresetTheme,
  setCachedThemeSelection,
  ThemeConfig,
} from "@streamlit/lib"
import { CustomThemeConfig, ICustomThemeConfig } from "@streamlit/protobuf"

export type FontSources = Record<string, string>

/**
 * Returns the custom theme matching the current system preference (light/dark).
 * Used to resolve "Custom Theme Auto" to the appropriate underlying theme.
 */
const getSystemCustomTheme = (
  themes: ThemeConfig[]
): ThemeConfig | undefined =>
  themes.find(
    currTheme =>
      currTheme.name ===
      (getSystemThemePreference() === "dark"
        ? CUSTOM_THEME_DARK_NAME
        : CUSTOM_THEME_LIGHT_NAME)
  )

/**
 * Creates an auto-switching custom theme from a base theme.
 * The returned theme will have CUSTOM_THEME_AUTO_NAME but display as "Use system setting".
 */
const createAutoCustomTheme = (baseTheme: ThemeConfig): ThemeConfig => ({
  ...baseTheme,
  name: CUSTOM_THEME_AUTO_NAME,
  displayName: AUTO_THEME_NAME,
})

export interface ThemeManager {
  activeTheme: ThemeConfig
  availableThemes: ThemeConfig[]
  setTheme: (theme: ThemeConfig) => void
  addThemes: (
    themes: ThemeConfig[],
    options?: { keepPresetThemes?: boolean }
  ) => void
  setFonts: (themeInfo: ICustomThemeConfig) => void
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
  // Keep updateTheme referentially stable while still reading the latest themes.
  const availableThemesRef = useRef<ThemeConfig[]>(availableThemes)

  useEffect(() => {
    availableThemesRef.current = availableThemes
  }, [availableThemes])

  const addThemes = useCallback(
    (
      themeConfigs: ThemeConfig[],
      options: { keepPresetThemes?: boolean } = {}
    ): void => {
      // keepPresetThemes is false when adding custom themes
      // so that user cannot revert to a preset theme, true by default.
      const { keepPresetThemes = true } = options
      const updatedThemes = [
        ...(keepPresetThemes ? createPresetThemes() : []),
        ...themeConfigs,
      ]
      availableThemesRef.current = updatedThemes
      setAvailableThemes(updatedThemes)
    },
    []
  )

  const applyTheme = useCallback(
    (newTheme: ThemeConfig, options: { persist?: boolean } = {}): void => {
      const { persist = true } = options
      setTheme(prevTheme => {
        if (newTheme !== prevTheme) {
          if (persist) {
            setCachedThemeSelection(newTheme)
          }
          return newTheme
        }
        return prevTheme
      })
    },
    []
  )

  const updateTheme = useCallback(
    (newTheme: ThemeConfig): void => {
      if (newTheme.name === AUTO_THEME_NAME) {
        applyTheme(getHostSpecifiedTheme())
        return
      }

      if (newTheme.name === CUSTOM_THEME_AUTO_NAME) {
        const systemCustomTheme = getSystemCustomTheme(
          availableThemesRef.current
        )
        if (systemCustomTheme) {
          applyTheme(createAutoCustomTheme(systemCustomTheme))
          return
        }
      }

      applyTheme(newTheme)
    },
    [applyTheme]
  )

  const updateAutoTheme = useCallback((): void => {
    const systemTheme = getHostSpecifiedTheme()
    if (theme.name === AUTO_THEME_NAME) {
      applyTheme(systemTheme, { persist: false })
    }

    const constantThemes = availableThemes.filter(
      currTheme => currTheme.name !== AUTO_THEME_NAME
    )
    const hasCustomAutoTheme = constantThemes.some(
      currTheme => currTheme.name === CUSTOM_THEME_AUTO_NAME
    )

    if (hasCustomAutoTheme && theme.name === CUSTOM_THEME_AUTO_NAME) {
      const systemCustomTheme = getSystemCustomTheme(constantThemes)
      if (systemCustomTheme) {
        applyTheme(createAutoCustomTheme(systemCustomTheme), {
          persist: false,
        })
      }
    }

    setAvailableThemes(
      hasCustomAutoTheme
        ? constantThemes
        : [createAutoTheme(), ...constantThemes]
    )
  }, [theme.name, availableThemes, applyTheme])

  const setFonts = useCallback((themeInfo: ICustomThemeConfig): void => {
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
  }, [])

  const setImportedTheme = useCallback(
    (themeInfo: ICustomThemeConfig): void => {
      setFonts(themeInfo)

      const themeConfigProto = new CustomThemeConfig(themeInfo)
      const customTheme = createTheme(CUSTOM_THEME_NAME, themeConfigProto)
      updateTheme(customTheme)
    },
    [setFonts, updateTheme]
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
  }, [updateAutoTheme])

  return [
    {
      setTheme: updateTheme,
      activeTheme: theme,
      addThemes,
      availableThemes,
      setFonts,
      setImportedTheme,
    },
    fontFaces,
    fontSources,
  ]
}
