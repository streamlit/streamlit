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

import React from "react"

import userEvent from "@testing-library/user-event"
import { screen } from "@testing-library/react"

import "@testing-library/jest-dom"
import { customRenderLibContext } from "@streamlit/lib/src/test_util"
import {
  createPresetThemes,
  darkTheme,
  LibContextProps,
  lightTheme,
  mockSessionInfo,
} from "@streamlit/lib"
import { SegmentMetricsManager } from "@streamlit/app/src/SegmentMetricsManager"

import { Props, SettingsDialog } from "./SettingsDialog"

const mockSetTheme = jest.fn()
const mockAddThemes = jest.fn()

const getContext = (
  extend?: Partial<LibContextProps>
): Partial<LibContextProps> => ({
  activeTheme: lightTheme,
  setTheme: mockSetTheme,
  availableThemes: [],
  addThemes: mockAddThemes,
  ...extend,
})

const getProps = (extend?: Partial<Props>): Props => ({
  isServerConnected: true,
  onClose: jest.fn(),
  onSave: jest.fn(),
  settings: { wideMode: false, runOnSave: false },
  allowRunOnSave: false,
  developerMode: true,
  animateModal: true,
  openThemeCreator: jest.fn(),
  metricsMgr: new SegmentMetricsManager(
    // @ts-expect-error The mock seems to have a mismatched internal type to what's expected.
    mockSessionInfo()
  ),
  ...extend,
})

describe("SettingsDialog", () => {
  it("renders without crashing", () => {
    const availableThemes = [lightTheme, darkTheme]
    const props = getProps()
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    expect(screen.getByText("Settings")).toBeVisible()
  })

  it("should render run on save checkbox", async () => {
    const user = userEvent.setup()
    const props = getProps({
      allowRunOnSave: true,
    })
    const context = getContext()
    customRenderLibContext(<SettingsDialog {...props} />, context)

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
    customRenderLibContext(<SettingsDialog {...props} />, context)
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

    customRenderLibContext(<SettingsDialog {...props} />, context)

    expect(
      screen.getByText("Choose app theme, colors and fonts")
    ).toBeVisible()

    expect(screen.getByRole("combobox")).toBeVisible()
  })

  it("should show custom theme exists", async () => {
    const user = userEvent.setup()
    const presetThemes = createPresetThemes()
    const availableThemes = [...presetThemes, lightTheme]
    const props = getProps()
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    await user.click(screen.getByRole("combobox"))
    expect(screen.getAllByRole("option")).toHaveLength(presetThemes.length + 1)
  })

  it("should show custom theme does not exists", async () => {
    const user = userEvent.setup()
    const presetThemes = createPresetThemes()
    const availableThemes = [...presetThemes]
    const props = getProps()
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    await user.click(screen.getByRole("combobox"))
    expect(screen.getAllByRole("option")).toHaveLength(presetThemes.length)
  })

  it("should show theme creator button if in developer mode", () => {
    const availableThemes = [lightTheme, darkTheme]
    const props = getProps()
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    expect(screen.getByTestId("edit-theme")).toBeVisible()
    expect(screen.getByText("Edit active theme")).toBeVisible()
  })

  it("should call openThemeCreator if the button has been clicked", async () => {
    const user = userEvent.setup()
    const availableThemes = [...createPresetThemes()]
    const props = getProps()
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    expect(screen.getByTestId("edit-theme")).toBeVisible()
    await user.click(screen.getByText("Edit active theme"))
    expect(props.openThemeCreator).toHaveBeenCalledTimes(1)
  })

  it("should hide the theme creator button if not in developer mode", () => {
    const availableThemes = [lightTheme, darkTheme]
    const props = getProps({ developerMode: false })
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    expect(screen.queryByTestId("edit-theme")).not.toBeInTheDocument()
  })
})
