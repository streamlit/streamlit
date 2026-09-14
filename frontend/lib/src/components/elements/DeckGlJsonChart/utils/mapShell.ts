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

/** Sentinel pydeck writes when `map_provider=None`. Not a style URL. */
export const PYDECK_UNSET_MAP_STYLE = "__MAP_STYLE__"

const DEFAULT_MAP_VIEW_ID = "default-view"

const UNSAFE_PARAMETER_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
])

/** True when pydeck omitted a basemap style or used the unset sentinel. */
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
 * Pin MapViews without an id to `default-view` so DeckGL keeps
 * `#view-default-view` (selection e2e). pydeck omits id; deck.gl would use
 * `#view-MapView`.
 */
export function withDefaultMapViewIds(views: unknown): unknown {
  if (isNullOrUndefined(views)) {
    return views
  }

  const viewList = Array.isArray(views) ? views : [views]
  // Multiple id-less MapViews would collide on #view-default-view.
  if (viewList.filter(isMapViewObject).length !== 1) {
    return views
  }

  const assignId = (view: unknown): unknown => {
    if (
      isNullOrUndefined(view) ||
      typeof view !== "object" ||
      Array.isArray(view)
    ) {
      return view
    }

    const spec = view as Record<string, unknown>
    if (spec["@@type"] !== "MapView") {
      return view
    }

    if (typeof spec.id === "string" && spec.id.length > 0) {
      return view
    }

    return { ...spec, id: DEFAULT_MAP_VIEW_ID }
  }

  return Array.isArray(views) ? views.map(assignId) : assignId(views)
}

/** True for omitted/empty/`MapView` specs. Non-Mercator cameras return false. */
export function isMapCompatibleViewSpec(views: unknown): boolean {
  if (isNullOrUndefined(views)) {
    return true
  }

  const viewList = Array.isArray(views) ? views : [views]
  return viewList.every(isMapViewObject)
}

/**
 * Converted View instances to pass to DeckGL. Unknown `@@type` hydrates to
 * `null` and is dropped so DeckGL can fall back to MapView.
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

/** True when Streamlit should mount StaticMap and the zoom control. */
export function shouldShowBasemap({
  views,
  mapStyle,
}: {
  views: unknown
  mapStyle: unknown
}): boolean {
  return isMapCompatibleViewSpec(views) && !isUnsetMapStyle(mapStyle)
}

/**
 * Drop converter artifacts (`@@=` functions, class instances) so DeckGL only
 * receives JSON GPU state. deck.gl allows `parameters` to be a per-frame
 * callback.
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
    if (!UNSAFE_PARAMETER_KEYS.has(key)) {
      sanitized[key] = nested
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}
