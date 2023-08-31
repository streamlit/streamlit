/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React from "react"
import JSON5 from "json5"
import { render } from "@streamlit/lib/src/test_util"

import { DeckGlJsonChart as DeckGlJsonChartProto } from "@streamlit/lib/src/proto"
import { screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"
import { DeckGlJsonChart, PropsWithHeight, State } from "./DeckGlJsonChart"

const mockInitialViewState = {
  bearing: -27.36,
  latitude: 52.2323,
  longitude: -1.415,
  maxZoom: 15,
  minZoom: 5,
  pitch: 40.5,
  height: 500,
  zoom: 6,
}

const mockId = "testId"
jest.mock("@streamlit/lib/src/theme", () => ({
  hasLightBackgroundColor: jest.fn(() => false),
}))

const getProps = (
  elementProps: Partial<DeckGlJsonChartProto> = {},
  initialViewStateProps: Record<string, unknown> = {}
): PropsWithHeight => {
  const json = {
    initialViewState: mockInitialViewState,
    layers: [
      {
        "@@type": "HexagonLayer",
        autoHighlight: true,
        coverage: 1,
        data: "https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/3d-heatmap/heatmap-data.csv",
        elevationRange: [0, 3000],
        elevationScale: 50,
        extruded: true,
        getPosition: "@@=[lng, lat]",
        id: "0533490f-fcf9-4dc0-8c94-ae4fbd42eb6f",
        pickable: true,
      },
    ],
    mapStyle: "mapbox://styles/mapbox/light-v9",
    views: [{ "@@type": "MapView", controller: true }],
  }

  json.initialViewState = {
    ...json.initialViewState,
    ...initialViewStateProps,
  }

  return {
    element: DeckGlJsonChartProto.create({
      id: mockId,
      json: JSON.stringify(json),
      ...elementProps,
    }),
    width: 0,
    mapboxToken: "mapboxToken",
    height: undefined,
    theme: mockTheme.emotion,
    isFullScreen: false,
  }
}

describe("DeckGlJsonChart element", () => {
  it("renders without crashing", () => {
    const props = getProps()

    render(<DeckGlJsonChart {...props} />)

    const deckGlJsonChart = screen.getByTestId("stDeckGlJsonChart")
    expect(deckGlJsonChart).toBeInTheDocument()
  })

  it("should merge client and server changes in viewState", () => {
    const props = getProps()
    const initialViewStateServer = mockInitialViewState

    const initialViewStateClient = { ...mockInitialViewState, zoom: 8 }

    const state = {
      viewState: initialViewStateClient,
      initialViewState: initialViewStateClient,
    }

    const result = DeckGlJsonChart.getDerivedStateFromProps(props, state)

    expect(result).toEqual({
      // should match original mockInitialViewState
      viewState: { ...initialViewStateClient, zoom: 6 },
      initialViewState: initialViewStateServer,
    })
  })

  describe("createTooltip", () => {
    let deckGlInstance: any

    beforeEach(() => {
      deckGlInstance = new DeckGlJsonChart({ ...getProps() })
    })

    it("should return false if info is undefined", () => {
      const result = deckGlInstance.createTooltip(undefined)
      expect(result).toBe(false)
    })

    it("should return false if info.object is undefined", () => {
      const result = deckGlInstance.createTooltip({})
      expect(result).toBe(false)
    })

    it("should return false if element.tooltip is undefined", () => {
      const result = deckGlInstance.createTooltip({ object: {} })
      expect(result).toBe(false)
    })

    it("should interpolate the html with the correct object", () => {
      deckGlInstance.props.element.tooltip = JSON.stringify({
        html: "<b>Elevation Value:</b> {elevationValue}",
      })
      const result = deckGlInstance.createTooltip({
        object: { elevationValue: 10 },
      })

      expect(result.html).toBe("<b>Elevation Value:</b> 10")
    })

    it("should interpolate the html with the an empty string", () => {
      deckGlInstance.props = getProps({
        tooltip: "",
      })
      const result = deckGlInstance.createTooltip({
        object: { elevationValue: 10 },
      })

      expect(result.html).toBe(undefined)
    })
  })

  describe("getDeckObject", () => {
    const newId = "newTestId"
    const newJson = {
      initialViewState: mockInitialViewState,
      mapStyle: "mapbox://styles/mapbox/light-v9",
    }

    const originalState: State = {
      pydeckJson: newJson,
      isFullScreen: false,
      viewState: {},
      initialized: false,
      initialViewState: mockInitialViewState,
      id: mockId,
      isLightTheme: false,
    }

    const mockJsonParse = jest.fn().mockReturnValue(newJson)

    beforeEach(() => {
      JSON5.parse = mockJsonParse
    })

    afterEach(() => {
      mockJsonParse.mockClear()
    })

    const testJsonParsing = (
      description: string,
      stateOverride: Partial<State>
    ): void => {
      // the description will be passed in
      // eslint-disable-next-line jest/valid-title
      it(description, () => {
        DeckGlJsonChart.getDeckObject(getProps(), originalState)

        expect(JSON5.parse).not.toHaveBeenCalled()

        DeckGlJsonChart.getDeckObject(getProps(), {
          ...originalState,
          ...stateOverride,
        })

        expect(JSON5.parse).toHaveBeenCalledTimes(1)
      })
    }

    testJsonParsing(
      "should call JSON5.parse when the element id is different",
      { id: newId }
    )
    testJsonParsing("should call JSON5.parse when FullScreen state changes", {
      id: mockId,
      isFullScreen: true,
    })
    testJsonParsing("should call JSON5.parse when theme state changes", {
      id: mockId,
      isLightTheme: true,
    })
  })
})
