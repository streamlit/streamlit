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
import { screen } from "@testing-library/react"

import { render } from "~lib/test_util"

import renderer, { MediaCell, MediaCellEditor, MediaType } from "./MediaCell"

describe("MediaCell renderer", () => {
  const mockTheme = {
    cellHorizontalPadding: 8,
    baseFontStyle: "13px",
    textDark: "#000",
  }

  describe.each([
    ["audio", "audio_file"],
    ["video", "video_file"],
  ] as [MediaType, string][])(
    "%s media type",
    (mediaType: MediaType, expectedIcon: string) => {
      it("correctly identifies media cells", () => {
        const mediaCell = {
          kind: GridCellKind.Custom,
          data: {
            kind: "media-cell",
            mediaType,
            src: "https://example.com/media.mp4",
          },
          allowOverlay: true,
          copyData: "",
        } as unknown as CustomCell

        expect(renderer.isMatch(mediaCell)).toBe(true)
      })

      it("measures cell width correctly", () => {
        const ctx = {
          measureText: (text: string) => ({ width: text.length * 10 }),
        } as unknown as CanvasRenderingContext2D

        const cell = {
          data: {
            kind: "media-cell",
            mediaType,
            src: "https://example.com/media.mp4",
          },
        } as unknown as MediaCell

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const width = renderer.measure!(
          ctx,
          cell,
          mockTheme as Parameters<NonNullable<typeof renderer.measure>>[2]
        )
        expect(width).toBeGreaterThan(0)
        expect(width).toBe(
          expectedIcon.length * 10 + mockTheme.cellHorizontalPadding * 2
        )
      })
    }
  )

  describe("draw", () => {
    type DrawArgs = Parameters<NonNullable<typeof renderer.draw>>[0]

    interface MockCtx {
      save: ReturnType<typeof vi.fn>
      restore: ReturnType<typeof vi.fn>
      fillText: ReturnType<typeof vi.fn>
      font: string
      fillStyle: string
      textAlign: CanvasTextAlign
      textBaseline: CanvasTextBaseline
    }

    const createMockCtx = (): MockCtx => ({
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      font: "",
      fillStyle: "",
      textAlign: "" as CanvasTextAlign,
      textBaseline: "" as CanvasTextBaseline,
    })

    interface MockDrawArgs {
      ctx: MockCtx
      theme: {
        bubbleHeight: number
        textLight: string
        cellHorizontalPadding: number
      }
      rect: { x: number; y: number; width: number; height: number }
    }

    const createDrawArgs = (ctx: MockCtx): MockDrawArgs => ({
      ctx,
      theme: {
        bubbleHeight: 20,
        textLight: "#666",
        cellHorizontalPadding: 8,
      },
      rect: { x: 10, y: 20, width: 100, height: 40 },
    })

    const draw = (args: MockDrawArgs, cell: MediaCell): boolean | void =>
      renderer.draw(args as unknown as DrawArgs, cell)

    it("returns true when src is null", () => {
      const ctx = createMockCtx()
      const args = createDrawArgs(ctx)
      const cell = {
        data: {
          kind: "media-cell" as const,
          mediaType: "audio" as const,
          src: null,
        },
      } as MediaCell

      const result = draw(args, cell)

      expect(result).toBe(true)
      expect(ctx.save).not.toHaveBeenCalled()
      expect(ctx.restore).not.toHaveBeenCalled()
      expect(ctx.fillText).not.toHaveBeenCalled()
    })

    it("draws audio icon with center alignment", () => {
      const ctx = createMockCtx()
      const args = createDrawArgs(ctx)
      const cell = {
        data: {
          kind: "media-cell" as const,
          mediaType: "audio" as const,
          src: "https://example.com/audio.mp3",
        },
      } as MediaCell

      draw(args, cell)

      expect(ctx.textAlign).toBe("center")
      expect(ctx.fillText).toHaveBeenCalledWith("audio_file", 60, 40)
    })

    it("draws video icon with left alignment", () => {
      const ctx = createMockCtx()
      const args = createDrawArgs(ctx)
      const cell = {
        data: {
          kind: "media-cell" as const,
          mediaType: "video" as const,
          src: "https://example.com/video.mp4",
        },
        contentAlign: "left" as const,
      } as MediaCell

      draw(args, cell)

      expect(ctx.textAlign).toBe("left")
      expect(ctx.fillText).toHaveBeenCalledWith("video_file", 18, 40)
    })

    it("draws with right alignment", () => {
      const ctx = createMockCtx()
      const args = createDrawArgs(ctx)
      const cell = {
        data: {
          kind: "media-cell" as const,
          mediaType: "video" as const,
          src: "https://example.com/video.mp4",
        },
        contentAlign: "right" as const,
      } as MediaCell

      draw(args, cell)

      expect(ctx.textAlign).toBe("right")
      expect(ctx.fillText).toHaveBeenCalledWith("video_file", 102, 40)
    })

    it("verifies ctx.save() and ctx.restore() are called", () => {
      const ctx = createMockCtx()
      const args = createDrawArgs(ctx)
      const cell = {
        data: {
          kind: "media-cell" as const,
          mediaType: "audio" as const,
          src: "https://example.com/a.mp3",
        },
      } as MediaCell

      draw(args, cell)

      expect(ctx.save).toHaveBeenCalledTimes(1)
      expect(ctx.restore).toHaveBeenCalledTimes(1)
    })
  })

  it("does not match non-media cells", () => {
    const otherCell = {
      kind: GridCellKind.Custom,
      data: { kind: "json-cell", value: {} },
      allowOverlay: true,
      copyData: "",
    } as unknown as CustomCell

    expect(renderer.isMatch(otherCell)).toBe(false)
  })
})

describe("MediaCellEditor", () => {
  const createMockCell = (
    mediaType: MediaType,
    src: string | null
  ): { value: MediaCell } => ({
    value: {
      kind: GridCellKind.Custom,
      data: {
        kind: "media-cell",
        mediaType,
        src,
      },
      allowOverlay: true,
      copyData: src ?? "",
    },
  })

  const editor = MediaCellEditor as (cell: {
    value: MediaCell
  }) => JSX.Element | null

  it.each([
    ["audio", "https://example.com/audio.mp3", "Audio player"],
    ["video", "https://example.com/video.mp4", "Video player"],
  ] as [MediaType, string, string][])(
    "renders %s element with correct src, controls, and aria-label",
    (mediaType, src, ariaLabel) => {
      const cell = createMockCell(mediaType, src)
      const result = editor(cell)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      render(result!)

      const element = screen.getByLabelText(ariaLabel)
      expect(element).toHaveAttribute("src", src)
      expect(element).toHaveAttribute("controls")
    }
  )

  it.each([
    ["audio", null],
    ["video", ""],
  ] as [MediaType, string | null][])(
    "returns null when %s src is %p",
    (mediaType, src) => {
      const cell = createMockCell(mediaType, src)
      const result = editor(cell)
      expect(result).toBeNull()
    }
  )
})
