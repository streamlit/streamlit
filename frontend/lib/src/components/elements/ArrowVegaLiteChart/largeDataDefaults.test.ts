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

const ABOVE = Math.max(CANVAS_RENDERER_THRESHOLD, MARK_ARIA_THRESHOLD) + 1

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
    encoding: {
      x: { field: "x", type: "quantitative" },
      y: { field: "y", type: "quantitative" },
    },
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

function markAriaOf(spec: Spec): unknown {
  const config = spec.config as Spec | undefined
  return (config?.mark as Spec | undefined)?.aria
}

describe("applyLargeDataDefaults: canvas renderer", () => {
  it.each([
    "point",
    "circle",
    "square",
    "bar",
    "rect",
    "tick",
    "rule",
    "text",
  ])("renders a %s chart above the threshold to canvas", mark => {
    const spec = prepare(unitSpec(mark), counts(CANVAS_RENDERER_THRESHOLD + 1))
    expect(rendererOf(spec)).toBe("canvas")
  })

  it("keeps SVG at the threshold", () => {
    const spec = prepare(
      unitSpec({ type: "point" }),
      counts(CANVAS_RENDERER_THRESHOLD)
    )
    expect(spec).not.toHaveProperty("usermeta")
  })

  it.each(["line", "area", "trail"])(
    "keeps SVG for a %s chart, which draws one path",
    mark => {
      expect(rendererOf(prepare(unitSpec(mark), counts(100_000)))).toBe(
        undefined
      )
    }
  )

  it.each(["svg", "canvas"])("keeps the author's %s renderer", renderer => {
    const spec = prepare(
      unitSpec("point", {
        usermeta: { embedOptions: { renderer, padding: 5 }, note: "x" },
      }),
      counts(ABOVE)
    )
    expect(spec.usermeta).toEqual({
      embedOptions: { renderer, padding: 5 },
      note: "x",
    })
  })

  it("keeps other usermeta keys when it sets the renderer", () => {
    const spec = prepare(
      unitSpec("point", { usermeta: { embedOptions: { padding: 5 }, a: 1 } }),
      counts(ABOVE)
    )
    expect(spec.usermeta).toEqual({
      embedOptions: { padding: 5, renderer: "canvas" },
      a: 1,
    })
  })

  it("leaves usermeta that isn't an object alone", () => {
    const spec = prepare(unitSpec("point", { usermeta: [1] }), counts(ABOVE))
    expect(spec.usermeta).toEqual([1])
  })

  it.each([
    ["an aggregate", { y: { aggregate: "count", type: "quantitative" } }],
    [
      "an aggregate in a tooltip list",
      { tooltip: [{ field: "y", aggregate: "mean" }] },
    ],
  ])("skips a view with %s", (_, encoding) => {
    const spec = unitSpec("bar")
    spec.encoding = { ...(spec.encoding as Spec), ...encoding }
    expect(rendererOf(prepare(spec, counts(100_000)))).toBe(undefined)
  })

  it.each([
    ["aggregate", { aggregate: [{ op: "count", as: "n" }], groupby: ["x"] }],
    ["filter", { filter: "datum.y > 0" }],
    ["sample", { sample: 100 }],
    ["density", { density: "y" }],
  ])("skips a view with a %s transform", (_, transform) => {
    const spec = unitSpec("point", { transform: [transform] })
    expect(rendererOf(prepare(spec, counts(100_000)))).toBe(undefined)
  })

  it.each([
    ["calculate", { calculate: "datum.y * 2", as: "y2" }],
    ["fold", { fold: ["a", "b"] }],
    ["window", { window: [{ op: "rank", as: "rank" }] }],
  ])("counts a view with a %s transform", (_, transform) => {
    const spec = unitSpec("point", { transform: [transform] })
    expect(rendererOf(prepare(spec, counts(ABOVE)))).toBe("canvas")
  })

  it("skips composite marks, which aggregate", () => {
    expect(rendererOf(prepare(unitSpec("boxplot"), counts(100_000)))).toBe(
      undefined
    )
  })
})

describe("applyLargeDataDefaults: row counts", () => {
  it("reads unnamed data for views without data", () => {
    const spec = unitSpec("point")
    delete spec.data
    expect(rendererOf(prepare(spec, counts(0, ABOVE)))).toBe("canvas")
  })

  it("counts inline values and inline datasets", () => {
    const values = Array.from({ length: ABOVE }, (_, i) => ({ x: i, y: i }))
    expect(
      rendererOf(prepare(unitSpec("point", { data: { values } }), counts(0)))
    ).toBe("canvas")
    const inline = unitSpec("point", {
      data: { name: "inline" },
      datasets: { inline: values },
    })
    expect(rendererOf(prepare(inline, counts(0)))).toBe("canvas")
  })

  it.each([
    ["a URL", { url: "data.csv" }],
    ["a generator", { sequence: { start: 0, stop: 100_000 } }],
    ["an unknown name", { name: "missing" }],
    ["no data", null],
  ])("skips data from %s", (_, data) => {
    const spec = prepare(unitSpec("point", { data }), counts(100_000, 100_000))
    expect(spec).not.toHaveProperty("usermeta")
    expect(spec).not.toHaveProperty("config")
  })

  it("sums the marks of layered views", () => {
    const half = Math.ceil(ABOVE / 2)
    const spec: Spec = {
      data: { name: "points" },
      layer: [unitSpec("point", { data: undefined }), { mark: "circle" }],
    }
    expect(rendererOf(prepare(spec, counts(half)))).toBe("canvas")
  })

  it("lets layer children replace the inherited data", () => {
    const spec: Spec = {
      data: { name: "points" },
      layer: [
        { data: { values: [{ x: 1 }] }, mark: "point" },
        { data: { values: [{ x: 1 }] }, mark: "rule" },
      ],
    }
    expect(rendererOf(prepare(spec, counts(100_000)))).toBe(undefined)
  })

  it("sums concatenated views", () => {
    const half = Math.ceil(ABOVE / 2)
    for (const key of ["hconcat", "vconcat", "concat"]) {
      const spec: Spec = {
        [key]: [unitSpec("point"), unitSpec("tick")],
      }
      expect(rendererOf(prepare(spec, counts(half)))).toBe("canvas")
    }
  })

  it("does not count children of a filtered parent", () => {
    const spec: Spec = {
      data: { name: "points" },
      transform: [{ filter: "datum.y > 0" }],
      layer: [{ mark: "point" }],
    }
    expect(rendererOf(prepare(spec, counts(100_000)))).toBe(undefined)
  })

  it("counts a facet's rows once and a repeat's once per cell", () => {
    const facet: Spec = {
      data: { name: "points" },
      facet: { field: "group", type: "nominal" },
      spec: { mark: "point" },
    }
    expect(rendererOf(prepare(facet, counts(CANVAS_RENDERER_THRESHOLD)))).toBe(
      undefined
    )

    const repeat: Spec = {
      data: { name: "points" },
      repeat: { row: ["a", "b"], column: ["c", "d"] },
      spec: { mark: "point" },
    }
    const quarter = Math.ceil(ABOVE / 4)
    expect(rendererOf(prepare(repeat, counts(quarter)))).toBe("canvas")
  })
})

describe("applyLargeDataDefaults: mark ARIA", () => {
  it("turns off mark ARIA above the threshold, lines included", () => {
    const spec = prepare(
      unitSpec("line", { config: { mark: { color: "red" } } }),
      counts(MARK_ARIA_THRESHOLD + 1)
    )
    expect(spec.config).toEqual({ mark: { color: "red", aria: false } })
  })

  it("keeps mark ARIA at the threshold", () => {
    const spec = prepare(unitSpec("line"), counts(MARK_ARIA_THRESHOLD))
    expect(spec).not.toHaveProperty("config")
  })

  it.each([
    ["config.aria", { aria: true }],
    ["config.aria false", { aria: false }],
    ["config.mark.aria", { mark: { aria: true } }],
  ])("keeps the author's %s", (_, config) => {
    const spec = prepare(unitSpec("point", { config }), counts(ABOVE))
    expect(spec.config).toEqual(config)
  })

  it.each([
    ["a mark description", { type: "point", description: "A point" }, {}],
    ["a description channel", "point", { description: { field: "x" } }],
  ])("keeps ARIA for views with %s", (_, mark, encoding) => {
    const spec = unitSpec(mark)
    spec.encoding = { ...(spec.encoding as Spec), ...encoding }
    expect(markAriaOf(prepare(spec, counts(ABOVE)))).toBe(undefined)
  })

  it("sets canvas and mark ARIA independently", () => {
    const spec = prepare(
      unitSpec("point", { config: { aria: true } }),
      counts(ABOVE)
    )
    expect(rendererOf(spec)).toBe("canvas")
    expect(spec.config).toEqual({ aria: true })
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
