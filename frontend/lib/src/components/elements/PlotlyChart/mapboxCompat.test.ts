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
import { vi } from "vitest"

import type { Figure as PlotlyFigureType } from "~lib/util/reactPlotlyCompat"

import {
  migratePlotlyMapboxConfig,
  migratePlotlyMapboxFigure,
} from "./mapboxCompat"

const LOG = getLogger("PlotlyChart:mapboxCompat")

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
    const figure = {
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

  it.each([
    ["stamen-terrain", "carto-voyager"],
    ["stamen-toner", "carto-positron"],
    ["stamen-watercolor", "carto-voyager"],
  ])("rewrites v3 %s style to %s", (fromStyle, toStyle) => {
    const figure = migratePlotlyMapboxFigure({
      data: [{ type: "scattermapbox" }],
      layout: { mapbox: { style: fromStyle } },
      frames: null,
    })

    expect(figure.layout).toEqual({
      map: { style: toStyle },
    })
  })

  it("falls back to basic when a custom Mapbox style URL cannot be migrated", () => {
    const warnSpy = vi.spyOn(LOG, "warn").mockImplementation(() => {})

    const figure = migratePlotlyMapboxFigure({
      data: [{ type: "scattermapbox" }],
      layout: {
        mapbox: { style: "mapbox://styles/myuser/custom-style" },
      },
      frames: null,
    })

    expect(figure.layout).toEqual({
      map: { style: "basic" },
    })
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("mapbox://styles/myuser/custom-style")
    )
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("basic"))

    warnSpy.mockRestore()
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

  it("rewrites styles on already-named layout.map subplots", () => {
    const figure = migratePlotlyMapboxFigure({
      data: [{ type: "scattermap" }],
      layout: {
        map: { style: "mapbox://styles/mapbox/light-v10" },
        map2: { style: "stamen-toner" },
      },
      frames: null,
    })

    expect(figure.layout).toEqual({
      map: { style: "light" },
      map2: { style: "carto-positron" },
    })
  })

  it("rewrites a mapbox URL on layout.map even when mapbox is also present", () => {
    const figure = migratePlotlyMapboxFigure({
      data: [],
      layout: {
        map: { style: "mapbox://styles/mapbox/light-v10" },
        mapbox: { style: "dark", accesstoken: "secret" },
      },
      frames: null,
    })

    expect(figure.layout).toEqual({
      map: { style: "light" },
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

  it("does not let a migrated template mapbox key overwrite scattermap", () => {
    const figure = migratePlotlyMapboxFigure({
      data: [],
      layout: {
        template: {
          data: {
            scattermap: [{ marker: { size: 4 } }],
            scattermapbox: [{ marker: { size: 12 } }],
          },
        },
      },
      frames: null,
    })

    expect(figure.layout).toEqual({
      template: {
        data: { scattermap: [{ marker: { size: 4 } }] },
      },
    })
  })

  it("rewrites layout.modebar mapbox button names", () => {
    const figure = migratePlotlyMapboxFigure({
      data: [{ type: "scattermapbox" }],
      layout: {
        modebar: {
          add: ["zoomInMapbox"],
          remove: ["resetViewMapbox", "toImage"],
        },
      },
    })

    expect(figure.layout).toEqual({
      modebar: {
        add: ["zoomInMap"],
        remove: ["resetViewMap", "toImage"],
      },
    })
  })

  it("rewrites mapbox restyle paths in updatemenus", () => {
    const figure = migratePlotlyMapboxFigure({
      data: [{ type: "scattermapbox" }],
      layout: {
        updatemenus: [
          {
            buttons: [
              {
                args: ["mapbox.zoom", 4],
                args2: ["mapbox2.center", { lat: 0, lon: 0 }],
              },
            ],
          },
        ],
      },
    })

    expect(figure.layout).toEqual({
      updatemenus: [
        {
          buttons: [
            {
              args: ["map.zoom", 4],
              args2: ["map2.center", { lat: 0, lon: 0 }],
            },
          ],
        },
      ],
    })
  })

  it("rewrites mapbox restyle object keys in updatemenus and sliders", () => {
    const figure = migratePlotlyMapboxFigure({
      data: [{ type: "scattermapbox" }],
      layout: {
        updatemenus: [
          {
            buttons: [
              {
                args: [{ "mapbox.zoom": 4, mapbox: { pitch: 30 } }],
              },
            ],
          },
        ],
        sliders: [
          {
            steps: [
              {
                args: [{ "mapbox2.center": { lat: 0, lon: 0 } }],
              },
            ],
          },
        ],
      },
    })

    expect(figure.layout).toEqual({
      updatemenus: [
        {
          buttons: [
            {
              args: [{ "map.zoom": 4, map: { pitch: 30 } }],
            },
          ],
        },
      ],
      sliders: [
        {
          steps: [
            {
              args: [{ "map2.center": { lat: 0, lon: 0 } }],
            },
          ],
        },
      ],
    })
  })

  it("does not rewrite Mapbox hostnames or URLs in nested layout strings", () => {
    const figure = migratePlotlyMapboxFigure({
      data: [{ type: "scatter" }],
      layout: {
        title: "Tiles from api.mapbox.com",
        annotations: [
          {
            text: "https://api.mapbox.com/v4/mapbox.satellite",
            align: "center",
          },
        ],
        images: [
          { source: "https://api.mapbox.com/styles/v1/mapbox/light-v10" },
        ],
      },
    })

    expect(figure.layout).toEqual({
      title: "Tiles from api.mapbox.com",
      annotations: [
        {
          text: "https://api.mapbox.com/v4/mapbox.satellite",
          align: "center",
        },
      ],
      images: [
        { source: "https://api.mapbox.com/styles/v1/mapbox/light-v10" },
      ],
    })
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

  it("rewrites nested custom modeBarButtons names", () => {
    expect(
      migratePlotlyMapboxConfig({
        modeBarButtons: [
          ["zoomInMapbox", "zoomOutMapbox"],
          [{ name: "resetViewMapbox" }, "toImage"],
        ],
      })
    ).toEqual({
      modeBarButtons: [
        ["zoomInMap", "zoomOutMap"],
        [{ name: "resetViewMap" }, "toImage"],
      ],
    })
  })

  it("does not rewrite unrelated config", () => {
    const config = { displayModeBar: true, scrollZoom: true }
    expect(migratePlotlyMapboxConfig(config)).toEqual(config)
  })

  it("maps showEditInChartStudio to showSendToCloud when unset", () => {
    expect(migratePlotlyMapboxConfig({ showEditInChartStudio: true })).toEqual(
      { showSendToCloud: true }
    )
  })

  it("keeps an explicit showSendToCloud over showEditInChartStudio", () => {
    expect(
      migratePlotlyMapboxConfig({
        showSendToCloud: false,
        showEditInChartStudio: true,
      })
    ).toEqual({ showSendToCloud: false })
  })

  it("drops showEditInChartStudio when it is not an opt-in", () => {
    expect(
      migratePlotlyMapboxConfig({ showEditInChartStudio: false })
    ).toEqual({})
  })
})
