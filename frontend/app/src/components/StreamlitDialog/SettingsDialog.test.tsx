/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import "@testing-library/jest-dom"
import { customRenderLibContext } from "@streamlit/lib/src/test_util"

import {
  createPresetThemes,
  lightTheme,
  darkTheme,
  mockSessionInfo,
  LibContextProps,
} from "@streamlit/lib"
import { SegmentMetricsManager } from "@streamlit/app/src/SegmentMetricsManager"

import { SettingsDialog, Props } from "./SettingsDialog"

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
  metricsMgr: new SegmentMetricsManager(mockSessionInfo()),
  ...extend,
})

describe("SettingsDialog", () => {
  // Note: You may need to wrap the component in a context provider to pass the context if necessary.

  it("renders without crashing", () => {
    const availableThemes = [lightTheme, darkTheme]
    const props = getProps()
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    expect(screen.getByText("Settings")).toBeInTheDocument()
  })

  it("should render run on save checkbox", () => {
    const props = getProps({
      allowRunOnSave: true,
    })
    const context = getContext()
    customRenderLibContext(<SettingsDialog {...props} />, context)
    expect(screen.getByText("Run on save")).toBeInTheDocument()

    screen.getByText("Run on save").click()

    expect(props.onSave).toHaveBeenCalled()
    // @ts-expect-error
    expect(props.onSave.mock.calls[0][0].runOnSave).toBe(true)
  })

  it("should render wide mode checkbox", () => {
    const props = getProps()
    const context = getContext()
    customRenderLibContext(<SettingsDialog {...props} />, context)
    expect(screen.getByText("Wide mode")).toBeInTheDocument()

    screen.getByText("Wide mode").click()

    expect(props.onSave).toHaveBeenCalled()
    // @ts-expect-error
    expect(props.onSave.mock.calls[0][0].wideMode).toBe(true)
  })

  it("should render theme selector", () => {
    const availableThemes = [lightTheme, darkTheme]
    const props = getProps()
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    expect(
      screen.getByText("Choose app theme, colors and fonts")
    ).toBeInTheDocument()

    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("should show custom theme exists", () => {
    const presetThemes = createPresetThemes()
    const availableThemes = [...presetThemes, lightTheme]
    const props = getProps()
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    screen.getByRole("combobox").click()
    expect(screen.getAllByRole("option")).toHaveLength(presetThemes.length + 1)
  })

  it("should show custom theme does not exists", () => {
    const presetThemes = createPresetThemes()
    const availableThemes = [...presetThemes]
    const props = getProps()
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    screen.getByRole("combobox").click()
    expect(screen.getAllByRole("option")).toHaveLength(presetThemes.length)
  })

  it("should show theme creator button if in developer mode", () => {
    const availableThemes = [lightTheme, darkTheme]
    const props = getProps()
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    expect(screen.getByTestId("edit-theme")).toBeInTheDocument()
    expect(screen.getByText("Edit active theme")).toBeInTheDocument()
  })

  it("should call openThemeCreator if the button has been clicked", () => {
    const availableThemes = [...createPresetThemes()]
    const props = getProps()
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    expect(screen.getByTestId("edit-theme")).toBeInTheDocument()
    screen.getByText("Edit active theme").click()
    expect(props.openThemeCreator).toHaveBeenCalled()
  })

  it("should hide the theme creator button if not in developer mode", () => {
    const availableThemes = [lightTheme, darkTheme]
    const props = getProps({ developerMode: false })
    const context = getContext({ availableThemes })

    customRenderLibContext(<SettingsDialog {...props} />, context)

    expect(screen.queryByTestId("edit-theme")).not.toBeInTheDocument()
  })
})
