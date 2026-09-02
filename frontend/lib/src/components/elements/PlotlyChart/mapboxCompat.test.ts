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

import type { Figure as PlotlyFigureType } from "~lib/util/reactPlotlyCompat"

import {
  migratePlotlyMapboxConfig,
  migratePlotlyMapboxFigure,
} from "./mapboxCompat"

describe("migratePlotlyMapboxFigure", () => {
  it("renames mapbox traces, subplots, and layout keys", () => {
    const figure = migratePlotlyMapboxFigure({
      data: [
        {
          type: "scattermapbox",
          lon: [0],
          lat: [0],
          subplot: "mapbox",
        },
        {
          type: "choroplethmapbox",
          subplot: "mapbox2",
        },
        {
          type: "densitymapbox",
        },
      ],
      layout: {
        mapbox: {
          style: "open-street-map",
          accesstoken: "secret",
          center: { lat: 0, lon: 0 },
        },
        mapbox2: { style: "carto-positron" },
        title: "Cities",
      },
      frames: null,
    })

    expect(figure.data).toEqual([
      { type: "scattermap", lon: [0], lat: [0], subplot: "map" },
      { type: "choroplethmap", subplot: "map2" },
      { type: "densitymap" },
    ])
    expect(figure.layout).toEqual({
      map: { style: "open-street-map", center: { lat: 0, lon: 0 } },
      map2: { style: "carto-positron" },
      title: "Cities",
    })
  })

  it("is idempotent for already-migrated figures", () => {
    const migrated: PlotlyFigureType = {
      data: [{ type: "scattermap", lon: [1], lat: [2] }],
      layout: { map: { style: "light" } },
      frames: null,
    }

    expect(migratePlotlyMapboxFigure(migrated)).toEqual(migrated)
  })

  it("leaves non-map traces and layouts unchanged", () => {
    const figure: PlotlyFigureType = {
      data: [{ type: "scatter", x: [1], y: [2] }],
      layout: { title: "Bars", xaxis: { title: "x" } },
      frames: null,
    }

    expect(migratePlotlyMapboxFigure(figure)).toEqual(figure)
  })

  it("rewrites official Mapbox style URLs to built-in MapLibre names", () => {
    const figure = migratePlotlyMapboxFigure({
      data: [{ type: "scattermapbox" }],
      layout: {
        mapbox: { style: "mapbox://styles/mapbox/satellite-streets-v11" },
      },
      frames: null,
    })

    expect(figure.layout).toEqual({
      map: { style: "satellite-streets" },
    })
  })

  it("prefers an existing layout.map over a migrated mapbox layout", () => {
    const figure = migratePlotlyMapboxFigure({
      data: [],
      layout: {
        map: { style: "dark" },
        mapbox: { style: "light", accesstoken: "secret" },
      },
      frames: null,
    })

    expect(figure.layout).toEqual({
      map: { style: "dark" },
    })
  })

  it("migrates mapbox traces inside frames and templates", () => {
    const figure = migratePlotlyMapboxFigure({
      data: [{ type: "scattermapbox" }],
      layout: {
        template: {
          layout: {
            mapbox: { style: "mapbox://styles/mapbox/dark-v10" },
          },
          data: {
            scattermapbox: [{ marker: { size: 8 } }],
          },
        },
      },
      frames: [
        {
          name: "frame-0",
          data: [{ type: "scattermapbox", lon: [10], lat: [20] }],
          layout: { mapbox: { zoom: 3 } },
        },
      ],
    })

    expect(figure.layout).toEqual({
      template: {
        layout: { map: { style: "dark" } },
        data: { scattermap: [{ marker: { size: 8 } }] },
      },
    })
    expect(figure.frames).toEqual([
      {
        name: "frame-0",
        data: [{ type: "scattermap", lon: [10], lat: [20] }],
        layout: { map: { zoom: 3 } },
      },
    ])
  })
})

describe("migratePlotlyMapboxConfig", () => {
  it("drops mapboxAccessToken and rewrites mapbox config values", () => {
    expect(
      migratePlotlyMapboxConfig({
        mapboxAccessToken: "secret",
        scrollZoom: "mapbox+cartesian",
        displaylogo: false,
        modeBarButtonsToRemove: ["zoomInMapbox", "lasso2d"],
        modeBarButtonsToAdd: [{ name: "resetViewMapbox" }],
      })
    ).toEqual({
      scrollZoom: "map+cartesian",
      displaylogo: false,
      modeBarButtonsToRemove: ["zoomInMap", "lasso2d"],
      modeBarButtonsToAdd: [{ name: "resetViewMap" }],
    })
  })

  it("does not rewrite unrelated config", () => {
    const config = { displayModeBar: true, scrollZoom: true }
    expect(migratePlotlyMapboxConfig(config)).toEqual(config)
  })
})
