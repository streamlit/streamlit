/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import renderer from "./JsonCell"

describe("JsonCell renderer", () => {
  const mockTheme = {
    cellHorizontalPadding: 8,
  }

  it("correctly identifies JSON cells", () => {
    const jsonCell = {
      kind: GridCellKind.Custom,
      data: { kind: "json-cell", value: { test: "value" } },
      allowOverlay: true,
      copyData: "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    } as any

    expect(renderer.isMatch(jsonCell)).toBe(true)
  })

  it("measures cell width correctly", () => {
    const ctx = {
      measureText: (text: string) => ({ width: text.length * 10 }),
    } as CanvasRenderingContext2D

    const cell = {
      data: { kind: "json-cell", value: { test: "value" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    } as any

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- TODO: Replace 'any' with a more specific type.
    const width = renderer.measure!(ctx, cell, mockTheme as any)
    expect(width).toBeGreaterThan(0)
  })
})
