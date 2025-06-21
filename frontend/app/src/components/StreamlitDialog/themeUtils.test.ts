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

import { darkTheme, lightTheme, toThemeInput } from "@streamlit/lib"
import { CustomThemeConfig } from "@streamlit/protobuf"

import { toMinimalToml } from "./themeUtils"

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
