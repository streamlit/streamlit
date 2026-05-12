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

import {
  type CustomCell,
  type CustomRenderer,
  drawTextCell,
  GridCellKind,
  type TextCell,
} from "@glideapps/glide-data-grid"
import { cleanup, screen } from "@testing-library/react"

import { render } from "~lib/test_util"

vi.mock("@glideapps/glide-data-grid", async () => {
  const actual = await vi.importActual<
    typeof import("@glideapps/glide-data-grid")
  >("@glideapps/glide-data-grid")
  return {
    ...actual,
    drawTextCell: vi.fn(),
  }
})

vi.mock("./JsonViewer", () => ({
  JsonViewer: (props: { jsonValue: unknown }) => (
    <div data-testid="json-viewer">{String(props.jsonValue)}</div>
  ),
}))

import renderer, { type JsonCell, JsonTextCellEditor } from "./JsonCell"

type DrawArgs = Parameters<NonNullable<CustomRenderer<JsonCell>["draw"]>>[0]

describe("JsonCell renderer", () => {
  const mockTheme = {
    cellHorizontalPadding: 8,
  }

  const drawArgs = {} as unknown as DrawArgs

  let JsonCellEditor: ComponentType<Record<string, unknown>>

  beforeAll(() => {
    const result = renderer.provideEditor?.(
      {} as Parameters<NonNullable<typeof renderer.provideEditor>>[0]
    )
    if (result === undefined || !("editor" in result)) {
      throw new Error("provideEditor did not return an editor")
    }
    JsonCellEditor = result.editor as ComponentType<Record<string, unknown>>
  })

  beforeEach(() => {
    vi.mocked(drawTextCell).mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("correctly identifies JSON cells", () => {
    const jsonCell = {
      kind: GridCellKind.Custom,
      data: { kind: "json-cell", value: { test: "value" } },
      allowOverlay: true,
      copyData: "",
    } as unknown as CustomCell

    expect(renderer.isMatch(jsonCell)).toBe(true)
  })

  it("returns false for non-JSON custom cells", () => {
    const otherCell = {
      kind: GridCellKind.Custom,
      data: { kind: "other-cell", value: {} },
      allowOverlay: true,
      copyData: "",
    } as unknown as CustomCell

    expect(renderer.isMatch(otherCell)).toBe(false)
  })

  it("measures cell width correctly", () => {
    const ctx = {
      measureText: (text: string) => ({ width: text.length * 10 }),
    } as CanvasRenderingContext2D

    const cell = {
      data: { kind: "json-cell", value: { test: "value" } },
    } as unknown as JsonCell

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const width = renderer.measure!(
      ctx,
      cell,
      mockTheme as Parameters<NonNullable<typeof renderer.measure>>[2]
    )
    expect(width).toBeGreaterThan(0)
  })

  it("draw calls drawTextCell with displayValue when set and returns true", () => {
    const cell = {
      data: {
        kind: "json-cell",
        value: { ignored: true },
        displayValue: "shown",
      },
      contentAlign: "center",
    } as unknown as JsonCell

    const result = renderer.draw(drawArgs, cell)

    expect(result).toBe(true)
    expect(drawTextCell).toHaveBeenCalledWith(
      drawArgs,
      "shown",
      cell.contentAlign
    )
  })

  it("draw calls drawTextCell with stringified value when displayValue is unset", () => {
    const cell = {
      data: { kind: "json-cell", value: { test: "value" } },
      contentAlign: "left",
    } as unknown as JsonCell

    const result = renderer.draw(drawArgs, cell)

    expect(result).toBe(true)
    expect(drawTextCell).toHaveBeenCalledWith(
      drawArgs,
      '{"test":"value"}',
      cell.contentAlign
    )
  })

  it("draw uses empty string when both value and displayValue are absent", () => {
    const cell = {
      data: { kind: "json-cell", value: null },
      contentAlign: "left",
    } as unknown as JsonCell

    renderer.draw(drawArgs, cell)

    expect(drawTextCell).toHaveBeenCalledWith(drawArgs, "", cell.contentAlign)
  })

  it("JsonCellEditor renders JsonViewer with value from the cell", () => {
    const value = {
      kind: GridCellKind.Custom,
      data: { kind: "json-cell", value: '{"from":"cell"}' },
      allowOverlay: true,
      copyData: "",
    } as unknown as JsonCell

    render(
      <JsonCellEditor
        theme={mockTheme}
        value={value}
        onChange={vi.fn()}
        isHighlighted={false}
      />
    )

    expect(screen.getByTestId("json-viewer")).toHaveTextContent(
      '{"from":"cell"}'
    )
  })

  it("JsonCellEditor passes displayValue when value is missing", () => {
    const value = {
      kind: GridCellKind.Custom,
      data: {
        kind: "json-cell",
        value: undefined,
        displayValue: '{"fallback":true}',
      },
      allowOverlay: true,
      copyData: "",
    } as unknown as JsonCell

    render(
      <JsonCellEditor
        theme={mockTheme}
        value={value}
        onChange={vi.fn()}
        isHighlighted={false}
      />
    )

    expect(screen.getByTestId("json-viewer")).toHaveTextContent(
      '{"fallback":true}'
    )
  })

  it("JsonTextCellEditor renders JsonViewer with text cell data", () => {
    const textCell = {
      kind: GridCellKind.Text,
      data: '{"n":1}',
      displayData: '{"n":1}',
      allowOverlay: true,
      readonly: false,
      style: "normal",
    } as TextCell

    const Editor = JsonTextCellEditor as ComponentType<Record<string, unknown>>
    render(
      <Editor
        theme={mockTheme}
        value={textCell}
        onChange={vi.fn()}
        isHighlighted={false}
      />
    )

    expect(screen.getByTestId("json-viewer")).toHaveTextContent('{"n":1}')
  })
})
