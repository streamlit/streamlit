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

import { Table } from "@streamlit/protobuf"

import { render } from "~lib/test_util"

import {
  StyledTable,
  StyledTableBorder,
  StyledTableContainer,
} from "./styled-components"

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

describe("st.table print layout", () => {
  it("lets the table container fragment across pages", () => {
    const css = cssOf(render(createElement(StyledTableContainer)))

    expect(css).toMatch(
      /@media print\{[^}]*break-inside:auto[^}]*overflow:visible/
    )
  })

  it("releases and clips a content-height border wrapper in print", () => {
    const css = cssOf(
      render(
        createElement(StyledTableBorder, {
          borderMode: Table.BorderMode.ALL,
        })
      )
    )

    expect(css).toMatch(
      /@media print\{[^}]*break-inside:auto[^}]*height:auto;max-height:none;overflow:visible;[^}]*clip-path:inset\(0\)/
    )
  })

  it("keeps the scroll box of a fixed-height table in print", () => {
    const containerCss = cssOf(
      render(createElement(StyledTableContainer, { hasReservedHeight: true }))
    )
    const borderCss = cssOf(
      render(
        createElement(StyledTableBorder, {
          borderMode: Table.BorderMode.ALL,
          hasScrollableHeight: true,
          hasReservedHeight: true,
        })
      )
    )

    expect(containerCss).toContain("overflow:clip")
    expect(containerCss).not.toContain("@media print")
    expect(borderCss).toContain("overflow:auto")
    expect(borderCss).toContain("height:100%")
    expect(borderCss).not.toContain("@media print")
  })

  it("keeps a stretch-height table clipped in print without filling the border", () => {
    const containerCss = cssOf(
      render(createElement(StyledTableContainer, { hasReservedHeight: true }))
    )
    const borderCss = cssOf(
      render(
        createElement(StyledTableBorder, {
          borderMode: Table.BorderMode.ALL,
          hasReservedHeight: true,
        })
      )
    )

    expect(containerCss).toContain("overflow:clip")
    expect(containerCss).not.toContain("@media print")
    expect(borderCss).toContain("overflow:auto")
    expect(borderCss).not.toContain("height:100%")
    expect(borderCss).not.toContain("@media print")
  })

  it("prints as a splitting table with a repeating header", () => {
    const css = cssOf(render(createElement(StyledTable)))

    expect(css).toMatch(/@media print\{[^}]*display:table;break-inside:auto/)
    expect(css).toMatch(/thead\{display:table-header-group;break-inside:avoid/)
  })
})
