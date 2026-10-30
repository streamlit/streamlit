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

import { isPlainObject } from "lodash-es"

import type { Quiver } from "~lib/dataframes/Quiver"

import type { WrappedNamedDataset } from "./arrowUtils"

type SpecObject = Record<string, unknown>

/** The row count of each Arrow dataset sent with a chart. */
export interface DatasetRowCounts {
  /** Rows of the unnamed dataset that views without ``data`` read. */
  unnamed: number | null
  /** Rows of each named dataset, by name. */
  named: Readonly<Record<string, number>>
}

/**
 * Charts that draw more per-datum marks than this render to a canvas. An SVG
 * scatter plot of 2,000 overlapping points already takes about 70 ms per
 * pointer move, and 230 ms at 5,000; a canvas stays within one frame.
 */
export const CANVAS_RENDERER_THRESHOLD = 2000

/**
 * Charts that draw marks for more data points than this skip the per-mark
 * ARIA descriptions, which Vega evaluates once per data point.
 */
export const MARK_ARIA_THRESHOLD = 5000

/**
 * Marks that draw one SVG element per data point. Line, area, and trail draw
 * one path per series instead, so the renderer barely affects them.
 */
const PER_DATUM_MARKS: ReadonlySet<string> = new Set([
  "point",
  "circle",
  "square",
  "rect",
  "bar",
  "tick",
  "rule",
  "text",
])

const PATH_MARKS: ReadonlySet<string> = new Set(["line", "area", "trail"])

interface MarkCounts {
  /** Rows drawn by per-datum marks; compared with the canvas threshold. */
  perDatum: number
  /** Rows drawn by per-datum and path marks; compared with the ARIA one. */
  total: number
}

const NO_MARKS: MarkCounts = { perDatum: 0, total: 0 }

/** Read the row counts of a chart's Arrow datasets. */
export function getDatasetRowCounts(
  data: Quiver | null,
  datasets: WrappedNamedDataset[]
): DatasetRowCounts {
  const named: Record<string, number> = {}
  for (const dataset of datasets) {
    if (dataset.hasName && dataset.name !== null) {
      named[dataset.name] = dataset.data.dimensions.numDataRows
    }
  }
  return { unnamed: data?.dimensions.numDataRows ?? null, named }
}

function asObject(value: unknown): SpecObject {
  return isPlainObject(value) ? (value as SpecObject) : {}
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function hasAggregate(encoding: SpecObject): boolean {
  return Object.values(encoding).some(channel =>
    (Array.isArray(channel) ? channel : [channel]).some(
      definition => "aggregate" in asObject(definition)
    )
  )
}

/**
 * Count the data points a view draws. Layered and concatenated views add up,
 * and faceted or repeated views count their rows once. A view counts as zero
 * when its rows are unknown: its data isn't an Arrow dataset, or it has a
 * transform (which may drop rows) or an aggregate (one mark per group).
 *
 * @param inheritedRows The rows of the parent's data.
 * @param inheritsAggregate Whether a parent layer's encoding aggregates.
 */
function countMarks(
  view: unknown,
  inheritedRows: number | null,
  inheritsAggregate: boolean,
  rowCounts: DatasetRowCounts
): MarkCounts {
  if (!isPlainObject(view)) {
    return NO_MARKS
  }
  const viewSpec = view as SpecObject
  const { name } = asObject(viewSpec.data)
  let rows = inheritedRows
  if (viewSpec.data !== undefined) {
    rows = typeof name === "string" ? (rowCounts.named[name] ?? null) : null
  }
  if (viewSpec.transform !== undefined) {
    rows = null
  }
  // Layer children inherit the layer's encoding; other compositions don't.
  const aggregates =
    inheritsAggregate || hasAggregate(asObject(viewSpec.encoding))

  if ("mark" in viewSpec) {
    const markType = isPlainObject(viewSpec.mark)
      ? asObject(viewSpec.mark).type
      : viewSpec.mark
    if (rows === null || aggregates || typeof markType !== "string") {
      return NO_MARKS
    }
    const isPerDatum = PER_DATUM_MARKS.has(markType)
    return {
      perDatum: isPerDatum ? rows : 0,
      total: isPerDatum || PATH_MARKS.has(markType) ? rows : 0,
    }
  }

  let counts = NO_MARKS
  const addChild = (child: unknown, childAggregates: boolean): void => {
    const childCounts = countMarks(child, rows, childAggregates, rowCounts)
    counts = {
      perDatum: counts.perDatum + childCounts.perDatum,
      total: counts.total + childCounts.total,
    }
  }
  for (const child of asList(viewSpec.layer)) {
    addChild(child, aggregates)
  }
  for (const child of [
    ...asList(viewSpec.concat),
    ...asList(viewSpec.hconcat),
    ...asList(viewSpec.vconcat),
    viewSpec.spec,
  ]) {
    addChild(child, false)
  }
  return counts
}

/**
 * Fill rendering settings that keep large Vega-Lite charts responsive, where
 * the author left them unset:
 *
 * - The canvas renderer when the chart draws more than 2,000 per-datum marks
 *   (points, bars, ticks, …). An SVG chart creates one element per mark, so
 *   pointer moves slow down with every mark and the browser accessibility
 *   tree grows with them. A canvas exposes only the chart's accessible name
 *   (``alt`` or ``description``), not its marks, axes, or legends.
 * - ``config.mark.aria = false`` when marks draw more than 5,000 data points.
 *   Vega-Lite otherwise evaluates a screen-reader description for every data
 *   point. On SVG charts, axes and legends stay in the accessibility tree.
 *
 * The spec is changed in place, like the other ``generateSpec`` steps.
 *
 * @param spec The parsed Vega-Lite spec, after the usermeta embed options
 * were sanitized.
 * @param rowCounts The row counts of the chart's Arrow datasets.
 */
export function applyLargeDataDefaults(
  spec: SpecObject,
  rowCounts: DatasetRowCounts
): void {
  const counts = countMarks(spec, rowCounts.unnamed, false, rowCounts)

  const usermeta = asObject(spec.usermeta)
  const embedOptions = asObject(usermeta.embedOptions)
  if (
    counts.perDatum > CANVAS_RENDERER_THRESHOLD &&
    embedOptions.renderer === undefined
  ) {
    spec.usermeta = {
      ...usermeta,
      embedOptions: { ...embedOptions, renderer: "canvas" },
    }
  }

  const config = asObject(spec.config)
  const markConfig = asObject(config.mark)
  if (
    counts.total > MARK_ARIA_THRESHOLD &&
    config.aria === undefined &&
    markConfig.aria === undefined
  ) {
    spec.config = { ...config, mark: { ...markConfig, aria: false } }
  }
}
