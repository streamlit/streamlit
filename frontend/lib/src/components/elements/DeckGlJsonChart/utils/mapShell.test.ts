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
  hasProvidedViews,
  isMapCompatibleViewSpec,
  isUnsetMapStyle,
  PYDECK_UNSET_MAP_STYLE,
  shouldShowBasemap,
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

describe("hasProvidedViews", () => {
  it("is false when views are omitted or empty", () => {
    expect(hasProvidedViews(undefined)).toBe(false)
    expect(hasProvidedViews([])).toBe(false)
  })

  it("is true when a view instance or non-empty array is present", () => {
    expect(hasProvidedViews(new MapView({ controller: true }))).toBe(true)
    expect(hasProvidedViews([new OrbitView({ controller: true })])).toBe(true)
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
})
