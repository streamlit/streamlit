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
  createPresetThemes,
  CUSTOM_THEME_NAME,
  customTheme,
  darkTheme,
  LibContextProps,
  lightTheme,
  mockSessionInfo,
  renderWithContexts,
  SessionInfo,
} from "@streamlit/lib"

import { Props, SettingsDialog } from "./SettingsDialog"

const mockSetTheme = vi.fn()

const getContext = (
  extend?: Partial<LibContextProps>
): Partial<LibContextProps> => ({
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
    const context = getContext({ availableThemes })

    renderWithContexts(<SettingsDialog {...props} />, context)

    expect(screen.getByText("Settings")).toBeVisible()
  })

  it("should render run on save checkbox", async () => {
    const user = userEvent.setup()
    const props = getProps({
      allowRunOnSave: true,
    })
    const context = getContext()
    renderWithContexts(<SettingsDialog {...props} />, context)

    await user.click(screen.getByText("Run on save"))

    expect(props.onSave).toHaveBeenCalledTimes(1)
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ runOnSave: true })
    )
  })

  it("should render wide mode checkbox", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const context = getContext()
    renderWithContexts(<SettingsDialog {...props} />, context)
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
    const context = getContext({ availableThemes })

    renderWithContexts(<SettingsDialog {...props} />, context)

    expect(screen.getByText("Choose app theme")).toBeVisible()

    expect(screen.getByRole("combobox")).toBeVisible()
  })

  it("if custom theme exists, only show custom theme as option & disable selectbox", () => {
    const presetThemes = createPresetThemes()
    const availableThemes = [...presetThemes, customTheme]
    const props = getProps()
    const context = getContext({ availableThemes, activeTheme: customTheme })

    renderWithContexts(<SettingsDialog {...props} />, context)

    const selectbox = screen.getByRole("combobox")
    expect(selectbox).toBeVisible()
    expect(selectbox).toBeDisabled()

    expect(screen.getByText(CUSTOM_THEME_NAME)).toBeVisible()
  })

  it("should show custom theme does not exists", async () => {
    const user = userEvent.setup()
    const presetThemes = createPresetThemes()
    const availableThemes = [...presetThemes]
    const props = getProps()
    const context = getContext({ availableThemes })

    renderWithContexts(<SettingsDialog {...props} />, context)

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
    const context = getContext({ activeTheme: darkTheme, availableThemes })

    renderWithContexts(<SettingsDialog {...props} />, context)

    expect(screen.getByText("Dark")).toBeVisible()

    await user.click(screen.getByRole("combobox"))
    expect(screen.getAllByRole("option")).toHaveLength(presetThemes.length)
  })

  it("shows version string if SessionInfo is initialized", () => {
    const props = getProps({
      sessionInfo: mockSessionInfo({ streamlitVersion: "42.42.42" }),
    })
    const context = getContext()

    renderWithContexts(<SettingsDialog {...props} />, context)

    const versionRegex = /Made with Streamlit\s*42\.42\.42/
    const versionText = screen.getByText(versionRegex)
    expect(versionText).toBeDefined()
  })

  it("shows no version string if SessionInfo is not initialized", () => {
    const sessionInfo = new SessionInfo()
    expect(sessionInfo.isSet).toBe(false)

    const props = getProps({ sessionInfo })
    const context = getContext()

    renderWithContexts(<SettingsDialog {...props} />, context)

    const versionRegex = /^Made with Streamlit.*/
    const nonExistentText = screen.queryByText(versionRegex)
    expect(nonExistentText).not.toBeInTheDocument()
  })
})
