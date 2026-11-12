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

import { StyledResizableContainer } from "./styled-components"

function cssOf(result: ReturnType<typeof render>): string {
  const classNames = [
    ...(result.container.firstElementChild?.classList ?? []),
  ].filter(className => className.startsWith("css-"))
  return [...document.querySelectorAll("style")]
    .map(style => style.textContent ?? "")
    .filter(rule =>
      classNames.some(className => rule.includes(`.${className}`))
    )
    .join("\n")
}

describe("StyledResizableContainer print layout", () => {
  it("clips a grid wider than its printed container when no print table is built", () => {
    const css = cssOf(
      render(
        createElement(StyledResizableContainer, {
          isInHorizontalLayout: false,
          minHeight: 100,
          disableResize: false,
        })
      )
    )

    expect(css).toContain(":not(:has(.stDataFramePrintTable)){overflow:clip;}")
  })

  it("lets a print table fragment across pages and hides the canvas", () => {
    const css = cssOf(
      render(
        createElement(StyledResizableContainer, {
          isInHorizontalLayout: false,
          minHeight: 100,
          disableResize: false,
        })
      )
    )

    expect(css).toMatch(
      /:has\(\.stDataFramePrintTable\)\{break-inside:auto[^}]*min-width:0[^}]*clip-path:inset\(0\)/
    )
    expect(css).toMatch(
      /:has\(\.stDataFramePrintTable\) \.stDataFrameResizable,.*:has\(\.stDataFramePrintTable\) \.stElementToolbar\{display:none/
    )
    expect(css).toMatch(/\.stDataFramePrintTable\{[^}]*break-inside:auto/)
    expect(css).toMatch(
      /\.stDataFramePrintTable thead\{display:table-header-group;break-inside:avoid/
    )
  })
})

describe("StyledResizableContainer layout", () => {
  it("top-aligns the inline-block grid so no descender space is added below it", () => {
    const { container } = render(
      createElement(StyledResizableContainer, {
        isInHorizontalLayout: false,
        minHeight: 100,
        disableResize: false,
      })
    )

    expect(container.firstElementChild).toHaveStyle({
      display: "inline-block",
      verticalAlign: "top",
    })
  })
})
