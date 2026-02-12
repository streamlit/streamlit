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

import { GridCellKind } from "@glideapps/glide-data-grid"

import renderer, { MarkdownCell } from "./MarkdownCell"

describe("MarkdownCell renderer", () => {
  const mockTheme = {
    cellHorizontalPadding: 8,
  }

  const createMarkdownCell = (
    value: string | null,
    displayValue: string
  ): MarkdownCell => ({
    kind: GridCellKind.Custom,
    data: { kind: "markdown-cell", value, displayValue },
    allowOverlay: true,
    copyData: value ?? "",
    readonly: false,
  })

  describe("isMatch", () => {
    it("correctly identifies markdown cells", () => {
      const markdownCell = createMarkdownCell("# Hello", "Hello")
      expect(renderer.isMatch(markdownCell)).toBe(true)
    })

    it.each([
      ["other-cell", { kind: "other-cell", value: "test" }],
      ["json-cell", { kind: "json-cell", value: { test: "value" } }],
    ])("returns false for %s", (_, data) => {
      const cell = {
        kind: GridCellKind.Custom,
        data,
        allowOverlay: true,
        copyData: "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock
      } as any

      expect(renderer.isMatch(cell)).toBe(false)
    })
  })

  describe("measure", () => {
    it("measures cell width correctly for non-empty content", () => {
      const ctx = {
        measureText: (text: string) => ({ width: text.length * 10 }),
      } as CanvasRenderingContext2D

      const cell = createMarkdownCell("# Hello World", "Hello World")

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- Test mock
      const width = renderer.measure!(ctx, cell, mockTheme as any)
      // "Hello World".length * 10 + cellHorizontalPadding * 2
      expect(width).toBe(11 * 10 + 8 * 2) // 126
    })

    it("measures cell width correctly for empty content", () => {
      const ctx = {
        measureText: (text: string) => ({ width: text.length * 10 }),
      } as CanvasRenderingContext2D

      const cell = createMarkdownCell(null, "")

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- Test mock
      const width = renderer.measure!(ctx, cell, mockTheme as any)
      // 0 + cellHorizontalPadding * 2
      expect(width).toBe(16)
    })
  })

  describe("onPaste", () => {
    it("updates cell data with pasted value", () => {
      const cellData = {
        kind: "markdown-cell" as const,
        value: null,
        displayValue: "",
      }
      const pastedValue = "# New Content"

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Test assertion
      const result = renderer.onPaste!(pastedValue, cellData)

      expect(result).toEqual({
        kind: "markdown-cell",
        value: "# New Content",
        displayValue: "# New Content",
      })
    })

    it("removes line breaks from displayValue for multiline content", () => {
      const cellData = {
        kind: "markdown-cell" as const,
        value: null,
        displayValue: "",
      }
      const pastedValue = "# Title\n\nParagraph text\n- Item 1\n- Item 2"

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Test assertion
      const result = renderer.onPaste!(pastedValue, cellData)

      expect(result).toEqual({
        kind: "markdown-cell",
        value: pastedValue,
        // Note: blank lines become double spaces when replaced
        displayValue: "# Title  Paragraph text - Item 1 - Item 2",
      })
    })
  })

  describe("provideEditor", () => {
    it("returns an editor configuration", () => {
      const mockCell = createMarkdownCell("# Test", "Test")
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-explicit-any -- Test assertion
      const editorConfig = renderer.provideEditor!(mockCell as any)

      expect(editorConfig).toBeDefined()
      expect(
        (editorConfig as { disablePadding?: boolean }).disablePadding
      ).toBe(true)
    })
  })
})
