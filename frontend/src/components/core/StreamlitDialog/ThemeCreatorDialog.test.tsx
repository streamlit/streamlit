/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { CustomThemeConfig } from "src/autogen/proto"
import { shallow } from "src/lib/test_util"
import ColorPicker from "src/components/shared/ColorPicker"
import UISelectbox from "src/components/shared/Dropdown"
import { baseTheme, darkTheme, lightTheme, toThemeInput } from "src/theme"
import { fonts } from "src/theme/primitives/typography"
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

Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
})

describe("Renders ThemeCreatorDialog", () => {
  beforeEach(() =>
    jest.spyOn(React, "useContext").mockImplementation(() => ({
      activeTheme: baseTheme,
      setTheme: mockSetTheme,
      availableThemes: [],
      addThemes: mockAddThemes,
    }))
  )

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("renders theme creator dialog", () => {
    const props = getProps()
    const wrapper = shallow(<ThemeCreatorDialog {...props} />)
    expect(wrapper).toMatchSnapshot()
  })
})

describe("toMinimalToml", () => {
  it("outputs the correct config for the preset lightTheme", () => {
    const themeInput = toThemeInput(lightTheme.emotion)
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
  beforeEach(() => {
    jest.spyOn(React, "useContext").mockImplementation(() => ({
      activeTheme: baseTheme,
      setTheme: mockSetTheme,
      availableThemes: [],
      addThemes: mockAddThemes,
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should update theme on color change", () => {
    const props = getProps()
    const wrapper = shallow(<ThemeCreatorDialog {...props} />)
      .find("ThemeOption")
      .first()
      .dive()

    const colorpicker = wrapper.find(ColorPicker)
    expect(colorpicker).toHaveLength(1)

    colorpicker.at(0).prop("onChange")("pink")
    expect(mockAddThemes).toHaveBeenCalled()
    expect(mockAddThemes.mock.calls[0][0][0].emotion.colors.primary).toBe(
      "pink"
    )

    expect(mockSetTheme).toHaveBeenCalled()
    expect(mockSetTheme.mock.calls[0][0].emotion.colors.primary).toBe("pink")
  })

  it("should update theme on font change", () => {
    const props = getProps()
    const wrapper = shallow(<ThemeCreatorDialog {...props} />)
      .find("ThemeOption")
      .last()
      .dive()

    const selectbox = wrapper.find(UISelectbox)
    const { options } = selectbox.props()

    expect(options).toHaveLength(
      Object.keys(CustomThemeConfig.FontFamily).length
    )

    selectbox.prop("onChange")(2)
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
    const wrapper = shallow(<ThemeCreatorDialog {...props} />)
      .find("ThemeOption")
      .last()
      .dive()
    const selectbox = wrapper.find(UISelectbox)
    const { options, value } = selectbox.props()

    expect(options).toHaveLength(
      Object.keys(CustomThemeConfig.FontFamily).length
    )
    expect(value).toBe(0)
  })

  it("should call backToSettings if back button has been clicked", () => {
    const props = getProps()
    const wrapper = shallow(<ThemeCreatorDialog {...props} />)
    wrapper.find("StyledBackButton").simulate("click")
    expect(props.backToSettings).toHaveBeenCalled()
  })

  it("should copy to clipboard", () => {
    // This hack is used below to get around `shallow` not supporting the
    // `useState` hook, and emotion's `useTheme` hook (used by Modal) getting
    // thrown off by us mocking `useContext` above :(
    const updateCopied = jest.fn()
    const useStateSpy = jest.spyOn(React, "useState")
    // @ts-ignore
    useStateSpy.mockImplementation(init => [init, updateCopied])

    const props = getProps()
    const wrapper = shallow(<ThemeCreatorDialog {...props} />)
    const copyBtn = wrapper.find("Button")

    expect(copyBtn.prop("children")).toBe("Copy theme to clipboard")
    copyBtn.simulate("click")
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`[theme]
base="light"
`)
    expect(updateCopied).toHaveBeenCalledWith(true)
  })
})
