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
import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import "jest-canvas-mock"
import { render } from "@streamlit/lib/src/test_util"
import {
  CATEGORICAL,
  DATETIME,
  FLOAT64,
  INT64,
  UINT64,
  RANGE,
  UNICODE,
  VEGA_LITE,
} from "@streamlit/lib/src/mocks/arrow"
import { Quiver } from "@streamlit/lib/src/dataframes/Quiver"
import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"
import {
  PropsWithHeight,
  ArrowVegaLiteChart,
  getDataArray,
} from "./ArrowVegaLiteChart"

const MOCK = {
  datasets: [],
  data: new Quiver({
    data: VEGA_LITE,
  }),
  spec: JSON.stringify({
    mark: "circle",
    encoding: {
      x: { field: "a", type: "quantitative" },
      y: { field: "b", type: "quantitative" },
      size: { field: "c", type: "quantitative" },
      color: { field: "c", type: "quantitative" },
    },
  }),
  useContainerWidth: true,
  vegaLiteTheme: "",
}

const getProps = (props: Partial<PropsWithHeight> = {}): PropsWithHeight => ({
  element: MOCK,
  width: 0,
  height: 0,
  theme: mockTheme.emotion,
  ...props,
})

const getCanvasContext = (): CanvasRenderingContext2D => {
  const canvas = screen
    .getByTestId("stArrowVegaLiteChart")
    // eslint-disable-next-line testing-library/no-node-access
    .querySelector("canvas") as HTMLCanvasElement

  return canvas.getContext("2d") as CanvasRenderingContext2D
}

describe("VegaLiteChart Element", () => {
  it("renders without crashing", async () => {
    const props = getProps()

    await render(<ArrowVegaLiteChart {...props} />)
    expect(screen.getByTestId("stArrowVegaLiteChart")).toBeInTheDocument()
  })

  it("pulls default config values from theme", async () => {
    const props = getProps({ theme: mockTheme.emotion })

    render(<ArrowVegaLiteChart {...props} />)

    await new Promise(process.nextTick)

    const ctx = getCanvasContext()
    // We can simplify by using snapshots to determine if the right theme is used
    expect(ctx.__getEvents()).toMatchSnapshot()
  })

  it("applies Streamlit theme if specified", async () => {
    const props = getProps({
      element: {
        ...MOCK,
        vegaLiteTheme: "streamlit",
        spec: JSON.stringify({
          mark: "circle",
          encoding: {
            x: { field: "a", type: "quantitative" },
            y: { field: "b", type: "quantitative" },
            size: { field: "c", type: "quantitative" },
            color: { field: "c", type: "quantitative" },
          },
        }),
      },
    })

    render(<ArrowVegaLiteChart {...props} />)
    await new Promise(process.nextTick)

    const ctx = getCanvasContext()
    // We can simplify by using snapshots to determine if the right theme is used
    expect(ctx.__getEvents()).toMatchSnapshot()
  })

  it("has user specified config take priority", async () => {
    const props = getProps({ theme: mockTheme.emotion })

    const spec = JSON.parse(props.element.spec)
    spec.config = { background: "purple", axis: { labelColor: "blue" } }

    props.element = {
      ...props.element,
      spec: JSON.stringify(spec),
    }

    render(<ArrowVegaLiteChart {...props} />)
    await new Promise(process.nextTick)

    const ctx = getCanvasContext()
    // We can simplify by using snapshots to determine if the right theme is used
    expect(ctx.__getEvents()).toMatchSnapshot()
  })

  describe("Types of dataframe indexes as x axis", () => {
    describe("Supported", () => {
      test("datetime", () => {
        const mockElement = { data: DATETIME }
        const q = new Quiver(mockElement)

        expect(getDataArray(q)).toEqual([
          {
            "(index)": 978220800000,
            "2000-12-31 00:00:00": new Date("2020-01-02T00:00:00.000Z"),
            "2001-12-31 00:00:00": new Date("2020-10-20T00:00:00.000Z"),
          },
          {
            "(index)": 1009756800000,
            "2000-12-31 00:00:00": new Date("2020-01-02T00:00:00.000Z"),
            "2001-12-31 00:00:00": new Date("2020-10-20T00:00:00.000Z"),
          },
        ])
      })

      test("float64", () => {
        const mockElement = { data: FLOAT64 }
        const q = new Quiver(mockElement)

        expect(getDataArray(q)).toEqual([
          { "(index)": 1.24, "1.24": 1.2, "2.35": 1.3 },
          { "(index)": 2.35, "1.24": 1.4, "2.35": 1.5 },
        ])
      })

      test("int64", () => {
        const mockElement = { data: INT64 }
        const q = new Quiver(mockElement)
        expect(getDataArray(q)).toEqual([
          {
            "(index)": 1,
            "1": 0,
            "2": 1,
          },
          {
            "(index)": 2,
            "1": 2,
            "2": 3,
          },
        ])
      })

      test("range", () => {
        const mockElement = { data: RANGE }
        const q = new Quiver(mockElement)

        expect(getDataArray(q)).toEqual([
          { "(index)": 0, "0": "foo", "1": "1" },
          { "(index)": 1, "0": "bar", "1": "2" },
        ])
      })

      test("uint64", () => {
        const mockElement = { data: UINT64 }
        const q = new Quiver(mockElement)
        expect(getDataArray(q)).toEqual([
          {
            "(index)": 1,
            "1": 1,
            "2": 2,
          },
          {
            "(index)": 2,
            "1": 3,
            "2": 4,
          },
        ])
      })
    })

    describe("Unsupported", () => {
      test("categorical", () => {
        const mockElement = { data: CATEGORICAL }
        const q = new Quiver(mockElement)
        expect(getDataArray(q)).toEqual([
          { c1: "foo", c2: 100 },
          { c1: "bar", c2: 200 },
        ])
      })

      test("unicode", () => {
        const mockElement = { data: UNICODE }
        const q = new Quiver(mockElement)

        expect(getDataArray(q)).toEqual([
          { c1: "foo", c2: "1" },
          { c1: "bar", c2: "2" },
        ])
      })
    })
  })
})
