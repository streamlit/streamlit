import React from "react"
import DeckGL from "deck.gl"
import { shallow } from "src/lib/test_util"
import { lightTheme } from "src/theme"

import { DeckGlJsonChart as DeckGlJsonChartProto } from "src/autogen/proto"
import { NavigationControl } from "react-map-gl"
import { DeckGlJsonChart, PropsWithHeight } from "./DeckGlJsonChart"

const getProps = (
  elementProps: Partial<DeckGlJsonChartProto> = {},
  initialViewStateProps: Record<string, unknown> = {}
): PropsWithHeight => {
  const json = {
    initialViewState: {
      bearing: -27.36,
      latitude: 52.2323,
      longitude: -1.415,
      maxZoom: 15,
      minZoom: 5,
      pitch: 40.5,
      zoom: 6,
    },
    layers: [
      {
        "@@type": "HexagonLayer",
        autoHighlight: true,
        coverage: 1,
        data:
          "https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/3d-heatmap/heatmap-data.csv",
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
      json: JSON.stringify(json),
      ...elementProps,
    }),
    width: 0,
    mapboxToken: "mapboxToken",
    height: undefined,
    theme: lightTheme.emotion,
  }
}

describe("DeckGlJsonChart element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<DeckGlJsonChart {...props} />)

    expect(wrapper.find(DeckGL).length).toBe(1)
    expect(wrapper.find(NavigationControl).length).toBe(1)
  })

  it("merges client and server changes", () => {
    const props = getProps()
    const wrapper = shallow(<DeckGlJsonChart {...props} />)
    const DeckGL = wrapper.find("DeckGL")

    expect(DeckGL.length).toBe(1)
    expect(DeckGL.prop("onViewStateChange")).toBeDefined()

    // @ts-ignore
    DeckGL.prop("onViewStateChange")({
      viewState: { pitch: 5, zoom: 5 },
    })

    wrapper.setProps(getProps({}, { pitch: 40.5, zoom: 10 }))

    // @ts-ignore
    expect(wrapper.state("viewState")).toStrictEqual({
      pitch: 5,
      zoom: 10,
    })
  })

  it("should render tooltip", () => {
    const props = getProps({
      tooltip: `{"html": "<b>Elevation Value:</b> {elevationValue}", "style": {"color": "white"}}`,
    })
    const wrapper = shallow(<DeckGlJsonChart {...props} />)
    const DeckGL = wrapper.find("DeckGL")

    expect(DeckGL.length).toBe(1)
    expect(DeckGL.prop("getTooltip")).toBeDefined()

    // @ts-ignore
    const createdTooltip = DeckGL.prop("getTooltip")({
      object: {
        elevationValue: 10,
      },
    })

    expect(createdTooltip.html).toBe("<b>Elevation Value:</b> 10")
  })

  it("should render an empty tooltip", () => {
    const props = getProps({
      tooltip: "",
    })
    const wrapper = shallow(<DeckGlJsonChart {...props} />)
    const DeckGL = wrapper.find("DeckGL")

    expect(DeckGL.length).toBe(1)
    expect(DeckGL.prop("getTooltip")).toBeDefined()

    // @ts-ignore
    const createdTooltip = DeckGL.prop("getTooltip")({
      object: {
        elevationValue: 10,
      },
    })

    expect(createdTooltip).toBe(false)
  })
})
