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
import ThemeCreator, { Props } from "./ThemeCreator"

const mockSetTheme = jest.fn()
const mockAddThemes = jest.fn()

const getProps = (extend?: Partial<Props>): Props => ({
  hasCustomTheme: false,
  ...extend,
})

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
    const props = getProps()
    const wrapper = shallow(<ThemeCreator {...props} />)
    expect(wrapper).toMatchSnapshot()
    expect(wrapper.find("Button").prop("children")).toBe(
      "Create a new Custom Theme"
    )
  })

  it("Renders closed theme creator with custom theme", () => {
    const props = getProps({ hasCustomTheme: true })
    const wrapper = shallow(<ThemeCreator {...props} />)
    expect(wrapper.find("Button").prop("children")).toBe(
      "Edit Existing Custom Theme"
    )
  })

  it("Renders opened theme creator", () => {
    const props = getProps()
    const wrapper = shallow(<ThemeCreator {...props} />)
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
    const props = getProps()
    const wrapper = mount(<ThemeCreator {...props} />)
    wrapper.find("Button").simulate("click")

    const colorpicker = wrapper.find(ColorPicker)
    expect(colorpicker).toHaveLength(5)

    colorpicker.at(0).prop("onChange")("pink")
    expect(mockAddThemes).toHaveBeenCalled()
    expect(mockAddThemes.mock.calls[1][0][0].emotion.colors.primary).toBe(
      "pink"
    )

    expect(mockSetTheme).toHaveBeenCalled()
    expect(mockSetTheme.mock.calls[1][0].emotion.colors.primary).toBe("pink")
  })

  it("should update theme on font change", () => {
    const props = getProps()
    const wrapper = mount(<ThemeCreator {...props} />)
    wrapper.find("Button").simulate("click")
    const selectbox = wrapper.find(UISelectbox)
    const { options } = selectbox.props()

    expect(options).toHaveLength(
      Object.keys(CustomThemeConfig.FontFamily).length
    )

    selectbox.prop("onChange")(2)
    expect(mockAddThemes).toHaveBeenCalled()
    expect(
      mockAddThemes.mock.calls[1][0][0].emotion.genericFonts.bodyFont
    ).toBe(fonts.monospace)

    expect(mockSetTheme).toHaveBeenCalled()
    expect(mockSetTheme.mock.calls[1][0].emotion.genericFonts.bodyFont).toBe(
      fonts.monospace
    )
  })

  it("should copy to clipboard", () => {
    const { colors } = baseTheme.emotion
    const props = getProps()
    const wrapper = mount(<ThemeCreator {...props} />)
    wrapper.find("Button").simulate("click")
    const copyBtn = wrapper.find("Button")

    expect(copyBtn.prop("children")).toBe("Copy Theme to Clipboard")
    copyBtn.simulate("click")
    // TODO: Karrie; fix font expected result
    // font="sans serif"
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`[theme]
primaryColor="${colors.primary}"
secondaryColor="${colors.secondary}"
backgroundColor="${colors.bgColor}"
secondaryBackgroundColor="${colors.secondaryBg}"
textColor="${colors.bodyText}"
font="0"
`)
  })
})
