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

import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import {
  darkTheme,
  LibContextProps,
  lightTheme,
  mockSessionInfo,
  renderWithContexts,
} from "@streamlit/lib"

import ThemeCreatorDialog, {
  Props as ThemeCreatorDialogProps,
} from "./ThemeCreatorDialog"

const mockSetTheme = vi.fn()
const mockAddThemes = vi.fn()

const getProps = (
  props: Partial<ThemeCreatorDialogProps> = {}
): ThemeCreatorDialogProps => ({
  backToSettings: vi.fn(),
  onClose: vi.fn(),
  metricsMgr: new MetricsManager(mockSessionInfo()),
  ...props,
})

const getContext = (
  extend?: Partial<LibContextProps>
): Partial<LibContextProps> => ({
  activeTheme: lightTheme,
  setTheme: mockSetTheme,
  availableThemes: [],
  addThemes: mockAddThemes,
  ...extend,
})

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
})

describe("Renders ThemeCreatorDialog", () => {
  it("renders theme creator dialog", () => {
    const availableThemes = [lightTheme, darkTheme]
    const props = getProps()
    const context = getContext({ availableThemes })
    renderWithContexts(<ThemeCreatorDialog {...props} />, context)

    expect(screen.getByTestId("stThemeCreatorDialog")).toBeInTheDocument()
    expect(screen.getByText("Edit active theme")).toBeInTheDocument()
  })
})

describe("Opened ThemeCreatorDialog", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should update theme on color change", async () => {
    const user = userEvent.setup()
    const props = getProps()
    renderWithContexts(<ThemeCreatorDialog {...props} />, {
      setTheme: mockSetTheme,
      addThemes: mockAddThemes,
    })

    const themeColorPickers = screen.getAllByTestId("stColorPicker")
    expect(themeColorPickers).toHaveLength(4)

    const primaryColorPicker = within(themeColorPickers[0]).getByTestId(
      "stColorPickerBlock"
    )

    // Open the color picker
    await user.click(primaryColorPicker)

    // Change the color
    const newColor = "#e91e63"
    const colorInput = screen.getByRole("textbox")

    await user.clear(colorInput)
    await user.type(colorInput, newColor)

    // Close out of the popover
    await user.click(primaryColorPicker)

    // Verify the color has been updated
    expect(mockAddThemes).toHaveBeenCalled()
    expect(mockAddThemes.mock.calls[0][0][0].emotion.colors.primary).toBe(
      newColor
    )

    expect(mockSetTheme).toHaveBeenCalled()
    expect(mockSetTheme.mock.calls[0][0].emotion.colors.primary).toBe(newColor)
  })

  it("should call backToSettings if back button has been clicked", async () => {
    const user = userEvent.setup()
    const props = getProps()
    renderWithContexts(<ThemeCreatorDialog {...props} />, {
      setTheme: mockSetTheme,
      addThemes: mockAddThemes,
    })

    const backButton = screen.getByTestId("stThemeCreatorBack")
    await user.click(backButton)
    expect(props.backToSettings).toHaveBeenCalled()
  })

  it("should copy to clipboard", async () => {
    const user = userEvent.setup()
    // eslint-disable-next-line no-restricted-properties -- This is fine in tests
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText")

    const props = getProps()
    renderWithContexts(<ThemeCreatorDialog {...props} />, {
      setTheme: mockSetTheme,
      addThemes: mockAddThemes,
    })

    expect(screen.queryByText("Copied to clipboard")).not.toBeInTheDocument()
    const copyBtn = screen.getByRole("button", {
      name: "Copy theme to clipboard",
    })

    await user.click(copyBtn)

    expect(writeTextSpy).toHaveBeenCalledWith(`[theme]
base="light"
`)

    expect(await screen.findByText("Copied to clipboard")).toBeInTheDocument()
  })
})
