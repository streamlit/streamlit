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

import { type CustomCell, GridCellKind } from "@glideapps/glide-data-grid"

import renderer, {
  type ButtonCell,
  getButtonCellClickTarget,
} from "./ButtonCell"

describe("ButtonCell renderer", () => {
  const mockTheme = {
    cellHorizontalPadding: 8,
    baseFontStyle: "13px",
    fontFamily: "sans-serif",
    textDark: "#000",
    accentColor: "#ff4b4b",
    bgHeaderHovered: "#f0f0f0",
    borderColor: "#ccc",
    roundingRadius: 4,
  }

  const createMockCtx = (): CanvasRenderingContext2D =>
    ({
      measureText: (text: string) => ({ width: text.length * 10 }),
      font: "",
    }) as unknown as CanvasRenderingContext2D

  it("correctly identifies button cells", () => {
    const buttonCell = {
      kind: GridCellKind.Custom,
      data: {
        kind: "button-cell",
        data: "Click me",
        buttonType: "primary",
      },
      allowOverlay: false,
      copyData: "Click me",
      readonly: true,
    } as unknown as CustomCell

    expect(renderer.isMatch(buttonCell)).toBe(true)
  })

  it("does not match non-button cells", () => {
    const otherCell = {
      kind: GridCellKind.Custom,
      data: { kind: "json-cell", value: {} },
      allowOverlay: true,
      copyData: "",
    } as unknown as CustomCell

    expect(renderer.isMatch(otherCell)).toBe(false)
  })

  it.each([
    ["needsHover", true],
    ["needsHoverPosition", true],
    ["provideEditor", undefined],
  ] as const)(
    "renderer property %s equals %s",
    (
      prop: "needsHover" | "needsHoverPosition" | "provideEditor",
      expected
    ) => {
      expect(renderer[prop]).toBe(expected)
    }
  )

  describe("measure", () => {
    it("measures single button label width", () => {
      const ctx = createMockCtx()
      const cell = {
        data: {
          kind: "button-cell",
          data: "Click me",
          buttonType: "primary",
        },
      } as unknown as ButtonCell

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const width = renderer.measure!(
        ctx,
        cell,
        mockTheme as Parameters<NonNullable<typeof renderer.measure>>[2]
      )
      expect(width).toBeGreaterThan(0)
    })

    it("measures multi-action button width (uses placeholder)", () => {
      const ctx = createMockCtx()
      const cell = {
        data: {
          kind: "button-cell",
          data: ["Action 1", "Action 2"],
          buttonType: "secondary",
        },
      } as unknown as ButtonCell

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const width = renderer.measure!(
        ctx,
        cell,
        mockTheme as Parameters<NonNullable<typeof renderer.measure>>[2]
      )
      expect(width).toBeGreaterThan(0)
    })

    it("returns minimal width for null data", () => {
      const ctx = createMockCtx()
      const cell = {
        data: {
          kind: "button-cell",
          data: null,
          buttonType: "secondary",
        },
      } as unknown as ButtonCell

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const width = renderer.measure!(
        ctx,
        cell,
        mockTheme as Parameters<NonNullable<typeof renderer.measure>>[2]
      )
      // Should return just the horizontal padding * 2
      expect(width).toBe(mockTheme.cellHorizontalPadding * 2)
    })

    it.each([[[]], [[""]]] as const)(
      "returns minimal width for empty content %j",
      data => {
        const ctx = createMockCtx()
        const cell = {
          data: {
            kind: "button-cell",
            data,
            buttonType: "secondary",
          },
        } as unknown as ButtonCell

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const width = renderer.measure!(
          ctx,
          cell,
          mockTheme as Parameters<NonNullable<typeof renderer.measure>>[2]
        )
        expect(width).toBe(mockTheme.cellHorizontalPadding * 2)
      }
    )
  })

  describe("getButtonCellClickTarget", () => {
    it("returns a button click target for a single button", () => {
      const cell = {
        kind: GridCellKind.Custom,
        data: {
          kind: "button-cell",
          data: "Click me",
          buttonType: "primary",
        },
        allowOverlay: false,
        copyData: "Click me",
        readonly: true,
      } as unknown as ButtonCell

      const clickTarget = getButtonCellClickTarget(cell, {
        bounds: { x: 0, y: 0, width: 100, height: 32 },
        posX: 50,
        posY: 16,
        theme: mockTheme,
        measureContext: createMockCtx(),
      })

      expect(clickTarget).toEqual({
        kind: "button",
        label: "Click me",
      })
    })

    it("returns a menu click target for a multi-action button", () => {
      const cell = {
        kind: GridCellKind.Custom,
        data: {
          kind: "button-cell",
          data: ["Action 1", "Action 2"],
          buttonType: "secondary",
        },
        allowOverlay: false,
        copyData: "Action 1, Action 2",
        readonly: true,
      } as unknown as ButtonCell

      const clickTarget = getButtonCellClickTarget(cell, {
        bounds: { x: 10, y: 20, width: 100, height: 32 },
        posX: 50,
        posY: 16,
        theme: mockTheme,
        measureContext: createMockCtx(),
      })

      expect(clickTarget).toEqual({
        kind: "menu",
        actions: ["Action 1", "Action 2"],
        bounds: expect.objectContaining({
          x: 10,
          y: 20,
          width: 100,
          height: 32,
          clickX: 60,
          clickY: 36,
        }),
      })
    })

    it("returns undefined when data is null", () => {
      const cell = {
        kind: GridCellKind.Custom,
        data: {
          kind: "button-cell",
          data: null,
          buttonType: "primary",
        },
        allowOverlay: false,
        copyData: "",
        readonly: true,
      } as unknown as ButtonCell

      const clickTarget = getButtonCellClickTarget(cell, {
        bounds: { x: 0, y: 0, width: 100, height: 32 },
        posX: 50,
        posY: 16,
        theme: mockTheme,
        measureContext: createMockCtx(),
      })

      expect(clickTarget).toBeUndefined()
    })

    it("returns undefined for a single empty-string label", () => {
      const cell = {
        kind: GridCellKind.Custom,
        data: {
          kind: "button-cell",
          data: [""],
          buttonType: "primary",
        },
        allowOverlay: false,
        copyData: "",
        readonly: true,
      } as unknown as ButtonCell

      const clickTarget = getButtonCellClickTarget(cell, {
        bounds: { x: 0, y: 0, width: 100, height: 32 },
        posX: 50,
        posY: 16,
        theme: mockTheme,
        measureContext: createMockCtx(),
      })

      expect(clickTarget).toBeUndefined()
    })

    it("returns undefined when clicking outside the button bounds", () => {
      const cell = {
        kind: GridCellKind.Custom,
        data: {
          kind: "button-cell",
          data: "Click me",
          buttonType: "primary",
        },
        allowOverlay: false,
        copyData: "Click me",
        readonly: true,
      } as unknown as ButtonCell

      const clickTarget = getButtonCellClickTarget(cell, {
        bounds: { x: 0, y: 0, width: 100, height: 32 },
        posX: 0,
        posY: 16,
        theme: mockTheme,
        measureContext: createMockCtx(),
      })

      expect(clickTarget).toBeUndefined()
    })

    it("does not expand clicks beyond the measured button bounds", () => {
      const cell = {
        kind: GridCellKind.Custom,
        data: {
          kind: "button-cell",
          data: "A",
          buttonType: "primary",
        },
        allowOverlay: false,
        copyData: "A",
        readonly: true,
      } as unknown as ButtonCell

      const clickTarget = getButtonCellClickTarget(cell, {
        bounds: { x: 0, y: 0, width: 100, height: 32 },
        posX: 30,
        posY: 16,
        theme: mockTheme,
        measureContext: createMockCtx(),
      })

      expect(clickTarget).toBeUndefined()
    })
  })
})
