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
  createPresetThemes,
  createTheme,
  CUSTOM_THEME_AUTO_NAME,
  CUSTOM_THEME_NAME,
  getDefaultTheme,
  getHostSpecifiedTheme,
  getSystemThemePreference,
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

  const addThemes = (
    themeConfigs: ThemeConfig[],
    options: { keepPresetThemes?: boolean } = {}
  ): void => {
    // keepPresetThemes is false when adding custom themes
    // so that user cannot revert to a preset theme, true by default.
    const { keepPresetThemes = true } = options
    setAvailableThemes([
      ...(keepPresetThemes ? createPresetThemes() : []),
      ...themeConfigs,
    ])
  }

  const updateTheme = useCallback(
    (newTheme: ThemeConfig): void => {
      setTheme(prevTheme => {
        if (newTheme !== prevTheme) {
          // Only save to localStorage if explicit "Light" or "Dark" user preference.
          // Don't save:
          // - Auto themes: can change based on system preference/time of day
          // - Single custom theme: it's the only option (like auto), no preference to preserve
          // Checking both name and displayName to handle default & custom themes.
          if (
            newTheme.name === AUTO_THEME_NAME ||
            newTheme.displayName === AUTO_THEME_NAME ||
            newTheme.name === CUSTOM_THEME_NAME
          ) {
            removeCachedTheme()
          } else {
            setCachedTheme(newTheme)
          }
          return newTheme
        }
        return prevTheme
      })
    },
    [setTheme]
  )

  const updateAutoTheme = useCallback((): void => {
    // Use functional setState to avoid stale closure issues with availableThemes.
    // This ensures we always work with the most recent state even if multiple
    // theme changes happen in quick succession.
    setAvailableThemes(prevAvailableThemes => {
      // Find the auto theme (could be preset or custom)
      const autoTheme = prevAvailableThemes.find(
        t => t.name === AUTO_THEME_NAME || t.name === CUSTOM_THEME_AUTO_NAME
      )

      if (!autoTheme) {
        // No auto theme exists (single custom theme case) - nothing to update
        return prevAvailableThemes
      }

      // Determine if we're dealing with custom or preset auto theme
      const isCustomAuto = autoTheme.name === CUSTOM_THEME_AUTO_NAME

      if (isCustomAuto) {
        // Custom auto theme - update to match system preference
        const systemPreference = getSystemThemePreference() // "light" or "dark"

        // Find the matching custom variant to copy properties from
        const matchingCustomTheme = prevAvailableThemes.find(
          t => t.displayName?.toLowerCase() === systemPreference
        )

        if (matchingCustomTheme) {
          // Create updated auto theme with the correct variant's properties
          const updatedAutoTheme: ThemeConfig = {
            ...matchingCustomTheme,
            name: CUSTOM_THEME_AUTO_NAME,
            displayName: AUTO_THEME_NAME,
          }

          // Update active theme if user is on auto
          if (theme.name === CUSTOM_THEME_AUTO_NAME) {
            setTheme(updatedAutoTheme)
          }

          // Update availableThemes list with the refreshed auto theme
          const otherThemes = prevAvailableThemes.filter(
            t => t.name !== CUSTOM_THEME_AUTO_NAME
          )
          return [...otherThemes, updatedAutoTheme]
        }
      } else {
        // We are using auto from default themes
        // Create the updated auto theme (respecting embed params if present)
        const updatedAutoTheme = getHostSpecifiedTheme()

        // Update the auto theme if active theme is auto
        if (theme.name === AUTO_THEME_NAME) {
          setTheme(updatedAutoTheme)
        }
        // Refresh the preset auto theme in the list
        const constantThemes = prevAvailableThemes.filter(
          currTheme => currTheme.name !== AUTO_THEME_NAME
        )
        return [updatedAutoTheme, ...constantThemes]
      }

      // No changes needed
      return prevAvailableThemes
    })
  }, [theme.name])

  const setFonts = useCallback(
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
    },
    [setFontFaces, setFontSources]
  )

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
