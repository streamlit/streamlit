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

import { MapView, OrbitView } from "@deck.gl/core"

import {
  getProvidedViews,
  isMapCompatibleViewSpec,
  isUnsetMapStyle,
  PYDECK_UNSET_MAP_STYLE,
  sanitizeDeckParameters,
  shouldShowBasemap,
  withDefaultMapViewIds,
} from "./mapShell"

describe("isUnsetMapStyle", () => {
  it.each([undefined, null, "", PYDECK_UNSET_MAP_STYLE])(
    "treats %p as unset",
    mapStyle => {
      expect(isUnsetMapStyle(mapStyle)).toBe(true)
    }
  )

  it("does not treat a Carto or Mapbox URL as unset", () => {
    expect(
      isUnsetMapStyle(
        "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      )
    ).toBe(false)
    expect(isUnsetMapStyle("mapbox://styles/mapbox/light-v9")).toBe(false)
  })
})

describe("isMapCompatibleViewSpec", () => {
  it.each([undefined, null, [], { "@@type": "MapView", controller: true }])(
    "treats %p as a MapView spec",
    views => {
      expect(isMapCompatibleViewSpec(views)).toBe(true)
    }
  )

  it("treats a converted MapView instance as map-compatible", () => {
    expect(isMapCompatibleViewSpec(new MapView({ controller: true }))).toBe(
      true
    )
  })

  it.each([
    "OrbitView",
    "OrthographicView",
    "FirstPersonView",
    "_GlobeView",
    "GlobeView",
  ])("rejects serialized %s", type => {
    expect(
      isMapCompatibleViewSpec([{ "@@type": type, controller: true }])
    ).toBe(false)
  })

  it("rejects a converted OrbitView instance", () => {
    expect(isMapCompatibleViewSpec(new OrbitView({ controller: true }))).toBe(
      false
    )
  })
})

describe("getProvidedViews", () => {
  it("is undefined when views are omitted or empty", () => {
    expect(getProvidedViews(undefined)).toBeUndefined()
    expect(getProvidedViews([])).toBeUndefined()
  })

  it("returns a view instance or non-empty array when present", () => {
    expect(getProvidedViews(new MapView({ controller: true }))).toBeInstanceOf(
      MapView
    )
    expect(
      getProvidedViews([new OrbitView({ controller: true })])
    ).toHaveLength(1)
  })

  it("ignores converter failures so DeckGL can fall back to MapView", () => {
    expect(getProvidedViews([null])).toBeUndefined()
    expect(
      shouldShowBasemap({
        views: getProvidedViews([null]),
        mapStyle: "mapbox://styles/mapbox/light-v9",
      })
    ).toBe(true)
  })
})

describe("withDefaultMapViewIds", () => {
  it("assigns default-view when a MapView omits id", () => {
    expect(
      withDefaultMapViewIds([{ "@@type": "MapView", controller: true }])
    ).toEqual([{ "@@type": "MapView", controller: true, id: "default-view" }])
  })

  it("leaves an explicit MapView id and non-MapView specs unchanged", () => {
    expect(
      withDefaultMapViewIds([{ "@@type": "MapView", id: "split-left" }])
    ).toEqual([{ "@@type": "MapView", id: "split-left" }])
    expect(
      withDefaultMapViewIds([{ "@@type": "OrbitView", controller: true }])
    ).toEqual([{ "@@type": "OrbitView", controller: true }])
  })
})

describe("shouldShowBasemap", () => {
  it("shows a basemap for MapView with a real style", () => {
    expect(
      shouldShowBasemap({
        views: [{ "@@type": "MapView", controller: true }],
        mapStyle: "mapbox://styles/mapbox/light-v9",
      })
    ).toBe(true)
  })

  it("hides the basemap when mapStyle is the pydeck unset sentinel", () => {
    expect(
      shouldShowBasemap({
        views: [{ "@@type": "MapView", controller: true }],
        mapStyle: PYDECK_UNSET_MAP_STYLE,
      })
    ).toBe(false)
  })

  it("hides the basemap for OrbitView even with a style URL", () => {
    expect(
      shouldShowBasemap({
        views: [{ "@@type": "OrbitView", controller: true }],
        mapStyle:
          "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      })
    ).toBe(false)
  })

  it("shows a basemap when views are omitted and a style is present", () => {
    expect(
      shouldShowBasemap({
        views: undefined,
        mapStyle: "mapbox://styles/mapbox/light-v9",
      })
    ).toBe(true)
  })
})

describe("sanitizeDeckParameters", () => {
  it("keeps JSON GPU state such as GlobeView cull", () => {
    expect(sanitizeDeckParameters({ cull: true })).toEqual({ cull: true })
  })

  it("drops functions produced by JSONConverter @@= expressions", () => {
    expect(
      sanitizeDeckParameters({
        cull: true,
        blend: () => true,
      })
    ).toEqual({ cull: true })
  })

  it("rejects a top-level function, class instance, or array", () => {
    expect(sanitizeDeckParameters(() => ({ cull: true }))).toBeUndefined()
    expect(
      sanitizeDeckParameters(new MapView({ controller: true }))
    ).toBeUndefined()
    expect(sanitizeDeckParameters([{ cull: true }])).toBeUndefined()
  })

  it("returns undefined when nothing JSON-safe remains", () => {
    expect(sanitizeDeckParameters({ blend: () => true })).toBeUndefined()
    expect(sanitizeDeckParameters(undefined)).toBeUndefined()
    expect(sanitizeDeckParameters(null)).toBeUndefined()
  })
})
