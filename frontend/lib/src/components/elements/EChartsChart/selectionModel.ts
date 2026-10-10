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

import { isEqual, isPlainObject } from "lodash-es"

import { isNullOrUndefined } from "~lib/util/utils"

/**
 * The shared selection-state contract serialized to the widget state. Keys are
 * snake_case to match the Python serde.
 */
export interface EChartsSelectionState {
  selected: Array<Record<string, unknown>>
  areas: Array<Record<string, unknown>>
}

/** A single entry of the ``selectchanged`` event's ``selected`` array. */
export interface SelectedEntry {
  seriesIndex: number
  dataType?: string
  dataIndex: number[]
}

export interface SelectChangedParams {
  selected?: SelectedEntry[]
  fromAction?: string
  fromActionPayload?: {
    type?: unknown
    seriesIndex?: unknown
    dataType?: unknown
    dataIndex?: unknown
    dataIndexInside?: unknown
  }
}

export interface BrushArea {
  brushType?: string
  coordRange?: unknown
  [key: string]: unknown
}

export interface BrushSelection {
  brushId?: string
  brushIndex: number
  areas?: BrushArea[]
  selected?: Array<{
    seriesIndex: number
    dataType?: string
    dataIndex: number[]
  }>
}

type BrushSelectedItem = NonNullable<BrushSelection["selected"]>[number]

export interface BrushSelectedParams {
  batch?: BrushSelection[]
}

export interface BrushEndParams {
  brushId?: string
  areas?: BrushArea[]
}

/** Enough of an ECharts instance to read its resolved option. */
interface ChartOptionSource {
  getOption(): unknown
}

/** Resolve the chart's current option as a plain object (or ``null``). */
function resolveChartOption(
  chart: ChartOptionSource
): Record<string, unknown> | null {
  const chartOption = chart.getOption()
  return isPlainObject(chartOption)
    ? (chartOption as Record<string, unknown>)
    : null
}

export function parseOptionSpec(spec: string): Record<string, unknown> | null {
  if (!spec) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(spec)
    return isPlainObject(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** True when the option has a top-level ``series`` ECharts can address. */
function optionHasUsableSeries(
  option: Record<string, unknown> | null
): boolean {
  if (option === null) {
    return false
  }
  const series = option.series
  if (Array.isArray(series)) {
    return series.length > 0
  }
  return isPlainObject(series)
}

/**
 * True when media or timeline variants can replace top-level ``series``.
 *
 * Those overrides live on ``media[*].option``, ``options[]``, or nested
 * ``baseOption`` copies of the same. ECharts events index the resolved
 * series, so selection metadata must not use the stale base spec.
 */
function optionHasSeriesOverridingVariants(
  option: Record<string, unknown> | null
): boolean {
  if (option === null) {
    return false
  }
  if (Array.isArray(option.media)) {
    const mediaOverridesSeries = option.media.some(entry => {
      if (!isPlainObject(entry)) {
        return false
      }
      const mediaOption = (entry as Record<string, unknown>).option
      return (
        isPlainObject(mediaOption) &&
        optionHasUsableSeries(mediaOption as Record<string, unknown>)
      )
    })
    if (mediaOverridesSeries) {
      return true
    }
  }
  if (Array.isArray(option.options)) {
    const timelineOverridesSeries = option.options.some(
      entry =>
        isPlainObject(entry) &&
        optionHasUsableSeries(entry as Record<string, unknown>)
    )
    if (timelineOverridesSeries) {
      return true
    }
  }
  return isPlainObject(option.baseOption)
    ? optionHasSeriesOverridingVariants(
        option.baseOption as Record<string, unknown>
      )
    : false
}

/**
 * Prefer the parsed spec when it has series that variants cannot override;
 * otherwise use ``getOption()``.
 *
 * Timeline and media specs often keep series on nested variants, so the raw
 * spec has no top-level ``series``. When they *do* set top-level series, an
 * active media/timeline variant can still replace it. ECharts' resolved
 * option is the one events index.
 */
export function resolveSelectionOption(
  parsedOption: Record<string, unknown> | null,
  chart: { getOption(): unknown }
): Record<string, unknown> | null {
  if (
    optionHasUsableSeries(parsedOption) &&
    !optionHasSeriesOverridingVariants(parsedOption)
  ) {
    return parsedOption
  }
  return resolveChartOption(chart) ?? parsedOption
}

const DATA_TYPE_RANK: Readonly<Record<string, number>> = {
  main: 0,
  node: 1,
  edge: 2,
}

interface SelectionGroup {
  seriesIndex: number
  dataType: string
  dataIndices: Set<number>
}

function normalizeDataType(dataType: string | undefined): string {
  return dataType ?? "main"
}

/**
 * User-configured series id/name only. ECharts ``getOption()`` backfills
 * auto-generated internal ids/names that contain a NUL separator; those must
 * not be reported as ``series_id`` / ``series_name``.
 */
function normalizeSeriesMetadata(value: unknown): string | number | null {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string" && value.length > 0 && !value.includes("\0")) {
    return value
  }
  return null
}

function getSeriesOption(
  resolvedOption: Record<string, unknown> | null,
  seriesIndex: number
): Record<string, unknown> | null {
  const seriesOption = resolvedOption?.series
  const series = Array.isArray(seriesOption)
    ? seriesOption[seriesIndex]
    : seriesIndex === 0
      ? seriesOption
      : undefined
  return isPlainObject(series) ? (series as Record<string, unknown>) : null
}

function getSeriesMetadata(
  resolvedOption: Record<string, unknown> | null,
  seriesIndex: number
): { seriesId: string | number | null; seriesName: string | number | null } {
  const seriesObject = getSeriesOption(resolvedOption, seriesIndex)

  return {
    seriesId: normalizeSeriesMetadata(seriesObject?.id),
    seriesName: normalizeSeriesMetadata(seriesObject?.name),
  }
}

function getNumberArray(value: unknown): number[] {
  const values = Array.isArray(value) ? value : [value]
  return values.filter(item => typeof item === "number")
}

function getGraphSeriesSelection(
  seriesIndex: number,
  seriesOption: Record<string, unknown>
): SelectedEntry[] {
  const nodes = Array.isArray(seriesOption.data)
    ? seriesOption.data
    : Array.isArray(seriesOption.nodes)
      ? seriesOption.nodes
      : []
  const edges = Array.isArray(seriesOption.links)
    ? seriesOption.links
    : Array.isArray(seriesOption.edges)
      ? seriesOption.edges
      : []
  return [
    {
      seriesIndex,
      dataType: "node",
      dataIndex: nodes.map((_, index) => index),
    },
    {
      seriesIndex,
      dataType: "edge",
      dataIndex: edges.map((_, index) => index),
    },
  ].filter(entry => entry.dataIndex.length > 0)
}

/**
 * ECharts 6 stores graph node and edge selection in one internal map, so its
 * full snapshot repeats matching raw indices for both data types. Apply the
 * typed action to our previous snapshot instead, preserving independent groups.
 */
export function normalizeNativeSelection(
  previous: SelectedEntry[],
  params: SelectChangedParams,
  getResolvedOption: () => Record<string, unknown> | null
): SelectedEntry[] {
  const payload = params.fromActionPayload
  const seriesIndex = payload?.seriesIndex
  const dataType = payload?.dataType
  // Cheap payload checks first so non-graph clicks never clone ``getOption()``.
  if (
    typeof seriesIndex !== "number" ||
    (dataType !== "node" && dataType !== "edge")
  ) {
    return params.selected ?? []
  }
  // Graph and Sankey (and any other linked node/edge series) share one
  // internal selected-index map, so the snapshot repeats matching raw
  // indices for both data types.
  const seriesOption = getSeriesOption(getResolvedOption(), seriesIndex)
  if (isNullOrUndefined(seriesOption)) {
    return params.selected ?? []
  }

  const action =
    params.fromAction ??
    (typeof payload?.type === "string" ? payload.type : undefined)
  const keyMatches = (entry: SelectedEntry): boolean =>
    entry.seriesIndex === seriesIndex &&
    normalizeDataType(entry.dataType) === dataType
  const previousIndices = new Set(previous.find(keyMatches)?.dataIndex ?? [])
  const actionIndices = getNumberArray(
    payload?.dataIndex ?? payload?.dataIndexInside
  )
  const selectedMode = seriesOption.selectedMode

  if (selectedMode === "series") {
    const next = previous.filter(entry => entry.seriesIndex !== seriesIndex)
    const isToggleOff =
      action === "unselect" ||
      (action?.startsWith("toggle") &&
        previous.some(entry => entry.seriesIndex === seriesIndex))
    return isToggleOff
      ? next
      : [...next, ...getGraphSeriesSelection(seriesIndex, seriesOption)]
  }

  // ECharts treats boolean ``true`` as ``"single"`` (see Series._innerSelect).
  if (selectedMode === "single" || selectedMode === true) {
    const wasSelected = actionIndices.every(index =>
      previousIndices.has(index)
    )
    previousIndices.clear()
    if (
      action !== "unselect" &&
      !(action?.startsWith("toggle") && wasSelected)
    ) {
      actionIndices.forEach(index => previousIndices.add(index))
    }
  } else {
    for (const index of actionIndices) {
      if (action === "unselect") {
        previousIndices.delete(index)
      } else if (action?.startsWith("toggle")) {
        if (previousIndices.has(index)) {
          previousIndices.delete(index)
        } else {
          previousIndices.add(index)
        }
      } else {
        previousIndices.add(index)
      }
    }
  }

  const replaceWholeSeries = selectedMode === "single" || selectedMode === true
  const next = previous
    .filter(
      entry =>
        !keyMatches(entry) &&
        !(replaceWholeSeries && entry.seriesIndex === seriesIndex)
    )
    .map(entry => ({ ...entry, dataIndex: [...entry.dataIndex] }))
  if (previousIndices.size > 0) {
    next.push({
      seriesIndex,
      dataType,
      dataIndex: Array.from(previousIndices),
    })
  }
  return next
}

function appendSelectedEntries(
  groups: Map<string, SelectionGroup>,
  entries: Array<SelectedEntry | BrushSelectedItem>
): void {
  for (const entry of entries) {
    if (typeof entry.seriesIndex !== "number") {
      continue
    }
    const dataType = normalizeDataType(entry.dataType)
    const key = JSON.stringify([entry.seriesIndex, dataType])
    let group = groups.get(key)
    if (!group) {
      group = {
        seriesIndex: entry.seriesIndex,
        dataType,
        dataIndices: new Set<number>(),
      }
      groups.set(key, group)
    }
    for (const dataIndex of entry.dataIndex ?? []) {
      if (typeof dataIndex === "number") {
        group.dataIndices.add(dataIndex)
      }
    }
  }
}

function compareDataTypes(left: string, right: string): number {
  const leftRank = DATA_TYPE_RANK[left] ?? 3
  const rightRank = DATA_TYPE_RANK[right] ?? 3
  return leftRank === rightRank
    ? left.localeCompare(right)
    : leftRank - rightRank
}

function buildSelectedGroups(
  resolvedOption: Record<string, unknown> | null,
  nativeSelection: SelectedEntry[],
  brushSelection: BrushSelection[]
): Array<Record<string, unknown>> {
  const groups = new Map<string, SelectionGroup>()
  appendSelectedEntries(groups, nativeSelection)
  for (const brush of brushSelection) {
    appendSelectedEntries(groups, brush.selected ?? [])
  }

  return Array.from(groups.values())
    .filter(group => group.dataIndices.size > 0)
    .toSorted(
      (left, right) =>
        left.seriesIndex - right.seriesIndex ||
        compareDataTypes(left.dataType, right.dataType)
    )
    .map(group => {
      const { seriesId, seriesName } = getSeriesMetadata(
        resolvedOption,
        group.seriesIndex
      )
      return {
        series_index: group.seriesIndex,
        series_id: seriesId,
        series_name: seriesName,
        data_type: group.dataType,
        data_indices: Array.from(group.dataIndices).toSorted(
          (left, right) => left - right
        ),
      }
    })
}

/**
 * Build the public ``areas`` payload from the brushed regions.
 *
 * Regions ECharts only describes in pixel space are left out: without a
 * ``coordRange`` there is nothing an app can map back to its data. They stay in
 * the privately persisted brush selection, so the on-screen overlay is still
 * restored after a rerun.
 */
function buildAreas(
  brushSelection: BrushSelection[]
): Array<Record<string, unknown>> {
  return brushSelection
    .toSorted((left, right) => left.brushIndex - right.brushIndex)
    .flatMap(brush =>
      (brush.areas ?? [])
        .filter(
          area =>
            typeof area.brushType === "string" &&
            Array.isArray(area.coordRange)
        )
        .map(area => ({
          brush_index: brush.brushIndex,
          brush_type: area.brushType,
          coord_range: area.coordRange,
        }))
    )
}

export function buildSelectionState(
  resolvedOption: Record<string, unknown> | null,
  nativeSelection: SelectedEntry[],
  brushSelection: BrushSelection[]
): EChartsSelectionState {
  return {
    selected: buildSelectedGroups(
      resolvedOption,
      nativeSelection,
      brushSelection
    ),
    areas: buildAreas(brushSelection),
  }
}

export function prunePixelOnlyBrushAreas(
  brushSelection: BrushSelection[]
): BrushSelection[] {
  return brushSelection.map(brush => {
    const areas = (brush.areas ?? []).filter(area =>
      Array.isArray(area.coordRange)
    )
    return {
      ...brush,
      areas,
      // Drop hit indices that belonged only to the removed overlay. Remaining
      // coord-range areas keep their previous ``selected`` snapshot.
      selected: areas.length === 0 ? [] : brush.selected,
    }
  })
}

export function hasNoBrushAreas(brushSelection: BrushSelection[]): boolean {
  return brushSelection.every(brush => (brush.areas ?? []).length === 0)
}

export function findBrushSelectionForEnd(
  brushSelection: BrushSelection[],
  params: BrushEndParams
): BrushSelection | undefined {
  return params.brushId === undefined
    ? brushSelection.length === 1
      ? brushSelection[0]
      : undefined
    : brushSelection.find(item => item.brushId === params.brushId)
}

function removeDuplicatePolygonEndpoint(value: unknown): unknown {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    !isEqual(value.at(-1), value.at(-2))
  ) {
    return value
  }
  return value.slice(0, -1)
}

function getComparableBrushArea(area: BrushArea): Record<string, unknown> {
  const isPolygon = area.brushType === "polygon"
  return {
    brushType: area.brushType,
    panelId: area.panelId,
    range: isPolygon ? removeDuplicatePolygonEndpoint(area.range) : area.range,
    coordRange: isPolygon
      ? removeDuplicatePolygonEndpoint(area.coordRange)
      : area.coordRange,
    coordRanges:
      isPolygon && Array.isArray(area.coordRanges)
        ? area.coordRanges.map(removeDuplicatePolygonEndpoint)
        : area.coordRanges,
  }
}

export function brushAreasEqual(
  left: BrushArea[],
  right: BrushArea[]
): boolean {
  return isEqual(
    left.map(getComparableBrushArea),
    right.map(getComparableBrushArea)
  )
}

export function brushEndMatchesSelection(
  brushSelection: BrushSelection[],
  params: BrushEndParams
): boolean {
  const brush = findBrushSelectionForEnd(brushSelection, params)
  return (
    brush !== undefined &&
    brushAreasEqual(brush.areas ?? [], params.areas ?? [])
  )
}

/**
 * Overlay a ``brushEnd`` onto the latest snapshot so a form submit can flush
 * before a throttled ``brushSelected`` arrives. Hit indices stay as they were
 * on the last snapshot (or empty); the delayed event replaces them.
 */
export function applyBrushEndToSelection(
  brushSelection: BrushSelection[],
  params: BrushEndParams
): BrushSelection[] {
  const existing = findBrushSelectionForEnd(brushSelection, params)
  if (existing !== undefined) {
    return brushSelection.map(item =>
      item === existing ? { ...item, areas: params.areas ?? [] } : item
    )
  }
  return [
    ...brushSelection,
    {
      brushId: params.brushId,
      brushIndex: brushSelection.length,
      areas: params.areas ?? [],
      selected: [],
    },
  ]
}
