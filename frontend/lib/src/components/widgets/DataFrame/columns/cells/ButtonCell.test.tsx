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

import renderer, { ButtonCell } from "./ButtonCell"

describe("ButtonCell renderer", () => {
  const mockTheme = {
    cellHorizontalPadding: 8,
    baseFontStyle: "13px",
    baseFontFull: "13px sans-serif",
    textDark: "#000",
    accentColor: "#ff4b4b",
    bgHeaderHovered: "#f0f0f0",
    borderColor: "#ccc",
    roundingRadius: 4,
  }

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
    const createMockCtx = (): CanvasRenderingContext2D =>
      ({
        measureText: (text: string) => ({ width: text.length * 10 }),
        font: "",
      }) as unknown as CanvasRenderingContext2D

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

  describe("onClick", () => {
    it("calls onClick callback for single button", () => {
      const onClick = vi.fn()
      const cell = {
        kind: GridCellKind.Custom,
        data: {
          kind: "button-cell",
          data: "Click me",
          buttonType: "primary",
          rowIndex: 0,
          onClick,
        },
        allowOverlay: false,
        copyData: "Click me",
        readonly: true,
      } as unknown as ButtonCell

      const args = {
        cell,
        bounds: { x: 0, y: 0, width: 100, height: 32 },
        posX: 50,
        posY: 16,
        theme: mockTheme,
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      renderer.onClick!(
        args as Parameters<NonNullable<typeof renderer.onClick>>[0]
      )

      expect(onClick).toHaveBeenCalledWith(0, "Click me")
    })

    it("calls onOpenMenu callback for multi-action button", () => {
      const onOpenMenu = vi.fn()
      const cell = {
        kind: GridCellKind.Custom,
        data: {
          kind: "button-cell",
          data: ["Action 1", "Action 2"],
          buttonType: "secondary",
          rowIndex: 1,
          onOpenMenu,
        },
        allowOverlay: false,
        copyData: "Action 1, Action 2",
        readonly: true,
      } as unknown as ButtonCell

      const args = {
        cell,
        bounds: { x: 10, y: 20, width: 100, height: 32 },
        posX: 50,
        posY: 16,
        theme: mockTheme,
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      renderer.onClick!(
        args as Parameters<NonNullable<typeof renderer.onClick>>[0]
      )

      expect(onOpenMenu).toHaveBeenCalledWith(
        1,
        ["Action 1", "Action 2"],
        expect.objectContaining({
          x: 10,
          y: 20,
          width: 100,
          height: 32,
        })
      )
    })

    it("does nothing when rowIndex is undefined", () => {
      const onClick = vi.fn()
      const cell = {
        kind: GridCellKind.Custom,
        data: {
          kind: "button-cell",
          data: "Click me",
          buttonType: "primary",
          // rowIndex not set
          onClick,
        },
        allowOverlay: false,
        copyData: "Click me",
        readonly: true,
      } as unknown as ButtonCell

      const args = {
        cell,
        bounds: { x: 0, y: 0, width: 100, height: 32 },
        posX: 50,
        posY: 16,
        theme: mockTheme,
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      renderer.onClick!(
        args as Parameters<NonNullable<typeof renderer.onClick>>[0]
      )

      expect(onClick).not.toHaveBeenCalled()
    })

    it("does nothing when data is null", () => {
      const onClick = vi.fn()
      const cell = {
        kind: GridCellKind.Custom,
        data: {
          kind: "button-cell",
          data: null,
          buttonType: "primary",
          rowIndex: 0,
          onClick,
        },
        allowOverlay: false,
        copyData: "",
        readonly: true,
      } as unknown as ButtonCell

      const args = {
        cell,
        bounds: { x: 0, y: 0, width: 100, height: 32 },
        posX: 50,
        posY: 16,
        theme: mockTheme,
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      renderer.onClick!(
        args as Parameters<NonNullable<typeof renderer.onClick>>[0]
      )

      expect(onClick).not.toHaveBeenCalled()
    })

    it("does nothing for a single empty-string label", () => {
      const onClick = vi.fn()
      const onOpenMenu = vi.fn()
      const cell = {
        kind: GridCellKind.Custom,
        data: {
          kind: "button-cell",
          data: [""],
          buttonType: "primary",
          rowIndex: 0,
          onClick,
          onOpenMenu,
        },
        allowOverlay: false,
        copyData: "",
        readonly: true,
      } as unknown as ButtonCell

      const args = {
        cell,
        bounds: { x: 0, y: 0, width: 100, height: 32 },
        posX: 50,
        posY: 16,
        theme: mockTheme,
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      renderer.onClick!(
        args as Parameters<NonNullable<typeof renderer.onClick>>[0]
      )

      expect(onClick).not.toHaveBeenCalled()
      expect(onOpenMenu).not.toHaveBeenCalled()
    })
  })
})
