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

import React from "react"

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import {
  AUTO_THEME_NAME,
  createPresetThemes,
  CUSTOM_THEME_DARK_NAME,
  CUSTOM_THEME_LIGHT_NAME,
  CUSTOM_THEME_NAME,
  customTheme,
  darkTheme,
  lightTheme,
  mockSessionInfo,
  renderWithContexts,
  SessionInfo,
  ThemeConfig,
  ThemeContextProps,
} from "@streamlit/lib"

import { Props, SettingsDialog } from "./SettingsDialog"

const mockSetTheme = vi.fn()

export const autoCustomTheme: ThemeConfig = {
  name: "Use system setting",
  emotion: lightTheme.emotion,
  basewebTheme: lightTheme.basewebTheme,
  primitives: lightTheme.primitives,
}

const customThemeLight: ThemeConfig = {
  name: "Custom Theme Light",
  emotion: lightTheme.emotion,
  basewebTheme: lightTheme.basewebTheme,
  primitives: lightTheme.primitives,
}

const customThemeDark: ThemeConfig = {
  name: "Custom Theme Dark",
  emotion: darkTheme.emotion,
  basewebTheme: darkTheme.basewebTheme,
  primitives: darkTheme.primitives,
}

const getThemeContext = (
  extend?: Partial<ThemeContextProps>
): Partial<ThemeContextProps> => ({
  activeTheme: lightTheme,
  setTheme: mockSetTheme,
  availableThemes: [],
  ...extend,
})

const getProps = (extend?: Partial<Props>): Props => ({
  isServerConnected: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  settings: { wideMode: false, runOnSave: false },
  allowRunOnSave: false,
  animateModal: true,
  metricsMgr: new MetricsManager(mockSessionInfo()),
  sessionInfo: mockSessionInfo(),
  ...extend,
})

describe("SettingsDialog", () => {
  it("renders without crashing", () => {
    const availableThemes = [lightTheme, darkTheme]
    const props = getProps()
    const themeContext = getThemeContext({ availableThemes })

    renderWithContexts(
      <SettingsDialog {...props} />,
      // LibContext
      {},
      // ThemeContext
      themeContext
    )

    expect(screen.getByText("Settings")).toBeVisible()
  })

  it("should render run on save checkbox", async () => {
    const user = userEvent.setup()
    const props = getProps({
      allowRunOnSave: true,
    })
    const themeContext = getThemeContext()
    renderWithContexts(
      <SettingsDialog {...props} />,
      // LibContext
      {},
      // ThemeContext
      themeContext
    )

    await user.click(screen.getByText("Run on save"))

    expect(props.onSave).toHaveBeenCalledTimes(1)
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ runOnSave: true })
    )
  })

  it("should render wide mode checkbox", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const themeContext = getThemeContext()
    renderWithContexts(
      <SettingsDialog {...props} />,
      // LibContext
      {},
      // ThemeContext
      themeContext
    )
    expect(screen.getByText("Wide mode")).toBeVisible()

    await user.click(screen.getByText("Wide mode"))

    expect(props.onSave).toHaveBeenCalledTimes(1)
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ wideMode: true })
    )
  })

  it("should render theme selector", () => {
    const availableThemes = [lightTheme, darkTheme]
    const props = getProps()
    const themeContext = getThemeContext({ availableThemes })

    renderWithContexts(<SettingsDialog {...props} />, {}, themeContext)

    expect(screen.getByText("Choose app theme")).toBeVisible()

    expect(screen.getByRole("combobox")).toBeVisible()
  })

  it("if single custom theme exists, only show Custom Theme as option & disable selectbox", () => {
    // When single custom theme exists (no light/dark versions), this is the only option
    // and the preset themes are removed from available themes
    const availableThemes = [customTheme]
    const props = getProps()
    const themeContext = getThemeContext({
      availableThemes,
      activeTheme: customTheme,
    })

    renderWithContexts(<SettingsDialog {...props} />, {}, themeContext)

    const selectbox = screen.getByRole("combobox")
    expect(selectbox).toBeVisible()
    expect(selectbox).toBeDisabled()

    expect(screen.getByText(CUSTOM_THEME_NAME)).toBeVisible()
  })

  it("if Custom Theme Light active, show correct active theme & light/dark/auto custom themes as options", async () => {
    const user = userEvent.setup()
    // When custom theme light & dark exist, also have auto theme
    // and the preset themes are removed from available themes
    const availableThemes = [
      autoCustomTheme,
      customThemeLight,
      customThemeDark,
    ]
    const props = getProps()
    const themeContext = getThemeContext({
      availableThemes,
      activeTheme: customThemeLight,
    })

    renderWithContexts(<SettingsDialog {...props} />, {}, themeContext)

    // Correct selected theme is shown
    expect(screen.getByText(CUSTOM_THEME_LIGHT_NAME)).toBeVisible()

    const selectbox = screen.getByRole("combobox")
    await user.click(selectbox)

    // Should only show Auto (Use System Setting), Custom Theme Light and Custom Theme Dark as options
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent(AUTO_THEME_NAME)
    expect(options[1]).toHaveTextContent(CUSTOM_THEME_LIGHT_NAME)
    expect(options[2]).toHaveTextContent(CUSTOM_THEME_DARK_NAME)
  })

  it("if Custom Theme Dark active, show correct active theme & light/dark/auto custom themes as options", async () => {
    const user = userEvent.setup()
    const availableThemes = [
      autoCustomTheme,
      customThemeLight,
      customThemeDark,
    ]
    const props = getProps()
    const themeContext = getThemeContext({
      availableThemes,
      activeTheme: customThemeDark,
    })

    renderWithContexts(<SettingsDialog {...props} />, {}, themeContext)

    // Correct selected theme is shown
    expect(screen.getByText(CUSTOM_THEME_DARK_NAME)).toBeVisible()

    const selectbox = screen.getByRole("combobox")
    await user.click(selectbox)

    // Should only show Auto (Use System Setting), Custom Theme Light and Custom Theme Dark as options
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent(AUTO_THEME_NAME)
    expect(options[1]).toHaveTextContent(CUSTOM_THEME_LIGHT_NAME)
    expect(options[2]).toHaveTextContent(CUSTOM_THEME_DARK_NAME)
  })

  it("should not show custom theme as option if it does not exist", async () => {
    const user = userEvent.setup()
    const presetThemes = createPresetThemes()
    const availableThemes = [...presetThemes]
    const props = getProps()
    const themeContext = getThemeContext({ availableThemes })

    renderWithContexts(<SettingsDialog {...props} />, {}, themeContext)

    expect(screen.getByText("Light")).toBeVisible()

    await user.click(screen.getByRole("combobox"))
    expect(screen.getAllByRole("option")).toHaveLength(presetThemes.length)
    expect(screen.queryByText(CUSTOM_THEME_NAME)).not.toBeInTheDocument()
  })

  it("shows the currently active theme as selected", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const presetThemes = createPresetThemes()
    const availableThemes = [...presetThemes]
    const themeContext = getThemeContext({
      activeTheme: darkTheme,
      availableThemes,
    })

    renderWithContexts(<SettingsDialog {...props} />, {}, themeContext)

    expect(screen.getByText("Dark")).toBeVisible()

    await user.click(screen.getByRole("combobox"))
    expect(screen.getAllByRole("option")).toHaveLength(presetThemes.length)
  })

  it("shows version string if SessionInfo is initialized", () => {
    const props = getProps({
      sessionInfo: mockSessionInfo({ streamlitVersion: "42.42.42" }),
    })
    const themeContext = getThemeContext()

    renderWithContexts(<SettingsDialog {...props} />, {}, themeContext)

    const versionRegex = /Made with Streamlit\s*42\.42\.42/
    const versionText = screen.getByText(versionRegex)
    expect(versionText).toBeDefined()
  })

  it("shows no version string if SessionInfo is not initialized", () => {
    const sessionInfo = new SessionInfo()
    expect(sessionInfo.isSet).toBe(false)

    const props = getProps({ sessionInfo })
    const themeContext = getThemeContext()

    renderWithContexts(<SettingsDialog {...props} />, {}, themeContext)

    const versionRegex = /^Made with Streamlit.*/
    const nonExistentText = screen.queryByText(versionRegex)
    expect(nonExistentText).not.toBeInTheDocument()
  })
})
