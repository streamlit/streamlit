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

  it("clicking Edit then Save commits the new value and finishes editing", async () => {
    const user = userEvent.setup()
    const onFinishedEditing = vi.fn()
    const originalValue = "# Original"
    const editableCell = createMockCellValue(originalValue, false)

    render(
      <MarkdownCellEditor
        value={editableCell}
        onChange={vi.fn()}
        onFinishedEditing={onFinishedEditing}
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

    // Saving commits the value and finishes editing (closing the overlay).
    expect(onFinishedEditing).toHaveBeenCalledTimes(1)
    const committedCell = onFinishedEditing.mock.calls[0][0] as MarkdownCell
    expect(committedCell.data.value).toBe("# New Title\nNew line")
    // displayValue should have line breaks removed
    expect(committedCell.data.displayValue).toBe("# New Title New line")
  })

  it("pressing Escape cancels editing without committing a value", async () => {
    const user = userEvent.setup()
    const onFinishedEditing = vi.fn()
    const originalValue = "# Original"
    const editableCell = createMockCellValue(originalValue, false)

    render(
      <MarkdownCellEditor
        value={editableCell}
        onChange={vi.fn()}
        onFinishedEditing={onFinishedEditing}
      />
    )

    // Click edit button
    await user.click(screen.getByRole("button", { name: "Edit" }))

    // Type some content
    const textarea = screen.getByRole("textbox")
    await user.type(textarea, " modified content")

    // Press Escape to cancel
    await user.keyboard("{Escape}")

    // Editing finishes with no committed value (undefined = discard changes).
    expect(onFinishedEditing).toHaveBeenCalledTimes(1)
    expect(onFinishedEditing.mock.calls[0][0]).toBeUndefined()
  })

  it("clicking Cancel finishes editing without committing a value", async () => {
    const user = userEvent.setup()
    const onFinishedEditing = vi.fn()
    const editableCell = createMockCellValue("# Original", false)

    render(
      <MarkdownCellEditor
        value={editableCell}
        onChange={vi.fn()}
        onFinishedEditing={onFinishedEditing}
      />
    )

    // Click edit button
    await user.click(screen.getByRole("button", { name: "Edit" }))

    // Type some content
    const textarea = screen.getByRole("textbox")
    await user.type(textarea, " modified content")

    // Click cancel button
    await user.click(screen.getByRole("button", { name: /Cancel/ }))

    // Editing finishes with no committed value (undefined = discard changes).
    expect(onFinishedEditing).toHaveBeenCalledTimes(1)
    expect(onFinishedEditing.mock.calls[0][0]).toBeUndefined()
  })

  it("seeds the editor with the typed character when editing an empty cell via keyboard", () => {
    const emptyCell = createMockCellValue(null, false)

    render(
      <MarkdownCellEditor
        value={emptyCell}
        initialValue="a"
        onChange={vi.fn()}
        onFinishedEditing={vi.fn()}
      />
    )

    // Typing on an empty cell opens directly in edit mode seeded with the char.
    expect(screen.getByTestId("stMarkdownColumnEditor")).toBeVisible()
    expect(screen.getByRole("textbox")).toHaveValue("a")
  })

  it("propagates the keyboard-seeded character to glide on mount", () => {
    const onChange = vi.fn()
    const emptyCell = createMockCellValue(null, false)

    render(
      <MarkdownCellEditor
        value={emptyCell}
        initialValue="a"
        onChange={onChange}
        onFinishedEditing={vi.fn()}
      />
    )

    // The seeded character must be pushed to glide so that dismissing the
    // overlay (which commits glide's last onChange payload) keeps the typed
    // character instead of discarding it.
    expect(onChange).toHaveBeenCalledTimes(1)
    const draftCell = onChange.mock.calls[0][0] as MarkdownCell
    expect(draftCell.data.value).toBe("a")
    expect(draftCell.data.displayValue).toBe("a")
  })

  it("does not propagate to glide on mount when the edit is not started by typing", () => {
    const onChange = vi.fn()
    const nonEmptyCell = createMockCellValue("# Existing content", false)

    render(
      <MarkdownCellEditor
        value={nonEmptyCell}
        onChange={onChange}
        onFinishedEditing={vi.fn()}
      />
    )

    // Opening the overlay in viewer mode must not produce a spurious draft.
    expect(onChange).not.toHaveBeenCalled()
  })

  it("preserves existing content when a keyboard edit starts on a non-empty cell", () => {
    const nonEmptyCell = createMockCellValue("# Existing content", false)

    render(
      <MarkdownCellEditor
        value={nonEmptyCell}
        initialValue="a"
        onChange={vi.fn()}
        onFinishedEditing={vi.fn()}
      />
    )

    // Opens in edit mode but keeps the existing markdown instead of dropping it.
    expect(screen.getByTestId("stMarkdownColumnEditor")).toBeVisible()
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveValue("# Existing content")
    // Negative assertion: the typed character must NOT replace the content.
    expect(textarea).not.toHaveValue("a")
  })

  it("re-seeds the editor with the latest cell value when entering edit mode", async () => {
    const user = userEvent.setup()
    const initialCell = createMockCellValue("# Original", false)

    const { rerender } = render(
      <MarkdownCellEditor
        value={initialCell}
        onChange={vi.fn()}
        onFinishedEditing={vi.fn()}
      />
    )

    // Simulate the cell value changing externally (e.g. via a rerun) while
    // the viewer overlay stays mounted.
    const updatedCell = createMockCellValue("# Updated externally", false)
    rerender(
      <MarkdownCellEditor
        value={updatedCell}
        onChange={vi.fn()}
        onFinishedEditing={vi.fn()}
      />
    )

    // Entering edit mode should seed the textarea with the latest value.
    await user.click(screen.getByRole("button", { name: "Edit" }))
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveValue("# Updated externally")
    // Negative assertion: the stale initial value must NOT be shown.
    expect(textarea).not.toHaveValue("# Original")
  })

  it("does not render raw HTML in the markdown viewer", () => {
    const maliciousCell = createMockCellValue(
      '<img src=x onerror="window.__xss=true"><script>window.__xss=true</script>',
      true
    )

    const { container } = render(
      <MarkdownCellEditor
        value={maliciousCell}
        onChange={vi.fn()}
        onFinishedEditing={vi.fn()}
      />
    )

    // Raw HTML must not be parsed into live DOM nodes (rendered as text instead).
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("script")).toBeNull()
  })

  it("sanitizes javascript: links in the markdown viewer", () => {
    const maliciousCell = createMockCellValue(
      "[click me](javascript:window.__xss=true)",
      true
    )

    render(
      <MarkdownCellEditor
        value={maliciousCell}
        onChange={vi.fn()}
        onFinishedEditing={vi.fn()}
      />
    )

    // The link text still renders, but the dangerous href is stripped.
    const link = screen.getByText("click me")
    expect(link.getAttribute("href")).not.toMatch(/^javascript:/i)
  })
})
