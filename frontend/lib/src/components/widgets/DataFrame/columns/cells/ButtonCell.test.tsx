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
    baseFontFull: "13px sans-serif",
  }

  const createMockCtx = (): CanvasRenderingContext2D =>
    ({
      measureText: (text: string) => ({ width: text.length * 10 }),
      font: "",
    }) as unknown as CanvasRenderingContext2D

  const createButtonCell = (
    data: ButtonCell["data"]["data"],
    overrides: Partial<ButtonCell["data"]> = {}
  ): ButtonCell =>
    ({
      kind: GridCellKind.Custom,
      data: {
        kind: "button-cell",
        data,
        buttonType: "primary",
        ...overrides,
      },
      allowOverlay: false,
      copyData: Array.isArray(data) ? data.join(", ") : (data ?? ""),
      readonly: true,
    }) as unknown as ButtonCell

  const measureWidth = (cell: ButtonCell): number => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return renderer.measure!(
      createMockCtx(),
      cell,
      mockTheme as Parameters<NonNullable<typeof renderer.measure>>[2]
    )
  }

  const getClickTarget = (
    cell: ButtonCell,
    overrides: {
      bounds?: { x: number; y: number; width: number; height: number }
      posX?: number
      posY?: number
      measureContext?: CanvasRenderingContext2D | null
    } = {}
  ): ReturnType<typeof getButtonCellClickTarget> =>
    getButtonCellClickTarget(cell, {
      bounds: overrides.bounds ?? { x: 0, y: 0, width: 100, height: 32 },
      posX: "posX" in overrides ? overrides.posX : 50,
      posY: "posY" in overrides ? overrides.posY : 16,
      theme: mockTheme,
      // Production typing omits null; null is used here to force the estimate path.
      measureContext: ("measureContext" in overrides
        ? overrides.measureContext
        : createMockCtx()) as CanvasRenderingContext2D | undefined,
    })

  it("correctly identifies button cells", () => {
    expect(renderer.isMatch(createButtonCell("Click me"))).toBe(true)
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

  it("onSelect prevents the default grid selection", () => {
    const preventDefault = vi.fn()
    renderer.onSelect?.({ preventDefault } as unknown as Parameters<
      NonNullable<typeof renderer.onSelect>
    >[0])
    expect(preventDefault).toHaveBeenCalled()
  })

  describe("drawPrep", () => {
    it("centers text and restores alignment in deprep", () => {
      const ctx = {
        textAlign: "start",
        textBaseline: "alphabetic",
      } as CanvasRenderingContext2D

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const prepResult = renderer.drawPrep!({ ctx } as Parameters<
        NonNullable<typeof renderer.drawPrep>
      >[0])

      expect(ctx.textAlign).toBe("center")
      expect(ctx.textBaseline).toBe("middle")

      prepResult?.deprep?.({ ctx })

      expect(ctx.textAlign).toBe("start")
      expect(ctx.textBaseline).toBe("alphabetic")
    })
  })

  describe("measure", () => {
    it("measures single button label width", () => {
      expect(measureWidth(createButtonCell("Click me"))).toBeGreaterThan(0)
    })

    it("measures multi-action button width (uses placeholder)", () => {
      expect(
        measureWidth(
          createButtonCell(["Action 1", "Action 2"], {
            buttonType: "secondary",
          })
        )
      ).toBeGreaterThan(0)
    })

    it("measures icon+text labels wider than text-only", () => {
      const textWidth = measureWidth(createButtonCell("Save"))
      const iconWidth = measureWidth(createButtonCell(":material/save: Save"))

      expect(iconWidth).toBeGreaterThan(textWidth)
    })

    it("returns minimal width for null data", () => {
      expect(
        measureWidth(createButtonCell(null, { buttonType: "secondary" }))
      ).toBe(mockTheme.cellHorizontalPadding * 2)
    })

    it.each([[[]], [[""]]] as const)(
      "returns minimal width for empty content %j",
      data => {
        expect(
          measureWidth(
            createButtonCell([...data], { buttonType: "secondary" })
          )
        ).toBe(mockTheme.cellHorizontalPadding * 2)
      }
    )
  })

  describe("draw", () => {
    type DrawArgs = Parameters<NonNullable<typeof renderer.draw>>[0]

    const createDrawCtx = (): {
      ctx: CanvasRenderingContext2D
      fillStyleHistory: string[]
      strokeStyleHistory: string[]
    } => {
      const fillStyleHistory: string[] = []
      const strokeStyleHistory: string[] = []
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arcTo: vi.fn(),
        closePath: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn((text: string) => ({
          width: (text?.length ?? 0) * 8,
          actualBoundingBoxAscent: 8,
          actualBoundingBoxDescent: 2,
        })),
        font: "",
        lineWidth: 1,
        get fillStyle(): string {
          return fillStyleHistory.at(-1) ?? ""
        },
        set fillStyle(value: string) {
          fillStyleHistory.push(value)
        },
        get strokeStyle(): string {
          return strokeStyleHistory.at(-1) ?? ""
        },
        set strokeStyle(value: string) {
          strokeStyleHistory.push(value)
        },
      }
      return {
        ctx: ctx as unknown as CanvasRenderingContext2D,
        fillStyleHistory,
        strokeStyleHistory,
      }
    }

    const callDraw = (
      ctx: CanvasRenderingContext2D,
      cell: ButtonCell,
      overrides: Partial<{
        hoverX: number
        hoverY: number
        overrideCursor: (cursor: string) => void
        rect: { x: number; y: number; width: number; height: number }
      }> = {}
    ): boolean | void => {
      const { overrideCursor, hoverX, hoverY, rect } = overrides
      return renderer.draw(
        {
          ctx,
          theme: mockTheme,
          rect: rect ?? { x: 0, y: 0, width: 200, height: 32 },
          hoverX,
          hoverY,
          overrideCursor,
        } as unknown as DrawArgs,
        cell
      )
    }

    it("skips drawing when data is null", () => {
      const { ctx } = createDrawCtx()
      const result = callDraw(ctx, createButtonCell(null))

      expect(result).toBe(true)
      expect(ctx.fill).not.toHaveBeenCalled()
      expect(ctx.fillText).not.toHaveBeenCalled()
    })

    it("skips drawing text for an empty-string label", () => {
      const { ctx } = createDrawCtx()
      const result = callDraw(ctx, createButtonCell(""))

      expect(result).toBe(true)
      expect(ctx.fillText).not.toHaveBeenCalled()
    })

    it("draws primary button fill and white label text", () => {
      const { ctx, fillStyleHistory } = createDrawCtx()
      const result = callDraw(ctx, createButtonCell("Click me"))

      expect(result).toBe(true)
      expect(ctx.fill).toHaveBeenCalled()
      expect(fillStyleHistory).toContain(mockTheme.accentColor)
      expect(fillStyleHistory).toContain("#ffffff")
      expect(ctx.fillText).toHaveBeenCalledWith(
        "Click me",
        expect.any(Number),
        expect.any(Number)
      )
      expect(ctx.stroke).not.toHaveBeenCalled()
    })

    it("draws secondary button with border and no solid fill when not hovered", () => {
      const { ctx, strokeStyleHistory, fillStyleHistory } = createDrawCtx()
      callDraw(ctx, createButtonCell("Secondary", { buttonType: "secondary" }))

      expect(ctx.stroke).toHaveBeenCalled()
      expect(strokeStyleHistory).toContain(mockTheme.borderColor)
      // Non-hovered secondary uses transparent bg — no fill() for the button body.
      expect(ctx.fill).not.toHaveBeenCalled()
      expect(fillStyleHistory).toContain(mockTheme.textDark)
    })

    it("uses hover background for a hovered secondary button", () => {
      const { ctx, fillStyleHistory } = createDrawCtx()
      const overrideCursor = vi.fn()
      // Center of a 200x32 cell with an 8-char label (~64px content + padding).
      callDraw(
        ctx,
        createButtonCell("Secondary", { buttonType: "secondary" }),
        { hoverX: 100, hoverY: 16, overrideCursor }
      )

      expect(overrideCursor).toHaveBeenCalledWith("pointer")
      expect(ctx.fill).toHaveBeenCalled()
      expect(fillStyleHistory).toContain(mockTheme.bgHeaderHovered)
    })

    it("uses accent text color for a hovered tertiary button", () => {
      const { ctx, fillStyleHistory } = createDrawCtx()
      callDraw(ctx, createButtonCell("Tertiary", { buttonType: "tertiary" }), {
        hoverX: 100,
        hoverY: 16,
      })

      expect(ctx.fill).not.toHaveBeenCalled()
      expect(fillStyleHistory).toContain(mockTheme.accentColor)
      expect(ctx.fillText).toHaveBeenCalledWith(
        "Tertiary",
        expect.any(Number),
        expect.any(Number)
      )
    })

    it("draws the more_vert icon for multi-action buttons", () => {
      const { ctx } = createDrawCtx()
      callDraw(
        ctx,
        createButtonCell(["One", "Two"], { buttonType: "secondary" })
      )

      expect(ctx.fillText).toHaveBeenCalledWith(
        "more_vert",
        expect.any(Number),
        expect.any(Number)
      )
    })

    it("draws icon and text for Material icon labels", () => {
      const { ctx } = createDrawCtx()
      callDraw(ctx, createButtonCell(":material/save: Save"))

      expect(ctx.fillText).toHaveBeenCalledWith(
        "save",
        expect.any(Number),
        expect.any(Number)
      )
      expect(ctx.fillText).toHaveBeenCalledWith(
        "Save",
        expect.any(Number),
        expect.any(Number)
      )
    })

    it("draws icon-only Material labels centered", () => {
      const { ctx } = createDrawCtx()
      callDraw(ctx, createButtonCell(":material/delete:"))

      expect(ctx.fillText).toHaveBeenCalledWith(
        "delete",
        expect.any(Number),
        expect.any(Number)
      )
      expect(ctx.fillText).toHaveBeenCalledTimes(1)
    })

    it("draws long labels without truncating the fillText argument", () => {
      const { ctx } = createDrawCtx()
      const longLabel = "A".repeat(40)
      callDraw(ctx, createButtonCell(longLabel))

      expect(ctx.fillText).toHaveBeenCalledWith(
        longLabel,
        expect.any(Number),
        expect.any(Number)
      )
    })

    it("returns early when the button has no positive size", () => {
      const { ctx } = createDrawCtx()
      const result = callDraw(ctx, createButtonCell("Click"), {
        rect: { x: 0, y: 0, width: 200, height: 0 },
      })

      expect(result).toBe(true)
      expect(ctx.fillText).not.toHaveBeenCalled()
    })

    it("does not set pointer cursor when hover is outside the button", () => {
      const { ctx } = createDrawCtx()
      const overrideCursor = vi.fn()
      callDraw(ctx, createButtonCell("Click me"), {
        hoverX: 0,
        hoverY: 16,
        overrideCursor,
      })

      expect(overrideCursor).not.toHaveBeenCalled()
    })
  })

  describe("getButtonCellClickTarget", () => {
    it("returns a button click target for a single button", () => {
      expect(getClickTarget(createButtonCell("Click me"))).toEqual({
        kind: "button",
        label: "Click me",
      })
    })

    it("returns a button click target for a single-item array", () => {
      expect(
        getClickTarget(createButtonCell(["Only one"]), {
          bounds: { x: 0, y: 0, width: 200, height: 32 },
          posX: 100,
        })
      ).toEqual({
        kind: "button",
        label: "Only one",
      })
    })

    it("returns a menu click target for a multi-action button", () => {
      expect(
        getClickTarget(
          createButtonCell(["Action 1", "Action 2"], {
            buttonType: "secondary",
          }),
          {
            bounds: { x: 10, y: 20, width: 100, height: 32 },
          }
        )
      ).toEqual({
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

    it.each([
      {
        name: "data is null",
        cell: () => createButtonCell(null),
      },
      {
        name: "a single empty-string label",
        cell: () => createButtonCell([""]),
      },
      {
        name: "clicking outside the button bounds",
        cell: () => createButtonCell("Click me"),
        overrides: { posX: 0 },
      },
      {
        name: "clicks beyond the measured button bounds",
        cell: () => createButtonCell("A"),
        overrides: { posX: 30 },
      },
    ])("returns undefined when $name", ({ cell, overrides }) => {
      expect(getClickTarget(cell(), overrides)).toBeUndefined()
    })

    it.each([
      { missing: "posX" as const, args: { posX: undefined, posY: 16 } },
      { missing: "posY" as const, args: { posX: 50, posY: undefined } },
    ])("returns undefined when $missing is missing", ({ args }) => {
      expect(
        getClickTarget(createButtonCell("Click me"), args)
      ).toBeUndefined()
    })

    it.each([
      ["left", 12],
      ["right", 88],
    ] as const)(
      "hits a %s-aligned button near its edge",
      (alignment, posX) => {
        const cell = createButtonCell("Hi", { alignment })

        expect(getClickTarget(cell, { posX })).toEqual({
          kind: "button",
          label: "Hi",
        })
        expect(
          getClickTarget(cell, {
            posX: alignment === "left" ? 90 : 10,
          })
        ).toBeUndefined()
      }
    )

    it("falls back to estimated content width when measure context is unavailable", () => {
      // Passing null forces the estimated-width path used when canvas is missing.
      expect(
        getClickTarget(createButtonCell("Click me"), {
          bounds: { x: 0, y: 0, width: 200, height: 32 },
          posX: 100,
          measureContext: null,
        })
      ).toEqual({
        kind: "button",
        label: "Click me",
      })
    })

    it("estimates multi-action and icon labels without a canvas context", () => {
      const noCanvas = {
        bounds: { x: 0, y: 0, width: 200, height: 32 },
        posX: 100,
        measureContext: null,
      }

      expect(
        getClickTarget(createButtonCell(["A", "B"]), noCanvas)
      ).toMatchObject({
        kind: "menu",
        actions: ["A", "B"],
      })
      expect(
        getClickTarget(createButtonCell(":material/bolt: Go"), noCanvas)
      ).toEqual({
        kind: "button",
        label: ":material/bolt: Go",
      })
    })
  })
})
