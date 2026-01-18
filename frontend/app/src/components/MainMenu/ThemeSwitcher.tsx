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

import { memo, ReactElement, useCallback, useContext } from "react"

import styled from "@emotion/styled"
import { transparentize } from "color2k"

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import {
  AUTO_THEME_NAME,
  CUSTOM_THEME_AUTO_NAME,
  CUSTOM_THEME_DARK_NAME,
  CUSTOM_THEME_LIGHT_NAME,
  CUSTOM_THEME_NAME,
  darkTheme,
  DynamicIcon,
  getThemeSelectionFromThemeConfig,
  lightTheme,
  ThemeConfig,
  ThemeContext,
} from "@streamlit/lib"

/** Theme selection options */
type ThemeSelection = "System" | "Light" | "Dark"

interface ThemeOptionConfig {
  label: ThemeSelection
  icon: string // Material icon name in :material/name: format
}

const THEME_OPTIONS: ThemeOptionConfig[] = [
  { label: "System", icon: ":material/contrast:" },
  { label: "Light", icon: ":material/light_mode:" },
  { label: "Dark", icon: ":material/dark_mode:" },
]

const StyledThemeSwitcherContainer = styled.div(({ theme }) => ({
  display: "flex",
  width: "100%",
  gap: theme.spacing.threeXS, // 2px gap between options
  paddingBottom: theme.spacing.xs,
}))

interface StyledThemeButtonProps {
  isActive: boolean
}

const StyledThemeButton = styled.button<StyledThemeButtonProps>(
  ({ theme, isActive }) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.twoXS, // 4px gap between icon and text
    flex: 1,
    padding: `0.375rem ${theme.spacing.sm}`, // 6px top/bottom, 8px left/right
    border: "none",
    borderRadius: theme.radii.default,
    backgroundColor: isActive
      ? transparentize(theme.colors.primary, 0.9)
      : theme.colors.transparent,
    color: isActive ? theme.colors.primary : theme.colors.bodyText,
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.normal,
    lineHeight: theme.lineHeights.tight,
    transition: "all 150ms ease-out",

    "&:hover": {
      backgroundColor: isActive
        ? transparentize(theme.colors.primary, 0.85)
        : theme.colors.darkenedBgMix15,
    },
    "&:focus-visible": {
      outline: "none",
      boxShadow: theme.shadows.focusRing,
      zIndex: theme.zIndices.priority,
    },
  })
)

const StyledIconWrapper = styled.span(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: theme.fontSizes.xl,
}))

export interface ThemeSwitcherProps {
  metricsMgr: MetricsManager
}

/**
 * ThemeSwitcher component for the main menu.
 * Displays a segmented control with System/Light/Dark options.
 */
function ThemeSwitcher({
  metricsMgr,
}: Readonly<ThemeSwitcherProps>): ReactElement | null {
  const { activeTheme, availableThemes, setTheme } = useContext(ThemeContext)

  const currentSelection = getThemeSelectionFromThemeConfig(activeTheme)

  const handleThemeChange = useCallback(
    (selection: ThemeSelection): void => {
      let newTheme: ThemeConfig | undefined

      switch (selection) {
        case "System":
          // Look for custom auto theme first, then standard auto theme
          newTheme = availableThemes.find(
            t =>
              t.name === CUSTOM_THEME_AUTO_NAME || t.name === AUTO_THEME_NAME
          )
          break
        case "Light":
          // Look for custom light theme first, then standard light theme
          newTheme = availableThemes.find(
            t =>
              t.name === CUSTOM_THEME_LIGHT_NAME || t.name === lightTheme.name
          )
          break
        case "Dark":
          // Look for custom dark theme first, then standard dark theme
          newTheme = availableThemes.find(
            t => t.name === CUSTOM_THEME_DARK_NAME || t.name === darkTheme.name
          )
          break
      }

      if (newTheme) {
        metricsMgr.enqueue("menuClick", {
          label: "changeTheme",
        })
        setTheme(newTheme)
      }
    },
    [availableThemes, setTheme, metricsMgr]
  )

  // Check if we should hide the theme switcher
  // Hide if there's only a custom theme with no dark variant
  const hasCustomTheme = availableThemes.some(
    t => t.name === CUSTOM_THEME_NAME || t.name.startsWith("Custom Theme")
  )
  const hasOnlyOneCustomTheme =
    hasCustomTheme &&
    availableThemes.filter(
      t => t.name !== AUTO_THEME_NAME && !t.name.includes("Light")
    ).length === 1

  if (hasOnlyOneCustomTheme && activeTheme.name === CUSTOM_THEME_NAME) {
    // Don't show theme switcher when only a single custom theme is available
    return null
  }

  return (
    <StyledThemeSwitcherContainer data-testid="stThemeSwitcher">
      {THEME_OPTIONS.map(option => (
        <StyledThemeButton
          key={option.label}
          isActive={currentSelection === option.label}
          onClick={() => handleThemeChange(option.label)}
          aria-pressed={currentSelection === option.label}
          data-testid={`stThemeSwitcher-${option.label}`}
        >
          <StyledIconWrapper>
            <DynamicIcon iconValue={option.icon} size="xl" />
          </StyledIconWrapper>
          {option.label}
        </StyledThemeButton>
      ))}
    </StyledThemeSwitcherContainer>
  )
}

export default memo(ThemeSwitcher)
