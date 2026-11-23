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

import { createElement } from "react"

import { describe, expect, it } from "vitest"

import { render } from "~lib/test_util"

import { StyledForm } from "./styled-components"

/** The CSS rules of the rendered form's own emotion classes. */
const formCss = (border: boolean): string => {
  const { container } = render(
    createElement(StyledForm, {
      border,
      overflow: "visible",
      isStretchHeight: false,
    })
  )
  const classNames = [...(container.firstElementChild?.classList ?? [])]
    .filter(className => className.startsWith("css-"))
    .map(className => `.${className}`)
  expect(classNames).not.toHaveLength(0)
  return [...document.querySelectorAll("style")]
    .map(style => style.textContent ?? "")
    .filter(rule => classNames.some(className => rule.includes(className)))
    .join("\n")
}

describe("StyledForm print layout", () => {
  it("keeps a bordered form with a chart on one page", () => {
    expect(formCss(true)).toMatch(
      /@media print\{[^}]*:has\(\.stPrintGraphic[^{]*:not\(:has\(\.stPrintFixedWidth[^{]*\{break-inside:avoid/
    )
  })

  it("lets a borderless form break like normal content", () => {
    expect(formCss(false)).not.toContain("break-inside")
  })
})
