/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { useState, ReactElement, ReactNode } from "react"
import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import { render } from "@streamlit/lib/src/test_util"
import { act } from "react-dom/test-utils"

import { PlotlyChart as PlotlyChartProto } from "@streamlit/lib/src/proto"
import mock from "./mock"

import { PlotlyChart, DEFAULT_HEIGHT, PlotlyChartProps } from "./PlotlyChart"

const DEFAULT_PLOTLY_WIDTH = "700"
const DEFAULT_PLOTLY_HEIGHT = "450"

const getProps = (
  elementProps: Partial<PlotlyChartProto> = {}
): PlotlyChartProps => ({
  element: PlotlyChartProto.create({
    ...mock,
    ...elementProps,
  }),
  width: 0,
  height: 0,
})

// eslint-disable-next-line testing-library/no-node-access -- There's no other way to get the parent element
const getParent = (wrapper: Element): Element | null => wrapper.parentElement

const getPlotlyRoot = (wrapper: Element): Element | null => {
  let root = getParent(wrapper)
  while (root && !root.classList.contains("stPlotlyChart")) {
    root = getParent(root)
  }
  return root
}

type Setter<T> = React.Dispatch<React.SetStateAction<T>>
interface DimensionsSetterProps {
  width: number
  height: number | undefined
  setWidth: Setter<number>
  setHeight: Setter<number | undefined>
}

interface ChildrenFunction {
  children: (props: DimensionsSetterProps) => ReactNode
}

function DimensionsSetter({ children }: ChildrenFunction): ReactElement {
  const [width, setWidth] = useState<number>(0)
  const [height, setHeight] = useState<number | undefined>(undefined)

  return <div>{children({ width, height, setWidth, setHeight })}</div>
}

async function testEnterAndExitFullscreen(
  useContainerWidth: boolean
): Promise<void> {
  let setWidth: Setter<number>, setHeight: Setter<number | undefined>
  render(
    <DimensionsSetter>
      {({ width, height, setWidth: w, setHeight: h }) => {
        setWidth = w
        setHeight = h

        const nonFullScreenProps = {
          ...getProps({
            useContainerWidth,
          }),
          height: undefined,
        }

        return (
          <PlotlyChart {...nonFullScreenProps} width={width} height={height} />
        )
      }}
    </DimensionsSetter>
  )
  await new Promise(process.nextTick)
  const label = screen.getByText("Group 1")
  // eslint-disable-next-line testing-library/no-node-access
  const svg = getPlotlyRoot(label)?.querySelector("svg")

  expect(svg).toHaveAttribute("width", DEFAULT_PLOTLY_WIDTH)
  expect(svg).toHaveAttribute("height", DEFAULT_PLOTLY_HEIGHT)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Test verifies this
  expect(setWidth!).toBeDefined()
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Test verifies this
  expect(setHeight!).toBeDefined()

  act(() => {
    setWidth(800)
    setHeight(800)
  })
  await new Promise(process.nextTick)
  const label2 = screen.getByText("Group 1")
  // eslint-disable-next-line testing-library/no-node-access
  const svg2 = getPlotlyRoot(label2)?.querySelector("svg")
  expect(svg2).toHaveAttribute("width", "800")
  expect(svg2).toHaveAttribute("height", "800")

  act(() => {
    setWidth(300)
    setHeight(undefined)
  })
  await new Promise(process.nextTick)

  const label3 = screen.getByText("Group 1")
  // eslint-disable-next-line testing-library/no-node-access
  const svg3 = getPlotlyRoot(label3)?.querySelector("svg")
  if (useContainerWidth) {
    expect(svg3).toHaveAttribute("width", "300")
  } else {
    expect(svg3).toHaveAttribute("width", DEFAULT_PLOTLY_WIDTH)
  }
  expect(svg3).toHaveAttribute("height", DEFAULT_PLOTLY_HEIGHT)
}

describe("PlotlyChart Element", () => {
  it("renders without crashing", async () => {
    const props = getProps()
    render(<PlotlyChart {...props} />)
    await new Promise(process.nextTick)

    // Group 1 is just a label
    expect(screen.getByText("Group 1")).toBeInTheDocument()
  })

  describe("Dimensions", () => {
    it("fullscreen", async () => {
      const props = {
        ...getProps(),
        height: 400,
        width: 400,
      }
      render(<PlotlyChart {...props} />)
      await new Promise(process.nextTick)
      const label = screen.getByText("Group 1")
      // eslint-disable-next-line testing-library/no-node-access
      const svg = getPlotlyRoot(label)?.querySelector("svg")
      expect(svg).toHaveAttribute("width", "400")
      expect(svg).toHaveAttribute("height", "400")
    })

    it("useContainerWidth true", async () => {
      const props = {
        ...getProps({
          useContainerWidth: true,
        }),
      }
      render(<PlotlyChart {...props} />)
      await new Promise(process.nextTick)
      const label = screen.getByText("Group 1")
      // eslint-disable-next-line testing-library/no-node-access
      const svg = getPlotlyRoot(label)?.querySelector("svg")

      expect(svg).toHaveAttribute("width", DEFAULT_PLOTLY_WIDTH)
      expect(svg).toHaveAttribute("height", DEFAULT_PLOTLY_HEIGHT)
    })

    it("useContainerWidth false", async () => {
      const props = {
        ...getProps({
          useContainerWidth: false,
        }),
      }
      render(<PlotlyChart {...props} />)
      await new Promise(process.nextTick)
      const label = screen.getByText("Group 1")
      // eslint-disable-next-line testing-library/no-node-access
      const svg = getPlotlyRoot(label)?.querySelector("svg")

      expect(svg).toHaveAttribute("width", DEFAULT_PLOTLY_WIDTH)
      expect(svg).toHaveAttribute("height", DEFAULT_PLOTLY_HEIGHT)
    })

    // eslint-disable-next-line jest/expect-expect -- underlying testEnterAndExitFullscreen function has expect statements
    it("renders properly when entering fullscreen and out of fullscreen and useContainerWidth is false", async () => {
      await testEnterAndExitFullscreen(false)
    })
    // eslint-disable-next-line jest/expect-expect -- underlying testEnterAndExitFullscreen function has expect statements
    it("renders properly when entering fullscreen and out of fullscreen and useContainerWidth is true", async () => {
      await testEnterAndExitFullscreen(true)
    })
  })
  describe("Render iframe", () => {
    const props = getProps({
      chart: "url",
      url: "http://url.test",
      figure: undefined,
    })
    it("should render an iframe", () => {
      render(<PlotlyChart {...props} />)
      const iframe = screen.getByTitle("Plotly")
      expect(iframe).toBeInTheDocument()
      expect(iframe).toMatchSnapshot()
      expect(iframe).toHaveStyle(`height: ${DEFAULT_HEIGHT}px`)
    })
    it("should render with an specific height", () => {
      const propsWithHeight = {
        ...props,
        height: 400,
        width: 500,
      }
      render(<PlotlyChart {...propsWithHeight} />)
      const iframe = screen.getByTitle("Plotly")
      expect(iframe).toBeInTheDocument()
      expect(iframe).toHaveStyle("height: 400px")
    })
  })
  describe("Theming", () => {
    it("pulls default config values from theme", async () => {
      const props = getProps()
      render(<PlotlyChart {...props} />)
      await new Promise(process.nextTick)

      const label = screen.getByText("Group 1")
      // Verify that things not overwritten by the user still fall back to the
      // theme default. Note that labels are converted from hex to rgb.
      expect(label).toHaveStyle("fill: rgb(49, 51, 63)")

      // eslint-disable-next-line testing-library/no-node-access -- There's no other way to get the SVG
      const svg = getPlotlyRoot(label)?.querySelector("svg")
      // Note that labels are converted from hex to rgb.
      expect(svg).toHaveStyle("background: rgb(255, 255, 255)")
    })
    it("has user specified config take priority", async () => {
      const props = getProps()
      const spec = JSON.parse(props.element.figure?.spec || "") || {}
      spec.layout = {
        ...spec?.layout,
        paper_bgcolor: "orange",
      }
      props.element.figure = props.element.figure || {}
      props.element.figure.spec = JSON.stringify(spec)
      render(<PlotlyChart {...props} />)
      await new Promise(process.nextTick)

      const label = screen.getByText("Group 1")
      // Verify that things not overwritten by the user still fall back to the
      // theme default. Note that labels are converted from hex to rgb.
      expect(label).toHaveStyle("fill: rgb(49, 51, 63)")

      // eslint-disable-next-line testing-library/no-node-access -- There's no other way to get the SVG
      const svg = getPlotlyRoot(label)?.querySelector("svg")
      expect(svg).toHaveStyle("background: orange")
    })
  })
})
