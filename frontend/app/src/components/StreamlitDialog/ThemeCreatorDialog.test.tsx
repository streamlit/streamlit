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
import {
  darkTheme,
  lightTheme,
  toThemeInput,
  fonts,
  CustomThemeConfig,
} from "@streamlit/lib"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import ThemeCreatorDialog, {
  Props as ThemeCreatorDialogProps,
  toMinimalToml,
} from "./ThemeCreatorDialog"
import { customRenderLibContext } from "@streamlit/lib/src/test_util"
import userEvent from "@testing-library/user-event"

const mockSetTheme = jest.fn()
const mockAddThemes = jest.fn()

const getProps = (
  props: Partial<ThemeCreatorDialogProps> = {}
): ThemeCreatorDialogProps => ({
  backToSettings: jest.fn(),
  onClose: jest.fn(),
  ...props,
})

Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
})

describe("Renders ThemeCreatorDialog", () => {
  it("renders theme creator dialog", () => {
    const props = getProps()
    customRenderLibContext(<ThemeCreatorDialog {...props} />, {
      setTheme: mockSetTheme,
      addThemes: mockAddThemes,
    })
    expect(screen.getByTestId("stModal")).toBeInTheDocument()
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
  it("should update theme on color change", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const { container } = customRenderLibContext(
      <ThemeCreatorDialog {...props} />,
      {
        setTheme: mockSetTheme,
        addThemes: mockAddThemes,
      }
    )

    const primaryColorPicker = screen.queryAllByTestId("stColorPicker")[0]
    expect(primaryColorPicker).toBeInTheDocument()

    const primaryColor = screen.getByText("#FF4B4B")
    userEvent.click(primaryColor)
    expect(
      await screen.findByTestId("stStyledChromePicker")
    ).toBeInTheDocument()
    const labelElement = container.querySelector(
      'label[for="rc-editable-input-1"]'
    )
    console.log(screen.debug())
    console.log(labelElement)
    fireEvent.change(labelElement, { target: { value: "#FFFFFF" } })
    expect(mockAddThemes).toHaveBeenCalled()
    expect(mockAddThemes.mock.calls[0][0][0].emotion.colors.primary).toBe(
      "#FFFFFF"
    )

    expect(mockSetTheme).toHaveBeenCalled()
    expect(mockSetTheme.mock.calls[0][0].emotion.colors.primary).toBe(
      "#FFFFFF"
    )
  })

  it("should update theme on font change", () => {
    const props = getProps()
    customRenderLibContext(<ThemeCreatorDialog {...props} />, {
      setTheme: mockSetTheme,
      addThemes: mockAddThemes,
    })

    const fontBox = screen.getByText("Sans serif")
    fireEvent.click(fontBox)

    const newFont = screen.getByText("Monospace")
    fireEvent.click(newFont)

    expect(mockAddThemes).toHaveBeenCalled()
    expect(
      mockAddThemes.mock.calls[0][0][0].emotion.genericFonts.bodyFont
    ).toBe(fonts.monospace)

    expect(mockSetTheme).toHaveBeenCalled()
    expect(mockSetTheme.mock.calls[0][0].emotion.genericFonts.bodyFont).toBe(
      fonts.monospace
    )
  })

  it("should call backToSettings if back button has been clicked", async () => {
    const props = getProps()
    customRenderLibContext(<ThemeCreatorDialog {...props} />, {
      setTheme: mockSetTheme,
      addThemes: mockAddThemes,
    })
    const backButton = screen.getByTestId("stModalStyledBackButton")
    fireEvent.click(backButton)
    // need to wait a little so check for an element that should appear
    expect(await screen.findByText("Edit active theme")).toBeInTheDocument()
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
    const copyBtn = screen.queryByText("Copy theme to clipboard")

    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`[theme]
base="light"
`)
    expect(updateCopied).toHaveBeenCalledWith(true)
  })
})
