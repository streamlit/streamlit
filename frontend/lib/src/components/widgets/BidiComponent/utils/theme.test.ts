/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { describe, expect, expectTypeOf, it } from "vitest"

import {
  StreamlitTheme,
  StreamlitThemeCssProperties,
} from "@streamlit/component-v2-lib"
import { ICustomThemeConfig } from "@streamlit/protobuf"

import {
  extractComponentsV2Theme,
  objectToCssCustomProperties,
} from "~lib/components/widgets/BidiComponent/utils/theme"
import { mockTheme } from "~lib/mocks/mockTheme"

describe("BidiComponent/utils/theme", () => {
  describe("objectToCssCustomProperties", () => {
    const createTheme = (
      overrides: Partial<StreamlitTheme> = {}
    ): StreamlitTheme => ({
      primaryColor: "#ff0000",
      backgroundColor: "#ffffff",
      secondaryBackgroundColor: "#f0f0f0",
      textColor: "#000000",
      linkColor: "#0000ff",
      linkUnderline: true,
      font: "Source Sans Pro, sans-serif",
      headingFont: "Source Sans Pro, sans-serif",
      codeFont: "Source Code Pro, monospace",
      baseRadius: "0.5rem",
      buttonRadius: "0.5rem",
      baseFontSize: "16px",
      baseFontWeight: 400,
      codeFontWeight: 400,
      codeFontSize: "0.875rem",
      headingFontSizes: [
        "2.75rem",
        "2.25rem",
        "1.75rem",
        "1.5rem",
        "1.25rem",
        "1rem",
      ],
      headingFontSize1: "2.75rem",
      headingFontSize2: "2.25rem",
      headingFontSize3: "1.75rem",
      headingFontSize4: "1.5rem",
      headingFontSize5: "1.25rem",
      headingFontSize6: "1rem",
      headingFontWeights: [700, 600, 600, 600, 600, 600],
      headingFontWeight1: 700,
      headingFontWeight2: 600,
      headingFontWeight3: 600,
      headingFontWeight4: 600,
      headingFontWeight5: 600,
      headingFontWeight6: 600,
      borderColor: "#eeeeee",
      borderColorLight: "#f5f5f5",
      dataframeBorderColor: "#f0f0f0",
      dataframeHeaderBackgroundColor: "#fafafa",
      codeBackgroundColor: "#f7f7f7",
      codeTextColor: "#00aa00",
      headingColor: "#111111",
      chartCategoricalColors: Array(10).fill("#000000"),
      chartSequentialColors: Array(10).fill("#111111"),
      chartDivergingColors: Array(10).fill("#222222"),
      redColor: "#ff0000",
      orangeColor: "#ff8800",
      yellowColor: "#ffee00",
      blueColor: "#0000ff",
      greenColor: "#00ff00",
      violetColor: "#aa00ff",
      grayColor: "#888888",
      redBackgroundColor: "rgba(255,0,0,0.1)",
      orangeBackgroundColor: "rgba(255,136,0,0.1)",
      yellowBackgroundColor: "rgba(255,238,0,0.1)",
      blueBackgroundColor: "rgba(0,0,255,0.1)",
      greenBackgroundColor: "rgba(0,255,0,0.1)",
      violetBackgroundColor: "rgba(170,0,255,0.1)",
      grayBackgroundColor: "rgba(136,136,136,0.1)",
      widgetBorderColor: "transparent",

      redTextColor: "#ff0000",
      orangeTextColor: "#ff8800",
      yellowTextColor: "#ffee00",
      blueTextColor: "#0000ff",
      greenTextColor: "#00ff00",
      violetTextColor: "#aa00ff",
      grayTextColor: "#888888",

      metricValueFontSize: null,
      metricValueFontWeight: null,
      ...overrides,
    })

    it("converts theme to CSS custom properties", () => {
      const input = createTheme()
      const result = objectToCssCustomProperties(input)
      expect(result["--st-primary-color"]).toBe("#ff0000")
      expect(result["--st-background-color"]).toBe("#ffffff")
      expect(result["--st-font"]).toBe("Source Sans Pro, sans-serif")
      expect(result["--st-widget-border-color"]).toBe("transparent")
    })

    it.each([
      ["undefined", undefined],
      ["null", null],
    ])(
      "serializes explicitly %s non-widget properties as CSS-wide 'unset'",
      (_label, value) => {
        const themeWithOverrides = createTheme({
          borderColor: value as never,
        })

        const result = objectToCssCustomProperties(themeWithOverrides)
        const dict = result as unknown as Record<string, string>

        expect(dict["--st-border-color"]).toBe("unset")
        expectTypeOf(dict["--st-border-color"]).toEqualTypeOf<string>()
      }
    )

    it.each([
      [true, "1"],
      [false, "0"],
    ])("serializes boolean linkUnderline %s to '%s'", (value, expected) => {
      const result = objectToCssCustomProperties(
        createTheme({ linkUnderline: value })
      )
      expect(result["--st-link-underline"]).toBe(expected)
      expectTypeOf(result["--st-link-underline"]).toEqualTypeOf<string>()
    })

    it.each<[key: keyof StreamlitTheme, value: number, expectedKey: string]>([
      ["baseFontWeight", 500, "--st-base-font-weight"],
      ["codeFontWeight", 700, "--st-code-font-weight"],
    ])("stringifies number %s", (propName, value, expectedKey) => {
      const overrides = { [propName]: value } as Partial<StreamlitTheme>
      const result = objectToCssCustomProperties(createTheme(overrides))
      const dict = result as unknown as Record<string, string>
      expect(dict[expectedKey]).toBe(String(value))
    })

    it.each<
      [
        key: keyof StreamlitTheme,
        value: string | number,
        expectedKey: keyof StreamlitThemeCssProperties,
      ]
    >([
      ["headingFontSize1", "2.75rem", "--st-heading-font-size-1"],
      ["headingFontSize2", "2.25rem", "--st-heading-font-size-2"],
      ["headingFontSize3", "1.75rem", "--st-heading-font-size-3"],
      ["headingFontSize4", "1.5rem", "--st-heading-font-size-4"],
      ["headingFontSize5", "1.25rem", "--st-heading-font-size-5"],
      ["headingFontSize6", "1rem", "--st-heading-font-size-6"],
      ["headingFontWeight1", 700, "--st-heading-font-weight-1"],
      ["headingFontWeight2", 600, "--st-heading-font-weight-2"],
      ["headingFontWeight3", 600, "--st-heading-font-weight-3"],
      ["headingFontWeight4", 600, "--st-heading-font-weight-4"],
      ["headingFontWeight5", 600, "--st-heading-font-weight-5"],
      ["headingFontWeight6", 600, "--st-heading-font-weight-6"],
    ])(
      "converts individual heading property %s to CSS custom property",
      (propName, value, expectedKey) => {
        const overrides: Partial<StreamlitTheme> = { [propName]: value }
        const result = objectToCssCustomProperties(createTheme(overrides))

        expect(result[expectedKey]).toBe(String(value))
      }
    )

    it("serializes baseFontSize with px unit", () => {
      const result = objectToCssCustomProperties(
        createTheme({ baseFontSize: "14px" })
      )
      expect(result["--st-base-font-size"]).toBe("14px")
    })

    it.each<
      [
        key: keyof StreamlitTheme,
        value: string[] | number[],
        expectedKey: string,
      ]
    >([
      [
        "headingFontSizes",
        ["3rem", "2.5rem", "2rem", "1.5rem", "1.25rem", "1rem"],
        "--st-heading-font-sizes",
      ],
      [
        "headingFontWeights",
        [800, 700, 600, 600, 600, 500],
        "--st-heading-font-weights",
      ],
      [
        "chartCategoricalColors",
        [
          "#111111",
          "#222222",
          "#333333",
          "#444444",
          "#555555",
          "#666666",
          "#777777",
          "#888888",
          "#999999",
          "#aaaaaa",
        ],
        "--st-chart-categorical-colors",
      ],
    ])(
      "serializes array %s as comma-joined string",
      (propName, value, key) => {
        const overrides = {
          [propName]: value as never,
        } as Partial<StreamlitTheme>
        const result = objectToCssCustomProperties(createTheme(overrides))
        const dict = result as unknown as Record<string, string>
        expect(dict[key]).toBe((value as (string | number)[]).join(","))
      }
    )

    it("supports custom prefix", () => {
      const result = objectToCssCustomProperties(createTheme(), "--custom")
      const custom = result as unknown as Record<string, string>
      expect(custom["--custom-primary-color"]).toBe("#ff0000")
      expect(custom["--custom-background-color"]).toBe("#ffffff")
      expect(custom["--custom-text-color"]).toBe("#000000")
    })
  })

  // Protobuf sync enforcement for Components V2 theme mapping
  //
  // Source of truth: `CustomThemeConfig` in
  // `proto/streamlit/proto/NewSession.proto`. The generated TS interface
  // (`ICustomThemeConfig`) comes from `@streamlit/protobuf`. This suite ensures
  // that any new theme field added in the protobuf is either (a) mapped in
  // `extractComponentsV2Theme`, or (b) explicitly ignored here with rationale.
  // This keeps the mapping self-documenting and future-proof.
  //
  // When a failure happens:
  // - Type failure (missing key in the guard):
  //   1) Add the new key to `allProtoFieldsGuard` below.
  //   2) Either map it in `extractComponentsV2Theme` or add it to
  //      `protoFieldsToIgnore` with a brief justification.
  // - Test failure (expected key not mapped):
  //   1) Add the mapping in `extractComponentsV2Theme`, or
  //   2) Add the key to `protoFieldsToIgnore` if we intentionally do not expose
  //      it.
  //
  // Goal: Newly added theming options are acknowledged and handled
  // deliberately.
  describe("#extractComponentsV2Theme", () => {
    // These are fields from the CustomThemeConfig proto message that we don't
    // expect to be present in the extracted theme object.
    const protoFieldsToIgnore: Array<keyof ICustomThemeConfig> = [
      "base",
      "bodyFont",
      "fontFaces",
      "fontSources",
      "showWidgetBorder",
      "showSidebarBorder",
      "sidebar",
      "light",
      "dark",
    ]

    // This is a helper object that ensures we have an exhaustive list of all
    // keys from the ICustomThemeConfig interface. If a new field is added to
    // the protobuf, this object will fail to compile until the new key is
    // added.
    const allProtoFieldsGuard: Record<keyof ICustomThemeConfig, null> = {
      primaryColor: null,
      backgroundColor: null,
      secondaryBackgroundColor: null,
      textColor: null,
      linkColor: null,
      linkUnderline: null,
      headingFont: null,
      bodyFont: null,
      codeFont: null,
      base: null,
      baseRadius: null,
      buttonRadius: null,
      baseFontSize: null,
      baseFontWeight: null,
      codeFontWeight: null,
      codeFontSize: null,
      headingFontSizes: null,
      headingFontWeights: null,
      metricValueFontSize: null,
      metricValueFontWeight: null,

      borderColor: null,
      dataframeBorderColor: null,
      dataframeHeaderBackgroundColor: null,
      showWidgetBorder: null,
      redColor: null,
      orangeColor: null,
      yellowColor: null,
      blueColor: null,
      greenColor: null,
      violetColor: null,
      grayColor: null,

      redBackgroundColor: null,
      orangeBackgroundColor: null,
      yellowBackgroundColor: null,
      blueBackgroundColor: null,
      greenBackgroundColor: null,
      violetBackgroundColor: null,
      grayBackgroundColor: null,

      redTextColor: null,
      orangeTextColor: null,
      yellowTextColor: null,
      blueTextColor: null,
      greenTextColor: null,
      violetTextColor: null,
      grayTextColor: null,

      codeBackgroundColor: null,
      codeTextColor: null,

      chartCategoricalColors: null,
      chartSequentialColors: null,
      chartDivergingColors: null,

      fontFaces: null,
      fontSources: null,
      showSidebarBorder: null,

      sidebar: null,
      light: null,
      dark: null,
    }
    const allProtoFields = Object.keys(
      allProtoFieldsGuard
    ) as (keyof ICustomThemeConfig)[]

    it("contains a mapping for all themeable properties from protobuf", () => {
      const extractedTheme = extractComponentsV2Theme(mockTheme.emotion)
      const extractedThemeKeys = Object.keys(extractedTheme)

      const expectedThemeKeys = allProtoFields.filter(
        field => !protoFieldsToIgnore.includes(field)
      )

      expectedThemeKeys.forEach(expectedKey => {
        expect(extractedThemeKeys).toContain(expectedKey)
      })

      protoFieldsToIgnore.forEach(ignoredKey => {
        expect(
          extractedThemeKeys,
          `Expected ignored protobuf theme field "${ignoredKey}" to be omitted from extracted theme keys.`
        ).not.toContain(ignoredKey)
      })
    })
  })
})
