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

import { MapView } from "@deck.gl/core"

import {
  getProvidedViews,
  isMapCompatibleViewSpec,
  isUnsetMapStyle,
  PYDECK_UNSET_MAP_STYLE,
  sanitizeDeckParameters,
  shouldShowBasemap,
  withDefaultMapViewIds,
} from "./mapShell"

const MAPBOX_LIGHT = "mapbox://styles/mapbox/light-v9"
const CARTO_POSITRON =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"

describe("isUnsetMapStyle", () => {
  it.each([undefined, null, "", PYDECK_UNSET_MAP_STYLE])(
    "treats %p as unset",
    mapStyle => {
      expect(isUnsetMapStyle(mapStyle)).toBe(true)
    }
  )

  it("does not treat a Carto or Mapbox URL as unset", () => {
    expect(isUnsetMapStyle(CARTO_POSITRON)).toBe(false)
    expect(isUnsetMapStyle(MAPBOX_LIGHT)).toBe(false)
  })
})

describe("isMapCompatibleViewSpec", () => {
  it.each([undefined, null, [], { "@@type": "MapView" }])(
    "treats %p as a MapView spec",
    views => {
      expect(isMapCompatibleViewSpec(views)).toBe(true)
    }
  )

  it.each(["OrbitView", "OrthographicView", "FirstPersonView", "GlobeView"])(
    "rejects serialized %s",
    type => {
      expect(isMapCompatibleViewSpec([{ "@@type": type }])).toBe(false)
    }
  )
})

describe("getProvidedViews", () => {
  it("returns instances and drops converter failures", () => {
    expect(getProvidedViews(undefined)).toBeUndefined()
    expect(getProvidedViews([])).toBeUndefined()
    expect(getProvidedViews([null])).toBeUndefined()
    expect(getProvidedViews(new MapView({ controller: true }))).toBeInstanceOf(
      MapView
    )
    expect(
      shouldShowBasemap({
        views: getProvidedViews([null]),
        mapStyle: MAPBOX_LIGHT,
      })
    ).toBe(true)
  })
})

describe("withDefaultMapViewIds", () => {
  it("assigns default-view only when a MapView omits id", () => {
    expect(
      withDefaultMapViewIds([{ "@@type": "MapView", controller: true }])
    ).toEqual([{ "@@type": "MapView", controller: true, id: "default-view" }])
    expect(
      withDefaultMapViewIds([{ "@@type": "MapView", id: "split-left" }])
    ).toEqual([{ "@@type": "MapView", id: "split-left" }])
    expect(
      withDefaultMapViewIds([{ "@@type": "OrbitView", controller: true }])
    ).toEqual([{ "@@type": "OrbitView", controller: true }])
  })
})

describe("shouldShowBasemap", () => {
  it.each([
    {
      views: [{ "@@type": "MapView" }],
      mapStyle: MAPBOX_LIGHT,
      show: true,
    },
    {
      views: undefined,
      mapStyle: MAPBOX_LIGHT,
      show: true,
    },
    {
      views: [{ "@@type": "MapView" }],
      mapStyle: PYDECK_UNSET_MAP_STYLE,
      show: false,
    },
    {
      views: [{ "@@type": "OrbitView" }],
      mapStyle: CARTO_POSITRON,
      show: false,
    },
  ])("is $show for $views / $mapStyle", ({ views, mapStyle, show }) => {
    expect(shouldShowBasemap({ views, mapStyle })).toBe(show)
  })
})

describe("sanitizeDeckParameters", () => {
  it("keeps JSON GPU state and drops functions or class instances", () => {
    expect(sanitizeDeckParameters({ cull: true })).toEqual({ cull: true })
    expect(sanitizeDeckParameters({ cull: true, blend: () => true })).toEqual({
      cull: true,
    })
    expect(sanitizeDeckParameters(() => ({ cull: true }))).toBeUndefined()
    expect(
      sanitizeDeckParameters(new MapView({ controller: true }))
    ).toBeUndefined()
    expect(sanitizeDeckParameters({ blend: () => true })).toBeUndefined()
  })
})
