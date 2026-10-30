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

/** Marks whose items are data points but that draw one path per series. */
const PATH_MARKS: ReadonlySet<string> = new Set(["line", "area", "trail"])

/**
 * Transform operators that keep every input row, so the dataset size bounds
 * the marks from below.
 */
const ROW_PRESERVING_TRANSFORMS: ReadonlySet<string> = new Set([
  "bin",
  "calculate",
  "extent",
  "flatten",
  "fold",
  "impute",
  "joinaggregate",
  "lookup",
  "stack",
  "timeUnit",
  "window",
])

/**
 * Transform operators that can drop rows. Some of them also take a key that
 * names a row-preserving operator (``density`` and ``regression`` take an
 * ``extent``), so a transform is identified by these first.
 */
const ROW_DROPPING_TRANSFORMS: ReadonlySet<string> = new Set([
  "aggregate",
  "density",
  "filter",
  "loess",
  "pivot",
  "quantile",
  "regression",
  "sample",
])

/** View keys that hold child views, which inherit the parent's data. */
const COMPOSITION_KEYS = ["layer", "concat", "hconcat", "vconcat"] as const

/** Per-view tallies of drawn data points. */
interface MarkCounts {
  /** Data points drawn as per-datum marks (points, bars, …). */
  perDatum: number
  /** Data points drawn by any counted mark, paths included. */
  total: number
  /** A view sets its own mark description, so mark ARIA must stay on. */
  hasAuthoredDescription: boolean
}

const NO_MARKS: MarkCounts = {
  perDatum: 0,
  total: 0,
  hasAuthoredDescription: false,
}

function addCounts(a: MarkCounts, b: MarkCounts): MarkCounts {
  return {
    perDatum: a.perDatum + b.perDatum,
    total: a.total + b.total,
    hasAuthoredDescription:
      a.hasAuthoredDescription || b.hasAuthoredDescription,
  }
}

function scaleCounts(counts: MarkCounts, factor: number): MarkCounts {
  return {
    ...counts,
    perDatum: counts.perDatum * factor,
    total: counts.total * factor,
  }
}

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

/**
 * The rows a view's ``data`` provides, ``undefined`` to inherit the parent's
 * data, or ``null`` if the size is unknown (URLs, generators, GeoJSON).
 */
function resolveDataRows(
  data: unknown,
  spec: SpecObject,
  rowCounts: DatasetRowCounts
): number | null | undefined {
  if (data === undefined) {
    return undefined
  }
  if (!isPlainObject(data)) {
    return null
  }
  const { name, values } = data as SpecObject
  if (Array.isArray(values)) {
    return values.length
  }
  if (typeof name === "string") {
    if (name in rowCounts.named) {
      return rowCounts.named[name]
    }
    const inline = isPlainObject(spec.datasets)
      ? (spec.datasets as SpecObject)[name]
      : undefined
    return Array.isArray(inline) ? inline.length : null
  }
  return null
}

function preservesRows(transforms: unknown): boolean {
  if (transforms === undefined) {
    return true
  }
  return (
    Array.isArray(transforms) &&
    transforms.every(transform => {
      if (!isPlainObject(transform)) {
        return false
      }
      const keys = Object.keys(transform as SpecObject)
      return (
        !keys.some(key => ROW_DROPPING_TRANSFORMS.has(key)) &&
        keys.some(key => ROW_PRESERVING_TRANSFORMS.has(key))
      )
    })
  )
}

function getEncoding(view: SpecObject): SpecObject {
  return isPlainObject(view.encoding) ? (view.encoding as SpecObject) : {}
}

function hasAggregate(encoding: SpecObject): boolean {
  return Object.values(encoding).some(channel =>
    (Array.isArray(channel) ? channel : [channel]).some(
      definition =>
        isPlainObject(definition) && "aggregate" in (definition as SpecObject)
    )
  )
}

/** The number of times a ``repeat`` operator draws its child view. */
function countRepeats(repeat: unknown): number {
  if (Array.isArray(repeat)) {
    return repeat.length
  }
  if (!isPlainObject(repeat)) {
    return 1
  }
  return Object.values(repeat as SpecObject).reduce<number>(
    (product, fields) =>
      Array.isArray(fields) ? product * Math.max(fields.length, 1) : product,
    1
  )
}

/**
 * Count a unit view's data points.
 *
 * @param rows The rows the view draws, or ``null`` if unknown.
 * @param inheritsAggregate Whether a parent layer's encoding aggregates.
 */
function countUnitMarks(
  view: SpecObject,
  rows: number | null,
  inheritsAggregate: boolean
): MarkCounts {
  const markDef = isPlainObject(view.mark)
    ? (view.mark as SpecObject)
    : { type: view.mark }
  const encoding = getEncoding(view)
  const hasAuthoredDescription =
    "description" in markDef || "description" in encoding
  const markType = markDef.type
  // Aggregated views draw one mark per group, not one per row.
  if (
    rows === null ||
    inheritsAggregate ||
    typeof markType !== "string" ||
    hasAggregate(encoding)
  ) {
    return { ...NO_MARKS, hasAuthoredDescription }
  }
  const isPerDatum = PER_DATUM_MARKS.has(markType)
  if (!isPerDatum && !PATH_MARKS.has(markType)) {
    return { ...NO_MARKS, hasAuthoredDescription }
  }
  return {
    perDatum: isPerDatum ? rows : 0,
    total: rows,
    hasAuthoredDescription,
  }
}

/**
 * Count the data points a view draws, walking layers, concatenations,
 * facets, and repeats. Every unit view adds its own points, so a layered or
 * concatenated chart counts the sum over its views, and a repeated view counts
 * once per repetition. Views whose size can't be known count as zero.
 */
function countMarks(
  view: unknown,
  inheritedRows: number | null,
  inheritsAggregate: boolean,
  spec: SpecObject,
  rowCounts: DatasetRowCounts
): MarkCounts {
  if (!isPlainObject(view)) {
    return NO_MARKS
  }
  const viewSpec = view as SpecObject
  const ownRows = resolveDataRows(viewSpec.data, spec, rowCounts)
  const rows = ownRows === undefined ? inheritedRows : ownRows
  // A transform that may drop rows makes the row count unknown for this view
  // and its children.
  const childRows =
    rows !== null && preservesRows(viewSpec.transform) ? rows : null

  if ("mark" in viewSpec) {
    return countUnitMarks(viewSpec, childRows, inheritsAggregate)
  }

  // Layer children inherit the layer's encoding, aggregates and descriptions
  // included. Concatenated, faceted, and repeated views don't.
  const encoding = getEncoding(viewSpec)
  const layerAggregates = inheritsAggregate || hasAggregate(encoding)
  let counts: MarkCounts = {
    ...NO_MARKS,
    hasAuthoredDescription: "description" in encoding,
  }
  for (const key of COMPOSITION_KEYS) {
    const children = viewSpec[key]
    if (Array.isArray(children)) {
      for (const child of children) {
        const childAggregates = key === "layer" && layerAggregates
        counts = addCounts(
          counts,
          countMarks(child, childRows, childAggregates, spec, rowCounts)
        )
      }
    }
  }
  if ("spec" in viewSpec) {
    // A facet splits its rows across the cells; a repeat draws all of them in
    // each cell.
    const child = countMarks(viewSpec.spec, childRows, false, spec, rowCounts)
    counts = addCounts(
      counts,
      scaleCounts(child, countRepeats(viewSpec.repeat))
    )
  }
  return counts
}

/** A shallow copy of a plain object, or ``{}`` for any other value. */
function copyPlainObject(value: unknown): SpecObject {
  return isPlainObject(value) ? { ...(value as SpecObject) } : {}
}

/**
 * Fill rendering settings that keep large Vega-Lite charts responsive.
 *
 * Applied only to settings the author left unset, and only above the sizes
 * where the default SVG output is slow to draw and to interact with:
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
 * Row counts come from the chart's Arrow datasets and inline values. Layered,
 * concatenated, and repeated views add up their marks. Views that aggregate
 * or filter their data, or load it from a URL, aren't counted.
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
  const counts = countMarks(spec, rowCounts.unnamed, false, spec, rowCounts)

  if (counts.perDatum > CANVAS_RENDERER_THRESHOLD) {
    const { usermeta } = spec
    if (usermeta === undefined || isPlainObject(usermeta)) {
      const usermetaObject = copyPlainObject(usermeta)
      const embedOptions = copyPlainObject(usermetaObject.embedOptions)
      if (embedOptions.renderer === undefined) {
        spec.usermeta = {
          ...usermetaObject,
          embedOptions: { ...embedOptions, renderer: "canvas" },
        }
      }
    }
  }

  if (counts.total > MARK_ARIA_THRESHOLD && !counts.hasAuthoredDescription) {
    const config = copyPlainObject(spec.config)
    const markConfig = copyPlainObject(config.mark)
    if (config.aria === undefined && markConfig.aria === undefined) {
      spec.config = { ...config, mark: { ...markConfig, aria: false } }
    }
  }
}
