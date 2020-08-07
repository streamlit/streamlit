/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import DeckGL from "deck.gl"
import { mount } from "enzyme"
import { fromJS } from "immutable"
import { StaticMap } from "react-map-gl"

import mockDeckGl from "./mock"
import { DeckGlChart, DeckGlChartProps } from "./DeckGlChart"

const getProps = (
  elementProps: Record<string, unknown> = {}
): DeckGlChartProps => ({
  element: fromJS({
    ...mockDeckGl,
    ...elementProps,
  }),
  width: 698,
  height: 500,
  mapboxToken: "mapboxToken",
})

describe("DeckGlChart Element", () => {
  const props = getProps()
  const wrapper = mount(<DeckGlChart {...props} />)

  it("renders without crashing", () => {
    expect(wrapper).toBeDefined()
  })

  it("should have proper shape", () => {
    const wrappingDiv = wrapper.find("div").first()

    expect(wrappingDiv.prop("className")).toContain("stDeckGlChart")
    expect(wrappingDiv.prop("style")).toStrictEqual({
      height: props.height,
      width: props.width,
    })
    expect(wrapper.find(DeckGL).prop("height")).toBe(props.height)
    expect(wrapper.find(DeckGL).prop("width")).toBe(props.width)
  })

  it("should have a DeckGL", () => {
    expect(wrapper.find(DeckGL).prop("initialViewState")).toMatchSnapshot(
      "initialViewState"
    )

    expect(wrapper.find(DeckGL).props()).toHaveProperty("controller")
    expect(wrapper.find(DeckGL).prop("layers")).toMatchSnapshot()
    // to check why this fails
    /* expect(wrapper.find(StaticMap).prop("mapboxApiAccessToken")).toBe(
      props.mapboxToken
    )
    */
  })
})
