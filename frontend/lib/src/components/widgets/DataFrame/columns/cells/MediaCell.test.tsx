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

  // Cast the editor to a callable function type for testing
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
