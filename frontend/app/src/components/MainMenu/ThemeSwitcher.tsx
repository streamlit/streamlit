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

import {
  StyledIconWrapper,
  StyledThemeButton,
  StyledThemeSwitcherContainer,
} from "./styled-components"

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
