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

import type { ComponentType } from "react"

import { GridCellKind } from "@glideapps/glide-data-grid"
import { cleanup, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { render } from "~lib/test_util"

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
      ["# New Content", "# New Content"],
      [
        "# Title\n\nParagraph text\n- Item 1\n- Item 2",
        "# Title  Paragraph text - Item 1 - Item 2",
      ],
      ["", ""],
      ["   ", "   "],
    ])(
      "handles paste: '%s' -> displayValue: '%s'",
      (pastedValue, expectedDisplay) => {
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

describe("MarkdownCellEditor", () => {
  let MarkdownCellEditor: ComponentType<Record<string, unknown>>

  beforeAll(() => {
    const mockCell = {
      kind: GridCellKind.Custom,
      data: { kind: "markdown-cell", value: "# Test", displayValue: "Test" },
      allowOverlay: true,
      copyData: "# Test",
      readonly: false,
    } as MarkdownCell

    const result = renderer.provideEditor?.(mockCell)
    if (result === undefined || !("editor" in result)) {
      throw new Error("provideEditor did not return an editor")
    }
    MarkdownCellEditor = result.editor as ComponentType<
      Record<string, unknown>
    >
  })

  afterEach(() => {
    cleanup()
  })

  const createMockCellValue = (
    value: string | null,
    readonly = false
  ): MarkdownCell => ({
    kind: GridCellKind.Custom,
    data: {
      kind: "markdown-cell",
      value,
      displayValue: value ?? "",
    },
    allowOverlay: true,
    copyData: value ?? "",
    readonly,
  })

  it("hides the Edit button when cell is readonly", () => {
    const readonlyCell = createMockCellValue("# Readonly content", true)

    render(
      <MarkdownCellEditor
        value={readonlyCell}
        onChange={vi.fn()}
        onFinishedEditing={vi.fn()}
      />
    )

    // Should show viewer, not editor
    expect(screen.getByTestId("stMarkdownColumnViewer")).toBeVisible()
    // Edit button should NOT be present
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull()
  })

  it("shows the Edit button when cell is editable", () => {
    const editableCell = createMockCellValue("# Editable content", false)

    render(
      <MarkdownCellEditor
        value={editableCell}
        onChange={vi.fn()}
        onFinishedEditing={vi.fn()}
      />
    )

    // Should show viewer with Edit button present (button has opacity: 0 until hover)
    expect(screen.getByTestId("stMarkdownColumnViewer")).toBeVisible()
    // Edit button should be present in DOM (even though visually hidden until hover)
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
  })

  it("clicking Edit then Save calls onChange with new value and displayValue", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const originalValue = "# Original"
    const editableCell = createMockCellValue(originalValue, false)

    render(
      <MarkdownCellEditor
        value={editableCell}
        onChange={onChange}
        onFinishedEditing={vi.fn()}
      />
    )

    // Click edit button
    await user.click(screen.getByRole("button", { name: "Edit" }))

    // Should now show editor
    expect(screen.getByTestId("stMarkdownColumnEditor")).toBeVisible()

    // Type new content
    const textarea = screen.getByRole("textbox")
    await user.clear(textarea)
    await user.type(textarea, "# New Title\nNew line")

    // Click save button
    await user.click(screen.getByRole("button", { name: /Save/ }))

    // onChange should have been called with the new value
    expect(onChange).toHaveBeenCalledTimes(1)
    const callArg = onChange.mock.calls[0][0] as MarkdownCell
    expect(callArg.data.value).toBe("# New Title\nNew line")
    // displayValue should have line breaks removed
    expect(callArg.data.displayValue).toBe("# New Title New line")

    // Should be back in viewer mode
    expect(screen.getByTestId("stMarkdownColumnViewer")).toBeVisible()
  })

  it("clicking Edit then pressing Escape does NOT call onChange", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const originalValue = "# Original"
    const editableCell = createMockCellValue(originalValue, false)

    render(
      <MarkdownCellEditor
        value={editableCell}
        onChange={onChange}
        onFinishedEditing={vi.fn()}
      />
    )

    // Click edit button
    await user.click(screen.getByRole("button", { name: "Edit" }))

    // Type some content
    const textarea = screen.getByRole("textbox")
    await user.type(textarea, " modified content")

    // Press Escape to cancel
    await user.keyboard("{Escape}")

    // onChange should NOT have been called
    expect(onChange).not.toHaveBeenCalled()

    // Should be back in viewer mode
    expect(screen.getByTestId("stMarkdownColumnViewer")).toBeVisible()
  })

  it("clicking Edit then Cancel button does NOT call onChange", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const editableCell = createMockCellValue("# Original", false)

    render(
      <MarkdownCellEditor
        value={editableCell}
        onChange={onChange}
        onFinishedEditing={vi.fn()}
      />
    )

    // Click edit button
    await user.click(screen.getByRole("button", { name: "Edit" }))

    // Type some content
    const textarea = screen.getByRole("textbox")
    await user.type(textarea, " modified content")

    // Click cancel button
    await user.click(screen.getByRole("button", { name: /Cancel/ }))

    // onChange should NOT have been called
    expect(onChange).not.toHaveBeenCalled()

    // Should be back in viewer mode
    expect(screen.getByTestId("stMarkdownColumnViewer")).toBeVisible()
  })
})
