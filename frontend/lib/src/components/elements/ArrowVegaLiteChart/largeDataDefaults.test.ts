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

import { describe, expect, it } from "vitest"

import type { Quiver } from "~lib/dataframes/Quiver"

import type { WrappedNamedDataset } from "./arrowUtils"
import {
  applyLargeDataDefaults,
  CANVAS_RENDERER_THRESHOLD,
  type DatasetRowCounts,
  getDatasetRowCounts,
  MARK_ARIA_THRESHOLD,
} from "./largeDataDefaults"

type Spec = Record<string, unknown>

/** Row counts with one named Arrow dataset, "points". */
function counts(
  rows: number,
  unnamed: number | null = null
): DatasetRowCounts {
  return { unnamed, named: { points: rows } }
}

/** A unit view reading the "points" dataset. */
function unitSpec(mark: unknown, extra: Spec = {}): Spec {
  return {
    data: { name: "points" },
    mark,
    encoding: { x: { field: "x" }, y: { field: "y" } },
    ...extra,
  }
}

function prepare(spec: Spec, rowCounts: DatasetRowCounts): Spec {
  applyLargeDataDefaults(spec, rowCounts)
  return spec
}

function rendererOf(spec: Spec): unknown {
  const usermeta = spec.usermeta as Spec | undefined
  return (usermeta?.embedOptions as Spec | undefined)?.renderer
}

describe("applyLargeDataDefaults", () => {
  it("renders charts with many per-datum marks to canvas", () => {
    for (const mark of ["point", { type: "bar" }, "tick"]) {
      const above = prepare(
        unitSpec(mark),
        counts(CANVAS_RENDERER_THRESHOLD + 1)
      )
      expect(rendererOf(above)).toBe("canvas")
    }
    const atThreshold = prepare(
      unitSpec("point"),
      counts(CANVAS_RENDERER_THRESHOLD)
    )
    expect(atThreshold).not.toHaveProperty("usermeta")
  })

  it("turns off mark ARIA above its threshold, lines included", () => {
    const line = prepare(
      unitSpec("line", { config: { mark: { color: "red" } } }),
      counts(MARK_ARIA_THRESHOLD + 1)
    )
    expect(line.config).toEqual({ mark: { color: "red", aria: false } })
    // A line draws one path, so it keeps the SVG renderer.
    expect(line).not.toHaveProperty("usermeta")

    const atThreshold = prepare(unitSpec("line"), counts(MARK_ARIA_THRESHOLD))
    expect(atThreshold).not.toHaveProperty("config")
  })

  it.each([
    ["usermeta", { embedOptions: { renderer: "svg" }, a: 1 }],
    ["config", { aria: true }],
    ["config", { mark: { aria: true } }],
  ])("keeps the author's %s: %j", (key, value) => {
    const spec = prepare(unitSpec("point", { [key]: value }), counts(100_000))
    expect(spec[key]).toEqual(value)
  })

  it("reads unnamed data for views without data", () => {
    const spec = unitSpec("point")
    delete spec.data
    expect(rendererOf(prepare(spec, counts(0, 100_000)))).toBe("canvas")
  })

  it.each([
    [
      "an aggregate",
      unitSpec("bar", { encoding: { y: { aggregate: "sum" } } }),
    ],
    ["a transform", unitSpec("point", { transform: [{ calculate: "1" }] })],
    ["data from a URL", unitSpec("point", { data: { url: "data.csv" } })],
    [
      "an aggregate in the parent layer",
      {
        data: { name: "points" },
        encoding: { y: { aggregate: "sum", field: "v" } },
        layer: [{ mark: "bar" }, { mark: "text" }],
      },
    ],
  ])("doesn't count views with %s", (_, spec) => {
    expect(prepare(spec, counts(100_000, 100_000))).toEqual(spec)
  })

  it("adds up layered and concatenated views", () => {
    const half = CANVAS_RENDERER_THRESHOLD / 2 + 1
    const layered = {
      data: { name: "points" },
      layer: [{ mark: "point" }, { mark: "rule" }],
    }
    expect(rendererOf(prepare(layered, counts(half)))).toBe("canvas")

    const concat = {
      encoding: { y: { aggregate: "count" } },
      hconcat: [unitSpec("point"), unitSpec("tick")],
    }
    // A concatenation's encoding isn't inherited by its views.
    expect(rendererOf(prepare(concat, counts(half)))).toBe("canvas")
  })
})

describe("getDatasetRowCounts", () => {
  const quiver = (numDataRows: number): Quiver =>
    ({ dimensions: { numDataRows } }) as unknown as Quiver

  it("reads named and unnamed row counts", () => {
    const datasets: WrappedNamedDataset[] = [
      { name: "a", hasName: true, data: quiver(3) },
      { name: null, hasName: false, data: quiver(7) },
    ]
    expect(getDatasetRowCounts(quiver(5), datasets)).toEqual({
      unnamed: 5,
      named: { a: 3 },
    })
    expect(getDatasetRowCounts(null, [])).toEqual({ unnamed: null, named: {} })
  })
})
