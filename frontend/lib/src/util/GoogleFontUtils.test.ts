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
import { fontFaceUrlBuilder, webfontUrlBuilder } from "./GoogleFontUtils"

/**
 * Tests for fontFaceUrlBuilder function.
 */
describe("fontFaceUrlBuilder", () => {
  /**
   * Test that it constructs a correct URL with only the required family parameter.
   */
  it("constructs a basic URL with one family", () => {
    const url = fontFaceUrlBuilder({
      families: [{ family: "Roboto" }],
    })
    expect(url).toBe("https://fonts.googleapis.com/css?family=Roboto")
  })

  /**
   * Test that it correctly encodes font family names, replacing spaces with '+'.
   */
  it("encodes font family names correctly", () => {
    const url = fontFaceUrlBuilder({
      families: [{ family: "Open Sans" }],
    })
    expect(url).toContain("Open+Sans")
  })

  /**
   * Test that it correctly handles multiple families and variants.
   */
  it("handles multiple families and variants", () => {
    const url = fontFaceUrlBuilder({
      families: [
        { family: "Open Sans", variants: ["400"] },
        { family: "Roboto", variants: ["700"] },
      ],
    })
    expect(url).toBe(
      "https://fonts.googleapis.com/css?family=Open+Sans:400|Roboto:700"
    )
  })

  /**
   * Test for correct handling of additional parameters like subsets, sort, and display.
   */
  it("handles additional parameters", () => {
    const url = fontFaceUrlBuilder({
      families: [{ family: "Roboto", variants: ["400", "700"] }],
      subsets: ["latin", "greek"],
      sort: "popularity",
      display: "swap",
    })
    expect(url).toBe(
      "https://fonts.googleapis.com/css?family=Roboto:400,700&subset=latin,greek&sort=popularity"
    )
  })

  /**
   * Test for the behavior when no families are provided, which should throw an error.
   */
  it("throws an error when no families are provided", () => {
    expect(() => fontFaceUrlBuilder({ families: [] })).toThrow(
      "No font families provided"
    )
  })
})

/**
 * Tests for webfontUrlBuilder function.
 */
describe("webfontUrlBuilder", () => {
  beforeAll(() => {
    process.env.GOOGLE_API_KEY = "test-api-key"
  })

  /**
   * Test that it throws an error if GOOGLE_API_KEY is not defined.
   */
  it("throws an error if GOOGLE_API_KEY is not defined", () => {
    delete process.env.GOOGLE_API_KEY // Temporarily remove the API key
    expect(() => webfontUrlBuilder({ subset: "latin" })).toThrow(
      "GOOGLE_API_KEY is not defined"
    )
    process.env.GOOGLE_API_KEY = "test-api-key" // Restore the API key for further tests
  })

  /**
   * Test that it constructs a correct URL with default arguments.
   */
  it("constructs a correct URL with defaults", () => {
    const url = webfontUrlBuilder({
      family: "Roboto",
      subset: "latin",
      sort: "alpha",
    })
    expect(url).toBe(
      "https://www.googleapis.com/webfonts/v1/webfonts?key=test-api-key&family=Roboto&subset=latin&sort=alpha"
    )
  })

  /**
   * Test that it correctly encodes font family names.
   */
  it("encodes font family names correctly", () => {
    const url = webfontUrlBuilder({
      family: "Open Sans",
      subset: "latin",
    })
    expect(url).toContain("Open+Sans")
  })

  /**
   * Test that it correctly handles missing optional parameters.
   */
  it("handles missing optional parameters gracefully", () => {
    const url = webfontUrlBuilder({
      family: "Roboto",
      subset: "latin",
    })
    expect(url).toBe(
      "https://www.googleapis.com/webfonts/v1/webfonts?key=test-api-key&family=Roboto&subset=latin"
    )
  })

  /**
   * Test that it includes all supported parameters in the URL.
   */
  it("includes all parameters", () => {
    const url = webfontUrlBuilder({
      capability: "WOFF2",
      family: "Lato",
      sort: "date",
      subset: "greek",
    })
    expect(url).toBe(
      "https://www.googleapis.com/webfonts/v1/webfonts?key=test-api-key&family=Lato&subset=greek&sort=date"
    )
  })

  /**
   * Test for the expected failure case when an empty object is passed.
   */
  it("returns the base URL when no args are provided", () => {
    const url = webfontUrlBuilder({})
    expect(url).toBe(
      "https://www.googleapis.com/webfonts/v1/webfonts?key=test-api-key"
    )
  })
})
