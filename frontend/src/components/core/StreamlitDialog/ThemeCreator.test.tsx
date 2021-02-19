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
import { darkTheme, toThemeInput } from "theme"
import ThemeCreator, { Props } from "./ThemeCreator"

const getProps = (extend?: Partial<Props>): Props => ({
  themeInput: toThemeInput(darkTheme.emotion),
  updateThemeInput: jest.fn(),
  ...extend,
})

Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
})

window.HTMLElement.prototype.scrollIntoView = jest.fn()

describe("Renders ThemeCreator", () => {
  const props = getProps()
  const wrapper = shallow(<ThemeCreator {...props} />)

  it("renders closed theme creator crashing", () => {
    expect(wrapper).toMatchSnapshot()
  })

  it("Renders opened theme creator", () => {
    wrapper.find("Button").simulate("click")
    expect(wrapper).toMatchSnapshot()
  })
})

describe("Opened ThemeCreator", () => {
  const props = getProps()
  const wrapper = mount(<ThemeCreator {...props} />)

  beforeEach(() => {
    wrapper.find("Button").simulate("click")
  })

  it("should update theme on color change", () => {
    const colorpicker = wrapper.find(ColorPicker)

    expect(colorpicker).toHaveLength(5)
    colorpicker.at(0).prop("onChange")({
      hex: "3F2028",
    })
    expect(props.updateThemeInput).toHaveBeenCalled()
  })

  it("should update theme on font change", () => {
    const selectbox = wrapper.find(UISelectbox)
    const { options } = selectbox.props()

    expect(options).toHaveLength(
      Object.keys(CustomThemeConfig.FontFamily).length
    )

    selectbox.prop("onChange")(1)
    expect(props.updateThemeInput).toHaveBeenCalled()
  })

  it("should copy to clipboard", () => {
    const themeInput = wrapper.prop("themeInput")
    const copyBtn = wrapper.find("Button")

    expect(copyBtn.prop("children")).toBe("Copy Theme to Clipboard")
    copyBtn.simulate("click")
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`[theme]
primaryColor="${themeInput.primaryColor}"
secondaryColor="${themeInput.secondaryColor}"
backgroundColor="${themeInput.backgroundColor}"
secondaryBackgroundColor=${themeInput.secondaryBackgroundColor}
textColor="${themeInput.textColor}"
font="${themeInput.font}"
`)
  })
})
