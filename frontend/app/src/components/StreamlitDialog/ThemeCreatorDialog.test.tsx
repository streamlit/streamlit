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
import "@testing-library/jest-dom"
import { screen, fireEvent, within } from "@testing-library/react"
import {
  darkTheme,
  lightTheme,
  toThemeInput,
  fonts,
  CustomThemeConfig,
  LibContextProps,
} from "@streamlit/lib"
import { customRenderLibContext } from "@streamlit/lib/src/test_util"

import ThemeCreatorDialog, {
  Props as ThemeCreatorDialogProps,
  toMinimalToml,
} from "./ThemeCreatorDialog"

const mockSetTheme = jest.fn()
const mockAddThemes = jest.fn()

const getProps = (
  props: Partial<ThemeCreatorDialogProps> = {}
): ThemeCreatorDialogProps => ({
  backToSettings: jest.fn(),
  onClose: jest.fn(),
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
    writeText: jest.fn(),
  },
})

describe("Renders ThemeCreatorDialog", () => {
  it("renders theme creator dialog", () => {
    const availableThemes = [lightTheme, darkTheme]
    const props = getProps()
    const context = getContext({ availableThemes })
    customRenderLibContext(<ThemeCreatorDialog {...props} />, context)

    expect(screen.getByTestId("stThemeCreatorDialog")).toBeInTheDocument()
    expect(screen.getByText("Edit active theme")).toBeInTheDocument()
  })
})

describe("toMinimalToml", () => {
  it("outputs the correct config for the preset lightTheme", () => {
    const themeInput = toThemeInput(lightTheme.emotion)
    expect(toMinimalToml(themeInput)).toBe(`[theme]
base="light"
`)
  })

  it("is not case sensitive with color hex codes", () => {
    const themeInput = {
      ...toThemeInput(lightTheme.emotion),
      backgroundColor: "#fFfFff",
    }
    expect(toMinimalToml(themeInput)).toBe(`[theme]
base="light"
`)
  })

  it("sets base = light when closer to lightTheme", () => {
    const themeInput = {
      ...toThemeInput(lightTheme.emotion),
      primaryColor: "blue",
    }
    expect(toMinimalToml(themeInput)).toBe(`[theme]
base="light"
primaryColor="blue"
`)
  })

  it("outputs the correct config for the preset darkTheme", () => {
    const themeInput = toThemeInput(darkTheme.emotion)
    expect(toMinimalToml(themeInput)).toBe(`[theme]
base="dark"
`)
  })

  it("sets base = dark when closer to darkTheme", () => {
    const themeInput = {
      ...toThemeInput(darkTheme.emotion),
      primaryColor: "blue",
    }
    expect(toMinimalToml(themeInput)).toBe(`[theme]
base="dark"
primaryColor="blue"
`)
  })

  it("does not set base if all non-primaryColor color options are set", () => {
    const themeInput = {
      ...toThemeInput(darkTheme.emotion),
      backgroundColor: "red",
      secondaryBackgroundColor: "blue",
      textColor: "purple",
    }
    expect(toMinimalToml(themeInput)).toBe(`[theme]
backgroundColor="red"
secondaryBackgroundColor="blue"
textColor="purple"
`)
  })

  it("does not set base if all color options are set", () => {
    const themeInput = {
      ...toThemeInput(darkTheme.emotion),
      primaryColor: "pink",
      backgroundColor: "red",
      secondaryBackgroundColor: "blue",
      textColor: "purple",
    }
    expect(toMinimalToml(themeInput)).toBe(`[theme]
primaryColor="pink"
backgroundColor="red"
secondaryBackgroundColor="blue"
textColor="purple"
`)
  })

  it("sets font if not sans serif", () => {
    const themeInput = {
      ...toThemeInput(lightTheme.emotion),
      font: CustomThemeConfig.FontFamily.MONOSPACE,
    }
    expect(toMinimalToml(themeInput)).toBe(`[theme]
base="light"
font="monospace"
`)
  })
})

describe("Opened ThemeCreatorDialog", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should update theme on color change", () => {
    const props = getProps()
    customRenderLibContext(<ThemeCreatorDialog {...props} />, {
      setTheme: mockSetTheme,
      addThemes: mockAddThemes,
    })

    const themeColorPickers = screen.getAllByTestId("stColorPicker")
    expect(themeColorPickers).toHaveLength(4)

    const primaryColorPicker = within(themeColorPickers[0]).getByTestId(
      "stColorBlock"
    )
    fireEvent.click(primaryColorPicker)

    const newColor = "#e91e63"
    const colorInput = screen.getByRole("textbox")
    fireEvent.change(colorInput, { target: { value: newColor } })
    // Close out of the popover
    fireEvent.click(primaryColorPicker)

    expect(mockAddThemes).toHaveBeenCalled()
    expect(mockAddThemes.mock.calls[0][0][0].emotion.colors.primary).toBe(
      newColor
    )

    expect(mockSetTheme).toHaveBeenCalled()
    expect(mockSetTheme.mock.calls[0][0].emotion.colors.primary).toBe(newColor)
  })

  it("should update theme on font change", () => {
    const props = getProps()
    customRenderLibContext(<ThemeCreatorDialog {...props} />, {
      setTheme: mockSetTheme,
      addThemes: mockAddThemes,
    })

    fireEvent.click(screen.getByRole("combobox"))
    const options = screen.getAllByRole("option")

    expect(options).toHaveLength(
      Object.keys(CustomThemeConfig.FontFamily).length
    )

    fireEvent.click(options[2])
    expect(mockAddThemes).toHaveBeenCalled()
    expect(
      mockAddThemes.mock.calls[0][0][0].emotion.genericFonts.bodyFont
    ).toBe(fonts.monospace)

    expect(mockSetTheme).toHaveBeenCalled()
    expect(mockSetTheme.mock.calls[0][0].emotion.genericFonts.bodyFont).toBe(
      fonts.monospace
    )
  })

  it("should have font dropdown populated", () => {
    const props = getProps()
    customRenderLibContext(<ThemeCreatorDialog {...props} />, {
      setTheme: mockSetTheme,
      addThemes: mockAddThemes,
    })

    fireEvent.click(screen.getByRole("combobox"))
    const options = screen.getAllByRole("option")

    expect(options).toHaveLength(
      Object.keys(CustomThemeConfig.FontFamily).length
    )
    expect(options[0]).toHaveTextContent("Sans serif")
    expect(options[0]).toHaveAttribute("aria-selected", "true")
  })

  it("should call backToSettings if back button has been clicked", () => {
    const props = getProps()
    customRenderLibContext(<ThemeCreatorDialog {...props} />, {
      setTheme: mockSetTheme,
      addThemes: mockAddThemes,
    })

    const backButton = screen.getByTestId("stThemeCreatorBack")
    fireEvent.click(backButton)
    expect(props.backToSettings).toHaveBeenCalled()
  })

  it("should copy to clipboard", () => {
    // This hack is used below to get around `shallow` not supporting the
    // `useState` hook, and emotion's `useTheme` hook (used by Modal) getting
    // thrown off by us mocking `useContext` above :(
    const updateCopied = jest.fn()
    const useStateSpy = jest.spyOn(React, "useState")
    // @ts-expect-error
    useStateSpy.mockImplementation(init => [init, updateCopied])

    const props = getProps()
    customRenderLibContext(<ThemeCreatorDialog {...props} />, {
      setTheme: mockSetTheme,
      addThemes: mockAddThemes,
    })

    const copyBtn = screen.getByRole("button", {
      name: "Copy theme to clipboard",
    })
    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`[theme]
base="light"
`)
    expect(updateCopied).toHaveBeenCalledWith(true)
  })
})
