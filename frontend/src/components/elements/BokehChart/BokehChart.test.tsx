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
import { mount } from "src/lib/test_util"
import { BokehChart as BokehChartProto } from "src/autogen/proto"

import Figure from "./mock"

import { BokehChartProps } from "./BokehChart"

const mockBokehEmbed = {
  embed: {
    embed_item: jest.fn(),
  },
}
const globalAny: any = global

globalAny.Bokeh = mockBokehEmbed

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BokehChart } = require("./BokehChart")

const getProps = (
  elementProps: Partial<BokehChartProto> = {}
): BokehChartProps => ({
  element: BokehChartProto.create({
    figure: JSON.stringify(Figure),
    useContainerWidth: false,
    elementId: "1",
    ...elementProps,
  }),
  height: 400,
  width: 400,
})

expect.extend({
  toMatchBokehDimensions(data, width, height) {
    const plot =
      data && data.doc && data.doc.roots && data.doc.roots.references
        ? data.doc.roots.references.find((e: any) => e.type === "Plot")
        : undefined

    if (!plot) {
      return {
        message: () => `expected data to contain attributes`,
        pass: false,
      }
    }

    const pass =
      plot.attributes.plot_width === width &&
      plot.attributes.plot_height === height

    return {
      message: () =>
        `expected ${plot.attributes.plot_width}x${plot.attributes.plot_height} to be ${width}x${height}`,
      pass,
    }
  },
})

describe("BokehChart element", () => {
  // Avoid Warning: render(): Rendering components directly into document.body is discouraged.
  let div: HTMLDivElement
  beforeEach(() => {
    div = document.createElement("div")
    document.body.appendChild(div)
  })

  afterEach(() => {
    mockBokehEmbed.embed.embed_item.mockClear()
    document.body.removeChild(div)
  })

  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<BokehChart {...props} />, {
      attachTo: div,
    })

    expect(wrapper.find("div").length).toBe(1)
  })

  describe("Chart dimensions", () => {
    it("should use height if not useContainerWidth", () => {
      const props = getProps()
      mount(<BokehChart {...props} />, {
        attachTo: div,
      })

      expect(mockBokehEmbed.embed.embed_item).toHaveBeenCalledWith(
        // @ts-expect-error
        expect.toMatchBokehDimensions(400, 400),
        "bokeh-chart-1"
      )
    })

    it("should have width if useContainerWidth", () => {
      const props = {
        ...getProps({
          useContainerWidth: true,
        }),
        height: 0,
      }

      mount(<BokehChart {...props} />, {
        attachTo: div,
      })

      expect(mockBokehEmbed.embed.embed_item).toHaveBeenCalledWith(
        // @ts-expect-error
        expect.toMatchBokehDimensions(400),
        "bokeh-chart-1"
      )
    })
  })

  it("should re-render the chart when the component updates", () => {
    const props = getProps()
    // shallow does not work with useEffect hooks
    const wrapper = mount(<BokehChart {...props} />, {
      attachTo: div,
    })
    wrapper.setProps({
      width: 500,
      height: 500,
    })
    expect(mockBokehEmbed.embed.embed_item).toHaveBeenCalledTimes(2)
  })
})
