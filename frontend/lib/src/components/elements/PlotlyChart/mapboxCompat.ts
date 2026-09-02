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
 * Mapbox Studio style slugs from `mapbox://styles/mapbox/<slug>[-vN]` URLs.
 * Identity rows are the v4 built-in allowlist; navigation entries are the
 * closest MapLibre fallbacks.
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

const MAPBOX_MODEBAR_BUTTONS: Record<string, string> = {
  zoomInMapbox: "zoomInMap",
  zoomOutMapbox: "zoomOutMap",
  resetViewMapbox: "resetViewMap",
}

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
 * MapLibre styles. Custom `mapbox://` URLs and unknown removed names are
 * left unchanged, with a warning because MapLibre treats them as style URLs.
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
      `Plotly map style "${style}" is not supported by plotly.js v4 (MapLibre). ` +
        `Use a built-in style such as "open-street-map", "carto-positron", ` +
        `"carto-darkmatter", or "carto-voyager".`
    )
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

function migrateTemplate(
  template: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...template }
  if (isRecord(next.layout)) {
    next.layout = migratePlotlyMapboxLayout(next.layout)
  }
  if (isRecord(next.data)) {
    next.data = Object.fromEntries(
      Object.entries(next.data).map(([traceType, traces]) => {
        const migratedType = MAPBOX_TRACE_TYPES[traceType] ?? traceType
        const migratedTraces = Array.isArray(traces)
          ? traces.map(trace => migratePlotlyMapboxTrace(trace))
          : traces
        return [migratedType, migratedTraces]
      })
    )
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
    if (key === "template" && isRecord(value)) {
      next.template = migrateTemplate(value)
      continue
    }
    next[key] = value
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

function migrateModeBarButton(button: unknown): unknown {
  if (typeof button === "string") {
    return migrateModeBarName(button)
  }
  if (isRecord(button) && typeof button.name === "string") {
    return { ...button, name: migrateModeBarName(button.name) }
  }
  return button
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
 * Drop `mapboxAccessToken` and rename mapbox modebar / scrollZoom values
 * so plotly.js v4 config objects stay valid.
 */
export function migratePlotlyMapboxConfig<T extends object>(config: T): T {
  const next = { ...config } as Record<string, unknown>
  delete next.mapboxAccessToken

  if (typeof next.scrollZoom === "string") {
    next.scrollZoom = next.scrollZoom.replaceAll("mapbox", "map")
  }

  for (const key of ["modeBarButtonsToRemove", "modeBarButtonsToAdd"]) {
    const buttons = next[key]
    if (Array.isArray(buttons)) {
      next[key] = buttons.map(migrateModeBarButton)
    }
  }

  return next as T
}
