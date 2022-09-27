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
import { ThemeProvider as BaseUIThemeProvider } from "baseui"
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react"
import { shallow } from "src/lib/test_util"
import {
  darkTheme,
  darkBaseUITheme,
  lightTheme,
  lightBaseUITheme,
} from "src/theme"
import ThemeProvider from "./ThemeProvider"

describe("ThemeProvider component", () => {
  it("renders both theme providers without an error", () => {
    const wrapper = shallow(
      <ThemeProvider theme={lightTheme.emotion} baseuiTheme={lightBaseUITheme}>
        null
      </ThemeProvider>
    )
    expect(wrapper.find(BaseUIThemeProvider).exists()).toBeTruthy()
    expect(wrapper.find(EmotionThemeProvider).exists()).toBeTruthy()
  })

  it("sets the correct themes", () => {
    let wrapper = shallow(
      <ThemeProvider theme={lightTheme.emotion} baseuiTheme={lightBaseUITheme}>
        null
      </ThemeProvider>
    )
    expect(wrapper.find(BaseUIThemeProvider).prop("theme")).toEqual(
      lightBaseUITheme
    )
    expect(wrapper.find(EmotionThemeProvider).prop("theme")).toEqual(
      lightTheme.emotion
    )

    wrapper = shallow(
      <ThemeProvider theme={darkTheme.emotion} baseuiTheme={darkBaseUITheme}>
        null
      </ThemeProvider>
    )
    expect(wrapper.find(BaseUIThemeProvider).prop("theme")).toEqual(
      darkBaseUITheme
    )
    expect(wrapper.find(EmotionThemeProvider).prop("theme")).toEqual(
      darkTheme.emotion
    )
  })

  it("sets the correct default baseui themes", () => {
    const wrapper = shallow(
      <ThemeProvider theme={lightTheme.emotion}>null</ThemeProvider>
    )
    expect(wrapper.find(BaseUIThemeProvider).prop("theme")).toEqual(
      lightBaseUITheme
    )
    expect(wrapper.find(EmotionThemeProvider).prop("theme")).toEqual(
      lightTheme.emotion
    )
  })
})
