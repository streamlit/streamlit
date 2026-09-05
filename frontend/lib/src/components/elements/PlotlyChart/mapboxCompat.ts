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

import { getLogger } from "loglevel"

import type { Figure as PlotlyFigureType } from "~lib/util/reactPlotlyCompat"

/**
 * plotly.js v4 removed Mapbox traces, subplots, and `mapboxAccessToken`.
 * Python Plotly (and older figure JSON) still emits those names, so rewrite
 * them to the MapLibre `map` family before handing figures to plotly.js.
 *
 * Input is untyped wire JSON (v3 `mapbox` fields are not in v4 `Layout`).
 *
 * @see https://plotly.com/javascript/guides/migrating-to-v4/
 */

const LOG = getLogger("PlotlyChart:mapboxCompat")

/** Figure JSON that may still use plotly.js v3 Mapbox field names. */
type LoosePlotlyFigure = {
  data?: unknown
  layout?: unknown
  frames?: unknown
}

const MAPBOX_TRACE_TYPES: Record<string, string> = {
  scattermapbox: "scattermap",
  choroplethmapbox: "choroplethmap",
  densitymapbox: "densitymap",
}

/**
 * Maps `mapbox://styles/mapbox/<slug>` URLs to plotly.js v4 built-in style
 * names. Most slugs keep their name; `navigation-*` has no v4 equivalent and
 * maps to the closest built-in.
 */
const MAPBOX_URL_STYLE_TO_MAP_STYLE: Record<string, string> = {
  basic: "basic",
  streets: "streets",
  outdoors: "outdoors",
  light: "light",
  dark: "dark",
  satellite: "satellite",
  "satellite-streets": "satellite-streets",
  "navigation-day": "streets",
  "navigation-night": "dark",
}

/** v3 named styles that plotly.js v4 / MapLibre no longer ships. */
const STAMEN_STYLE_ALIASES: Record<string, string> = {
  "stamen-terrain": "carto-voyager",
  "stamen-toner": "carto-positron",
  "stamen-watercolor": "carto-voyager",
}

/** plotly.js v4 `styleValueDflt` when a Mapbox style cannot be mapped. */
const FALLBACK_MAP_STYLE = "basic"

const MAPBOX_MODEBAR_BUTTONS: Record<string, string> = {
  zoomInMapbox: "zoomInMap",
  zoomOutMapbox: "zoomOutMap",
  resetViewMapbox: "resetViewMap",
}

/**
 * First-segment attrs of Plotly map subplot restyle/relayout paths
 * (`mapbox.zoom`, `mapbox.layers[0].visible`). Used so hostnames such as
 * `mapbox.com` are not treated as attribute paths.
 */
const MAPBOX_RESTYLE_FIRST_ATTR =
  /^(?:accesstoken|accessToken|bearing|bounds|center|domain|fitbounds|layers|pitch|style|uirevision|zoom)\b/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Rename `mapbox` / `mapbox2` subplot ids to `map` / `map2`.
 * Non-mapbox ids are returned unchanged.
 */
function migrateMapboxSubplotId(id: unknown): unknown {
  if (typeof id !== "string") {
    return id
  }
  if (id === "mapbox") {
    return "map"
  }
  const numbered = /^mapbox(\d+)$/.exec(id)
  if (numbered) {
    return `map${numbered[1]}`
  }
  return id
}

/**
 * Map official Mapbox style URLs and v3-only Stamen names to built-in
 * MapLibre styles. Custom `mapbox://` URLs cannot be fetched by MapLibre,
 * so they fall back to `basic` after a warning so traces stay visible.
 */
function migrateMapboxStyle(style: unknown): unknown {
  if (typeof style !== "string") {
    return style
  }

  const stamenAlias = STAMEN_STYLE_ALIASES[style.toLowerCase()]
  if (stamenAlias) {
    return stamenAlias
  }

  const mapboxUrl =
    /^mapbox:\/\/styles\/mapbox\/([a-z0-9-]+?)(?:-v\d+)?$/i.exec(style)
  if (mapboxUrl) {
    const mappedStyle =
      MAPBOX_URL_STYLE_TO_MAP_STYLE[mapboxUrl[1].toLowerCase()]
    if (mappedStyle) {
      return mappedStyle
    }
  }

  if (style.startsWith("mapbox://")) {
    LOG.warn(
      `Plotly map style "${style}" is not supported by plotly.js v4 ` +
        `(MapLibre). Falling back to "${FALLBACK_MAP_STYLE}" so map ` +
        `traces stay visible. Use a built-in style such as ` +
        `"open-street-map", "carto-positron", "carto-darkmatter", ` +
        `or "carto-voyager".`
    )
    return FALLBACK_MAP_STYLE
  }

  return style
}

/** Drop the Mapbox access token and rewrite the subplot style. */
function migrateMapboxSubplot(value: unknown): Record<string, unknown> {
  const mapLayout = isRecord(value) ? { ...value } : {}
  delete mapLayout.accesstoken
  delete mapLayout.accessToken
  if ("style" in mapLayout) {
    mapLayout.style = migrateMapboxStyle(mapLayout.style)
  }
  return mapLayout
}

function migrateTemplateData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  const pending: Array<[string, unknown]> = []

  for (const [traceType, traces] of Object.entries(data)) {
    const migratedTraces = Array.isArray(traces)
      ? traces.map(trace => migratePlotlyMapboxTrace(trace))
      : traces
    const migratedType = MAPBOX_TRACE_TYPES[traceType]
    if (migratedType) {
      pending.push([migratedType, migratedTraces])
    } else {
      next[traceType] = migratedTraces
    }
  }

  // Keep existing v4 template keys. Only add a migrated mapbox key when
  // the target is absent so scattermapbox cannot overwrite scattermap.
  for (const [traceType, traces] of pending) {
    if (!(traceType in next)) {
      next[traceType] = traces
    }
  }

  return next
}

function migrateTemplate(
  template: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...template }
  if (isRecord(next.layout)) {
    next.layout = migratePlotlyMapboxLayout(next.layout)
  }
  if (isRecord(next.data)) {
    next.data = migrateTemplateData(next.data)
  }
  return next
}

function migratePlotlyMapboxLayout(
  layout: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  const pendingMaps: Array<[string, unknown]> = []

  for (const [key, value] of Object.entries(layout)) {
    if (key === "mapbox" || /^mapbox\d+$/.test(key)) {
      pendingMaps.push([migrateMapboxSubplotId(key) as string, value])
      continue
    }
    if (key === "map" || /^map\d+$/.test(key)) {
      next[key] = migrateMapboxSubplot(value)
      continue
    }
    if (key === "template" && isRecord(value)) {
      next.template = migrateTemplate(value)
      continue
    }
    next[key] = migrateMapboxNestedRefs(value)
  }

  // Apply renamed map* keys last so an existing layout.map wins over a
  // migrated layout.mapbox, regardless of key order.
  for (const [mapKey, value] of pendingMaps) {
    const migrated = migrateMapboxSubplot(value)
    const existing = next[mapKey]
    next[mapKey] = isRecord(existing) ? { ...migrated, ...existing } : migrated
  }

  return next
}

function migratePlotlyMapboxTrace(trace: unknown): unknown {
  if (!isRecord(trace)) {
    return trace
  }

  const next: Record<string, unknown> = { ...trace }
  if (typeof next.type === "string") {
    const migratedType = MAPBOX_TRACE_TYPES[next.type]
    if (migratedType) {
      next.type = migratedType
    }
  }
  if ("subplot" in next) {
    next.subplot = migrateMapboxSubplotId(next.subplot)
  }
  return next
}

function migratePlotlyMapboxFrame(frame: unknown): unknown {
  if (!isRecord(frame)) {
    return frame
  }

  const next: Record<string, unknown> = { ...frame }
  if (Array.isArray(frame.data)) {
    next.data = frame.data.map(migratePlotlyMapboxTrace)
  }
  if (isRecord(frame.layout)) {
    next.layout = migratePlotlyMapboxLayout(frame.layout)
  }
  return next
}

function migrateModeBarName(name: string): string {
  return MAPBOX_MODEBAR_BUTTONS[name] ?? name
}

function isMapboxRestylePath(value: string): boolean {
  const match = /^(layout\.)?mapbox(\d*)(.*)$/.exec(value)
  if (!match) {
    return false
  }
  const rest = match[3]
  return (
    rest === "" ||
    (rest.startsWith(".") && MAPBOX_RESTYLE_FIRST_ATTR.test(rest.slice(1)))
  )
}

/**
 * Rewrite a Plotly restyle/relayout attr string or subplot id.
 * Unrelated text, URLs, and hostnames are returned unchanged.
 */
function migrateMapboxAttrString(value: string): string {
  const modebarName = migrateModeBarName(value)
  if (modebarName !== value) {
    return modebarName
  }
  if (!isMapboxRestylePath(value)) {
    return value
  }
  return value.replace(
    /^(layout\.)?mapbox(\d*)(?=\.|$)/,
    (_match, layoutPrefix: string | undefined, n: string) =>
      `${layoutPrefix ?? ""}${n ? `map${n}` : "map"}`
  )
}

/**
 * Rewrite leftover v3 Mapbox identifiers in nested layout values such as
 * `layout.modebar.add`/`remove` and updatemenu/slider `args` (string paths
 * and object keys: `mapbox.zoom` → `map.zoom`, `{ mapbox: … }` → `{ map: … }`).
 */
function migrateMapboxNestedRefs(value: unknown): unknown {
  if (typeof value === "string") {
    return migrateMapboxAttrString(value)
  }
  if (Array.isArray(value)) {
    return value.map(item => migrateMapboxNestedRefs(item))
  }
  if (isRecord(value)) {
    const next: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value)) {
      const migratedKey = migrateMapboxAttrString(key)
      const migratedValue = migrateMapboxNestedRefs(nested)
      if (migratedKey !== key && migratedKey in next) {
        // An existing v4 key wins over a migrated v3 key.
        continue
      }
      next[migratedKey] = migratedValue
    }
    return next
  }
  return value
}

function migrateModeBarButton(button: unknown): unknown {
  if (typeof button === "string") {
    return migrateModeBarName(button)
  }
  if (isRecord(button) && typeof button.name === "string") {
    return { ...button, name: migrateModeBarName(button.name) }
  }
  return button
}

function migrateModeBarButtons(buttons: unknown): unknown {
  if (!Array.isArray(buttons)) {
    return buttons
  }
  return buttons.map(button =>
    Array.isArray(button)
      ? migrateModeBarButtons(button)
      : migrateModeBarButton(button)
  )
}

/**
 * Rewrite a plotly.js v3 Mapbox figure to the v4 MapLibre `map` API
 * while preserving already-migrated values.
 */
export function migratePlotlyMapboxFigure(
  figure: LoosePlotlyFigure
): PlotlyFigureType {
  return {
    ...figure,
    data: Array.isArray(figure.data)
      ? figure.data.map(migratePlotlyMapboxTrace)
      : (figure.data ?? []),
    layout: isRecord(figure.layout)
      ? migratePlotlyMapboxLayout(figure.layout)
      : (figure.layout ?? {}),
    frames: Array.isArray(figure.frames)
      ? figure.frames.map(migratePlotlyMapboxFrame)
      : (figure.frames ?? null),
  } as PlotlyFigureType
}

/**
 * Drop `mapboxAccessToken`, map `showEditInChartStudio` to `showSendToCloud`,
 * and rename mapbox modebar / scrollZoom values so plotly.js v4 config
 * objects stay valid.
 */
export function migratePlotlyMapboxConfig<T extends object>(config: T): T {
  const next = { ...config } as Record<string, unknown>
  delete next.mapboxAccessToken

  if (
    next.showSendToCloud === undefined &&
    next.showEditInChartStudio === true
  ) {
    next.showSendToCloud = true
  }
  delete next.showEditInChartStudio

  if (typeof next.scrollZoom === "string") {
    next.scrollZoom = next.scrollZoom.replaceAll("mapbox", "map")
  }

  for (const key of [
    "modeBarButtonsToRemove",
    "modeBarButtonsToAdd",
    "modeBarButtons",
  ]) {
    if (key in next) {
      next[key] = migrateModeBarButtons(next[key])
    }
  }

  return next as T
}
