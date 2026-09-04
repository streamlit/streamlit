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
  _TerrainExtension,
  DataFilterExtension,
  PathStyleExtension,
} from "@deck.gl/extensions"
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers"

import { jsonConverter } from "./jsonConverter"

type ConvertedLayer = {
  props: {
    extensions?: unknown[]
  }
}

const convertLayer = (layerJson: Record<string, unknown>): ConvertedLayer => {
  const converted = jsonConverter.convert({
    layers: [layerJson],
  }) as { layers: Array<ConvertedLayer | null> }

  const layer = converted.layers[0]
  expect(layer).toBeTruthy()
  return layer as ConvertedLayer
}

describe("jsonConverter layer extensions", () => {
  it("hydrates DataFilterExtension instead of dropping the layer", () => {
    const layer = convertLayer({
      "@@type": "ScatterplotLayer",
      id: "filtered-points",
      data: [{ position: [0, 0], value: 1 }],
      getPosition: "@@=position",
      getFilterValue: "@@=value",
      filterRange: [0, 10],
      extensions: [{ "@@type": "DataFilterExtension", filterSize: 1 }],
    })

    expect(layer).toBeInstanceOf(ScatterplotLayer)
    expect(layer.props.extensions).toEqual([expect.any(DataFilterExtension)])
  })

  it("hydrates PathStyleExtension instead of dropping the layer", () => {
    const layer = convertLayer({
      "@@type": "PathLayer",
      id: "dashed-path",
      data: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
        },
      ],
      getPath: "@@=path",
      getDashArray: [8, 4],
      extensions: [{ "@@type": "PathStyleExtension", dash: true }],
    })

    expect(layer).toBeInstanceOf(PathLayer)
    expect(layer.props.extensions).toEqual([expect.any(PathStyleExtension)])
  })

  it("returns null for an unknown layer @@type", () => {
    const converted = jsonConverter.convert({
      layers: [{ "@@type": "NotARealLayer" }],
    }) as { layers: Array<ConvertedLayer | null> }

    expect(converted.layers[0]).toBeNull()
  })

  it("resolves TerrainExtension from the pydeck JSON type name", () => {
    const layer = convertLayer({
      "@@type": "ScatterplotLayer",
      id: "terrain-points",
      data: [{ position: [0, 0] }],
      getPosition: "@@=position",
      extensions: [{ "@@type": "TerrainExtension" }],
    })

    expect(layer.props.extensions).toEqual([expect.any(_TerrainExtension)])
  })
})
