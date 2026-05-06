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
    const ctx = {
      measureText: (text: string) => ({ width: text.length * 10 }),
    } as CanvasRenderingContext2D

    it.each([
      ["Hello World", 126], // 11 chars * 10 + padding * 2
      ["", 16], // 0 + padding * 2
    ])(
      "measures cell width for displayValue '%s'",
      (displayValue, expected) => {
        const cell = createMarkdownCell(displayValue || null, displayValue)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- Test mock
        const width = renderer.measure!(ctx, cell, mockTheme as any)
        expect(width).toBe(expected)
      }
    )
  })

  describe("onPaste", () => {
    it.each([
      ["# New Content", "# New Content", "single line content"],
      [
        "# Title\n\nParagraph text\n- Item 1\n- Item 2",
        "# Title  Paragraph text - Item 1 - Item 2",
        "multiline with line breaks removed",
      ],
      ["", "", "empty string clears content"],
      ["   ", "   ", "whitespace preserved"],
    ])(
      "handles paste: %s -> %s (%s)",
      (pastedValue, expectedDisplay, _desc) => {
        const cellData = {
          kind: "markdown-cell" as const,
          value: null,
          displayValue: "",
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Test assertion
        const result = renderer.onPaste!(pastedValue, cellData)

        expect(result).toEqual({
          kind: "markdown-cell",
          value: pastedValue,
          displayValue: expectedDisplay,
        })
      }
    )
  })

  describe("provideEditor", () => {
    it("returns an editor configuration", () => {
      const mockCell = createMarkdownCell("# Test", "Test")
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Test assertion
      const editorConfig = renderer.provideEditor!(mockCell)

      expect(editorConfig).toBeDefined()
      expect(
        (editorConfig as { disablePadding?: boolean }).disablePadding
      ).toBe(true)
    })
  })
})
