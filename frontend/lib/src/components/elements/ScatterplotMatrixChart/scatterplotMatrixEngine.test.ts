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

import {
  buildNavigationSteps,
  pointInPolygon,
} from "./scatterplotMatrixEngine"

describe("buildNavigationSteps", () => {
  it("returns no steps when source and target are the same", () => {
    expect(
      buildNavigationSteps({ col: 2, row: 3 }, { col: 2, row: 3 })
    ).toEqual([])
  })

  it("rolls one axis at a time towards the target", () => {
    expect(
      buildNavigationSteps({ col: 0, row: 0 }, { col: 2, row: 0 })
    ).toEqual([
      { col: 1, row: 0, axis: "x" },
      { col: 2, row: 0, axis: "x" },
    ])
  })

  it("rolls rows first only when the column distance is greater", () => {
    const rowsFirst = buildNavigationSteps(
      { col: 0, row: 0 },
      { col: 3, row: 1 }
    )
    // Column distance (3) > row distance (1), so row steps come first:
    expect(rowsFirst).toEqual([
      { col: 0, row: 1, axis: "y" },
      { col: 1, row: 1, axis: "x" },
      { col: 2, row: 1, axis: "x" },
      { col: 3, row: 1, axis: "x" },
    ])

    const columnsFirst = buildNavigationSteps(
      { col: 0, row: 0 },
      { col: 1, row: 2 }
    )
    expect(columnsFirst).toEqual([
      { col: 1, row: 0, axis: "x" },
      { col: 1, row: 1, axis: "y" },
      { col: 1, row: 2, axis: "y" },
    ])
  })

  it("supports moving towards smaller indices", () => {
    expect(
      buildNavigationSteps({ col: 2, row: 1 }, { col: 0, row: 1 })
    ).toEqual([
      { col: 1, row: 1, axis: "x" },
      { col: 0, row: 1, axis: "x" },
    ])
  })
})

describe("pointInPolygon", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]

  it("detects points inside the polygon", () => {
    expect(pointInPolygon(5, 5, square)).toBe(true)
  })

  it("detects points outside the polygon", () => {
    expect(pointInPolygon(15, 5, square)).toBe(false)
    expect(pointInPolygon(-1, 5, square)).toBe(false)
  })

  it("handles concave polygons", () => {
    const concave = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 5, y: 5 },
      { x: 0, y: 10 },
    ]
    // Inside the notch, outside the polygon:
    expect(pointInPolygon(5, 8, concave)).toBe(false)
    expect(pointInPolygon(2, 2, concave)).toBe(true)
  })
})
