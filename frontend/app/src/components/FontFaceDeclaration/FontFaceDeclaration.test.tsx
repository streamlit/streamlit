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

import { render } from "@streamlit/lib/testing"
import { type FontFace } from "@streamlit/protobuf"

import FontFaceDeclaration from "./FontFaceDeclaration"

type TestFontFace = FontFace.$Properties & { weight?: string | number }

/** Collect Emotion/global style sheet text injected into the document. */
function getInjectedStyleText(): string {
  return Array.from(document.querySelectorAll("style"))
    .map(el => el.textContent ?? "")
    .join("\n")
}

/** Extract generated @font-face rules so assertions ignore unrelated stylesheets. */
function getFontFaceRules(styleText: string): string {
  return (styleText.match(/@font-face\s*\{[^}]*\}/g) ?? []).join("\n")
}

function renderFontFaces(fontFaces: TestFontFace[]): string {
  render(<FontFaceDeclaration fontFaces={fontFaces} />)
  return getFontFaceRules(getInjectedStyleText())
}

describe("FontFaceDeclaration", () => {
  it("injects @font-face CSS and omits unset optional fields", () => {
    // Emotion minifies injected CSS (no spaces after colons).
    // Assert optional descriptors are omitted from the generated @font-face rule.
    const fontFaceCss = renderFontFaces([
      {
        family: "TestFont",
        url: "https://example.com/test.woff2",
      },
    ])

    expect(fontFaceCss).toContain("@font-face")
    expect(fontFaceCss).toContain("font-family:TestFont")
    expect(fontFaceCss).toContain(
      'src:url(https://example.com/test.woff2) format("woff2")'
    )
    expect(fontFaceCss).toContain("font-display:swap")
    expect(fontFaceCss).not.toContain("font-style:")
    expect(fontFaceCss).not.toContain("font-weight:")
    expect(fontFaceCss).not.toContain("unicode-range:")
  })

  it("prefers weightRange over deprecated weight", () => {
    const styleText = renderFontFaces([
      {
        family: "WeightRangeFont",
        url: "https://example.com/weight.woff2",
        weight: "400",
        weightRange: "100 900",
      },
    ])

    expect(styleText).toContain("font-weight:100 900")
    expect(styleText).not.toContain("font-weight:400")
  })

  it("falls back to deprecated weight without weightRange", () => {
    const styleText = renderFontFaces([
      {
        family: "LegacyWeightFont",
        url: "https://example.com/legacy.woff2",
        weight: 700,
      },
    ])

    expect(styleText).toContain("font-weight:700")
  })

  it("includes style and unicodeRange when provided", () => {
    const styleText = renderFontFaces([
      {
        family: "StyledFont",
        url: "https://example.com/styled.woff2",
        style: "italic",
        unicodeRange: "U+0000-00FF",
        weightRange: "400",
      },
    ])

    expect(styleText).toContain("font-style:italic")
    expect(styleText).toContain("unicode-range:U+0000-00FF")
    expect(styleText).toContain("font-weight:400")
  })

  it("renders multiple font faces", () => {
    const styleText = renderFontFaces([
      {
        family: "FirstFont",
        url: "https://example.com/first.woff2",
        weightRange: "400",
      },
      {
        family: "SecondFont",
        url: "https://example.com/second.woff2",
        style: "normal",
        unicodeRange: "U+0100-024F",
      },
    ])

    expect(styleText).toContain("font-family:FirstFont")
    expect(styleText).toContain(
      'src:url(https://example.com/first.woff2) format("woff2")'
    )
    expect(styleText).toContain("font-family:SecondFont")
    expect(styleText).toContain(
      'src:url(https://example.com/second.woff2) format("woff2")'
    )
    expect(styleText).toContain("font-weight:400")
    expect(styleText).toContain("font-style:normal")
    expect(styleText).toContain("unicode-range:U+0100-024F")
  })
})
