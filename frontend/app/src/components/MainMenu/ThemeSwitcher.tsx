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

type ThemeSelection = "System" | "Light" | "Dark"

interface ThemeOptionConfig {
  label: ThemeSelection
  icon: string
}

const THEME_OPTIONS: ThemeOptionConfig[] = [
  { label: "System", icon: ":material/contrast:" },
  { label: "Light", icon: ":material/light_mode:" },
  { label: "Dark", icon: ":material/dark_mode:" },
]

const StyledThemeSwitcherContainer = styled.div(({ theme }) => ({
  display: "flex",
  width: "100%",
  gap: theme.spacing.threeXS,
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
  paddingBottom: theme.spacing.twoXS,
}))

interface StyledThemeButtonProps {
  isActive: boolean
  isDisabled: boolean
}

const StyledThemeButton = styled.button<StyledThemeButtonProps>(
  ({ theme, isActive, isDisabled }) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.twoXS,
    flex: 1,
    padding: `0.375rem ${theme.spacing.sm}`,
    border: "none",
    borderRadius: theme.radii.default,
    backgroundColor: isActive
      ? transparentize(theme.colors.primary, 0.9)
      : theme.colors.transparent,
    color: isActive ? theme.colors.primary : theme.colors.bodyText,
    cursor: isDisabled ? "not-allowed" : "pointer",
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.normal,
    lineHeight: theme.lineHeights.none,
    transition: "all 150ms ease-out",
    minWidth: theme.sizes.themeSelectionButtonWidth,
    opacity: isDisabled ? 0.6 : 1,

    "&:hover": {
      backgroundColor: isDisabled
        ? theme.colors.transparent
        : isActive
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

function ThemeSwitcher({
  metricsMgr,
}: Readonly<ThemeSwitcherProps>): ReactElement {
  const { activeTheme, availableThemes, setTheme } = useContext(ThemeContext)

  const hasCustomTheme = availableThemes.some(
    theme =>
      theme.name === CUSTOM_THEME_NAME || theme.name.startsWith("Custom Theme")
  )
  const hasLightTheme = availableThemes.some(
    theme =>
      theme.name === CUSTOM_THEME_LIGHT_NAME || theme.name === lightTheme.name
  )
  const hasDarkTheme = availableThemes.some(
    theme =>
      theme.name === CUSTOM_THEME_DARK_NAME || theme.name === darkTheme.name
  )
  const disableLightDark = hasCustomTheme && !hasLightTheme && !hasDarkTheme

  const activeSelection = disableLightDark
    ? "System"
    : getThemeSelectionFromThemeConfig(activeTheme)

  const handleThemeChange = useCallback(
    (selection: ThemeSelection): void => {
      let newTheme: ThemeConfig | undefined

      switch (selection) {
        case "System":
          newTheme = availableThemes.find(
            theme =>
              theme.name === CUSTOM_THEME_AUTO_NAME ||
              theme.name === AUTO_THEME_NAME
          )
          break
        case "Light":
          newTheme = availableThemes.find(
            theme =>
              theme.name === CUSTOM_THEME_LIGHT_NAME ||
              theme.name === lightTheme.name
          )
          break
        case "Dark":
          newTheme = availableThemes.find(
            theme =>
              theme.name === CUSTOM_THEME_DARK_NAME ||
              theme.name === darkTheme.name
          )
          break
      }

      if (newTheme) {
        metricsMgr.enqueue("menuClick", { label: "changeTheme" })
        setTheme(newTheme)
      }
    },
    [availableThemes, setTheme, metricsMgr]
  )

  return (
    <StyledThemeSwitcherContainer data-testid="stThemeSwitcher">
      {THEME_OPTIONS.map(option => {
        const isLightDarkDisabled =
          disableLightDark &&
          (option.label === "Light" || option.label === "Dark")
        return (
          <StyledThemeButton
            key={option.label}
            isActive={activeSelection === option.label}
            isDisabled={isLightDarkDisabled}
            disabled={isLightDarkDisabled}
            onClick={() => handleThemeChange(option.label)}
            aria-pressed={activeSelection === option.label}
            data-testid={`stThemeSwitcher-${option.label}`}
          >
            <StyledIconWrapper>
              <DynamicIcon iconValue={option.icon} size="lg" />
            </StyledIconWrapper>
            {option.label}
          </StyledThemeButton>
        )
      })}
    </StyledThemeSwitcherContainer>
  )
}

export default memo(ThemeSwitcher)
