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
