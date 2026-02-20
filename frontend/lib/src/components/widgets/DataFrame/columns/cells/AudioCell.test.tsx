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

import renderer, { AUDIO_CELL_ICON } from "./AudioCell"

describe("AudioCell renderer", () => {
  const mockTheme = {
    cellHorizontalPadding: 8,
    baseFontStyle: "13px",
    textDark: "#000",
  }

  it("correctly identifies audio cells", () => {
    const audioCell = {
      kind: GridCellKind.Custom,
      data: { kind: "audio-cell", src: "https://example.com/audio.mp3" },
      allowOverlay: true,
      copyData: "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    expect(renderer.isMatch(audioCell)).toBe(true)
  })

  it("does not match non-audio cells", () => {
    const otherCell = {
      kind: GridCellKind.Custom,
      data: { kind: "json-cell", value: {} },
      allowOverlay: true,
      copyData: "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    expect(renderer.isMatch(otherCell)).toBe(false)
  })

  it("measures cell width correctly", () => {
    const ctx = {
      measureText: (text: string) => ({ width: text.length * 10 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    const cell = {
      data: { kind: "audio-cell", src: "https://example.com/audio.mp3" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-explicit-any
    const width = renderer.measure!(ctx, cell, mockTheme as any)
    expect(width).toBeGreaterThan(0)
    expect(width).toBe(
      AUDIO_CELL_ICON.length * 10 + mockTheme.cellHorizontalPadding * 2
    )
  })
})
