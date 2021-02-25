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
import { CustomThemeConfig } from "autogen/proto"
import { mount, shallow } from "lib/test_util"
import ColorPicker from "components/shared/ColorPicker"
import UISelectbox from "components/shared/Dropdown"
import { baseTheme } from "theme"
import { fonts } from "theme/primitives/typography"
import ThemeCreator from "./ThemeCreator"

const mockSetTheme = jest.fn()
const mockAddThemes = jest.fn()

Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
})

window.HTMLElement.prototype.scrollIntoView = jest.fn()

describe("Renders ThemeCreator", () => {
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

  it("renders closed theme creator without custom theme", () => {
    const wrapper = shallow(<ThemeCreator />)
    expect(wrapper).toMatchSnapshot()
  })

  it("Renders opened theme creator", () => {
    const wrapper = shallow(<ThemeCreator />)
    wrapper.find("Button").simulate("click")
    expect(wrapper).toMatchSnapshot()
  })
})

describe("Opened ThemeCreator", () => {
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

  it("should update theme on color change", () => {
    const wrapper = mount(<ThemeCreator />)
    wrapper.find("Button").simulate("click")

    const colorpicker = wrapper.find(ColorPicker)
    expect(colorpicker).toHaveLength(5)

    colorpicker.at(0).prop("onChange")("pink")
    expect(mockAddThemes).toHaveBeenCalled()
    expect(mockAddThemes.mock.calls[0][0][0].emotion.colors.primary).toBe(
      "pink"
    )

    expect(mockSetTheme).toHaveBeenCalled()
    expect(mockSetTheme.mock.calls[0][0].emotion.colors.primary).toBe("pink")
  })

  it("should update theme on font change", () => {
    const wrapper = mount(<ThemeCreator />)
    wrapper.find("Button").simulate("click")
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
    const wrapper = mount(<ThemeCreator />)
    wrapper.find("Button").simulate("click")
    const selectbox = wrapper.find(UISelectbox)
    const { options, value } = selectbox.props()

    expect(options).toHaveLength(
      Object.keys(CustomThemeConfig.FontFamily).length
    )
    expect(value).toBe(0)
  })

  it("should copy to clipboard", () => {
    const { colors } = baseTheme.emotion
    const wrapper = mount(<ThemeCreator />)
    wrapper.find("Button").simulate("click")
    const copyBtn = wrapper.find("Button")

    expect(copyBtn.prop("children")).toBe("Copy theme to clipboard")
    copyBtn.simulate("click")
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`[theme]
primaryColor="${colors.primary}"
secondaryColor="${colors.secondary}"
backgroundColor="${colors.bgColor}"
secondaryBackgroundColor="${colors.secondaryBg}"
textColor="${colors.bodyText}"
font="sans serif"
`)
    expect(copyBtn.text()).toBe("Copied to clipboard ")
  })
})
