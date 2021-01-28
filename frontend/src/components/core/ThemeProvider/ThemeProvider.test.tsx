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
import { ThemeProvider as BaseUIThemeProvider } from "baseui"
import { ThemeProvider as EmotionThemeProvider } from "emotion-theming"
import { shallow } from "lib/test_util"
import {
  mainTheme,
  sidebarTheme,
  mainBaseUITheme,
  sidebarBaseUITheme,
} from "theme"
import ThemeProvider from "./ThemeProvider"

describe("ThemeProvider component", () => {
  it("renders both theme providers without an error", () => {
    const wrapper = shallow(
      <ThemeProvider theme={mainTheme} baseuiTheme={mainBaseUITheme}>
        null
      </ThemeProvider>
    )
    expect(wrapper.find(BaseUIThemeProvider).exists()).toBeTruthy()
    expect(wrapper.find(EmotionThemeProvider).exists()).toBeTruthy()
  })

  it("sets the correct themes", () => {
    let wrapper = shallow(
      <ThemeProvider theme={mainTheme} baseuiTheme={mainBaseUITheme}>
        null
      </ThemeProvider>
    )
    expect(wrapper.find(BaseUIThemeProvider).prop("theme")).toEqual(
      mainBaseUITheme
    )
    expect(wrapper.find(EmotionThemeProvider).prop("theme")).toEqual(mainTheme)

    wrapper = shallow(
      <ThemeProvider theme={sidebarTheme} baseuiTheme={sidebarBaseUITheme}>
        null
      </ThemeProvider>
    )
    expect(wrapper.find(BaseUIThemeProvider).prop("theme")).toEqual(
      sidebarBaseUITheme
    )
    expect(wrapper.find(EmotionThemeProvider).prop("theme")).toEqual(
      sidebarTheme
    )
  })

  it("sets the correct default baseui themes", () => {
    const wrapper = shallow(
      <ThemeProvider theme={mainTheme}>null</ThemeProvider>
    )
    expect(wrapper.find(BaseUIThemeProvider).prop("theme")).toEqual(
      mainBaseUITheme
    )
    expect(wrapper.find(EmotionThemeProvider).prop("theme")).toEqual(mainTheme)
  })
})
