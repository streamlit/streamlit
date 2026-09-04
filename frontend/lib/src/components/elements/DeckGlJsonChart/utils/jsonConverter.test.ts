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

import {
  _GlobeView,
  FirstPersonView,
  MapView,
  OrbitView,
  OrthographicView,
} from "@deck.gl/core"

import { jsonConverter } from "./jsonConverter"

type ConvertedViews = {
  views: unknown[]
}

const convertView = (type: string): unknown => {
  const converted = jsonConverter.convert({
    views: [{ "@@type": type, controller: true }],
  }) as ConvertedViews

  return converted.views[0]
}

describe("jsonConverter view classes", () => {
  it.each([
    { type: "MapView", ViewClass: MapView },
    { type: "OrbitView", ViewClass: OrbitView },
    { type: "OrthographicView", ViewClass: OrthographicView },
    { type: "FirstPersonView", ViewClass: FirstPersonView },
    { type: "_GlobeView", ViewClass: _GlobeView },
    { type: "GlobeView", ViewClass: _GlobeView },
  ])("hydrates @@type $type to $ViewClass.name", ({ type, ViewClass }) => {
    const view = convertView(type)

    expect(view).toBeInstanceOf(ViewClass)
    expect(view).not.toBeNull()
  })

  it("hydrates an unknown view type to null", () => {
    expect(convertView("NotARealView")).toBeNull()
  })

  it("passes parameters through without conversion", () => {
    const converted = jsonConverter.convert({
      parameters: { cull: true },
    }) as { parameters: { cull: boolean } }

    expect(converted.parameters).toEqual({ cull: true })
  })
})
