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

import { MapView, View } from "@deck.gl/core"

import { isNullOrUndefined } from "~lib/util/utils"

/**
 * Sentinel pydeck writes when `map_provider=None`. It is not a style URL.
 */
export const PYDECK_UNSET_MAP_STYLE = "__MAP_STYLE__"

/**
 * True when pydeck omitted a basemap style or used the unset sentinel.
 *
 * @param {unknown} mapStyle - The `mapStyle` value from the pydeck JSON or converted deck.
 * @returns {boolean} Whether the style should be treated as missing.
 */
export function isUnsetMapStyle(mapStyle: unknown): boolean {
  if (isNullOrUndefined(mapStyle) || mapStyle === PYDECK_UNSET_MAP_STYLE) {
    return true
  }

  if (typeof mapStyle === "string") {
    return mapStyle.length === 0
  }

  if (Array.isArray(mapStyle)) {
    return mapStyle.every(style => isUnsetMapStyle(style))
  }

  return false
}

const isMapViewObject = (view: unknown): boolean => {
  if (isNullOrUndefined(view) || typeof view !== "object") {
    return false
  }

  if ("@@type" in view) {
    return view["@@type"] === "MapView"
  }

  return view instanceof MapView
}

/**
 * True when the spec uses deck.gl's default camera or an explicit MapView.
 *
 * Omitted / empty `views` is treated as MapView (pydeck's default). Any
 * OrbitView, OrthographicView, FirstPersonView, or GlobeView is not
 * Web Mercator and must not mount react-map-gl.
 *
 * @param {unknown} views - Serialized `@@type` objects or converted View instances.
 * @returns {boolean} Whether a Carto/Mapbox basemap is compatible.
 */
export function isMapCompatibleViewSpec(views: unknown): boolean {
  if (isNullOrUndefined(views)) {
    return true
  }

  const viewList = Array.isArray(views) ? views : [views]
  return viewList.every(isMapViewObject)
}

/**
 * Real deck.gl View instances from the converted spec.
 *
 * Unknown `@@type` values hydrate to `null`. Those must not be forwarded to
 * DeckGL, which would skip the default MapView fallback.
 *
 * @param {unknown} views - Converted `views` from the JSON converter.
 * @returns {View | View[] | undefined} Usable views, or undefined when none exist.
 */
export function getProvidedViews(views: unknown): View | View[] | undefined {
  const viewList = (Array.isArray(views) ? views : [views]).filter(
    (view): view is View => view instanceof View
  )

  if (viewList.length === 0) {
    return undefined
  }

  if (!Array.isArray(views) && viewList.length === 1) {
    return viewList[0]
  }

  return viewList
}

/**
 * True when pydeck provided at least one view that DeckGL should receive.
 *
 * @param {unknown} views - Converted `views` from the JSON converter.
 * @returns {boolean} Whether `<DeckGL>` should take a `views` prop.
 */
export function hasProvidedViews(views: unknown): boolean {
  return getProvidedViews(views) !== undefined
}

/**
 * True when Streamlit should mount StaticMap and the zoom control.
 *
 * @param {object} params - View and style values after JSON conversion.
 * @param {unknown} params.views - Converted views (instances or omitted).
 * @param {unknown} params.mapStyle - Converted map style (URL, array, or unset).
 * @returns {boolean} Whether to render the MapView basemap chrome.
 */
export function shouldShowBasemap({
  views,
  mapStyle,
}: {
  views: unknown
  mapStyle: unknown
}): boolean {
  return isMapCompatibleViewSpec(views) && !isUnsetMapStyle(mapStyle)
}

const UNSAFE_PARAMETER_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
])

/**
 * GPU parameters from pydeck JSON, with converter artifacts removed.
 *
 * `JSONConverter` can turn `@@=` strings into functions (deck.gl allows
 * `parameters` to be a per-frame callback). Only JSON values are forwarded.
 *
 * @param {unknown} value - Converted `parameters` from the pydeck spec.
 * @returns {Record<string, unknown> | undefined} JSON-safe GPU state, or undefined.
 */
export function sanitizeDeckParameters(
  value: unknown
): Record<string, unknown> | undefined {
  if (isNullOrUndefined(value) || typeof value !== "object") {
    return undefined
  }

  if (
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return undefined
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(JSON.stringify(value))
  } catch {
    return undefined
  }

  if (
    isNullOrUndefined(parsed) ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    return undefined
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(
    parsed as Record<string, unknown>
  )) {
    if (UNSAFE_PARAMETER_KEYS.has(key)) {
      continue
    }
    sanitized[key] = nested
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}
