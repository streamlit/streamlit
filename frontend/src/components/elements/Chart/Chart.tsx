/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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
import {
  tableGetRowsAndCols,
  indexGet,
  tableGet,
  INDEX_COLUMN_DESIGNATOR,
} from "../../../lib/dataFrameProto"
import { format, Duration } from "../../../lib/format"
import { Map as ImmutableMap } from "immutable"
import FullScreenWrapper from "components/shared/FullScreenWrapper"
import * as recharts from "recharts"

import "./Chart.scss"

const COMPONENTS: any = {
  ////////////
  // Charts //
  ////////////

  AreaChart: recharts.AreaChart,
  BarChart: recharts.BarChart,
  LineChart: recharts.LineChart,
  ComposedChart: recharts.ComposedChart,
  // PieChart       <- not implemented
  RadarChart: recharts.RadarChart,
  // RadialBarChart <- not implemented
  // ScatterChart   <- not implemented
  Treemap: recharts.Treemap,

  ////////////////////////
  // General Components //
  ////////////////////////

  // ResponsiveContainer, <- not implemented
  Area: recharts.Area,
  Legend: recharts.Legend,
  Tooltip: recharts.Tooltip,
  // Cell           <- not implemented
  // Text           <- not implemented
  // Label          <- not implemented
  // LabelList      <- not implemented

  //////////////////////////
  // Cartesian Components //
  //////////////////////////

  Bar: recharts.Bar,
  Line: recharts.Line,
  Scatter: recharts.Scatter,
  XAxis: recharts.XAxis,
  YAxis: recharts.YAxis,
  ZAxis: recharts.ZAxis,
  Brush: recharts.Brush,
  CartesianAxis: recharts.CartesianAxis,
  CartesianGrid: recharts.CartesianGrid,
  ReferenceLine: recharts.ReferenceLine,
  ReferenceDot: recharts.ReferenceDot,
  ReferenceArea: recharts.ReferenceArea,
  ErrorBar: recharts.ErrorBar,

  //////////////////////
  // Polar Components //
  //////////////////////

  Pie: recharts.Pie,
  Radar: recharts.Radar,
  RadialBar: recharts.RadialBar,
  PolarAngleAxis: recharts.PolarAngleAxis,
  PolarGrid: recharts.PolarGrid,
  PolarRadiusAxis: recharts.PolarRadiusAxis,

  ////////////
  // Shapes //
  ////////////

  // Cross          <- not implemented
  // Curve          <- not implemented
  // Dot            <- not implemented
  // Polygon        <- not implemented
  // Rectangle      <- not implemented
  // Sector         <- not implemented
}

/** Types of dataframe-indices that are supported as x axes. */
const SUPPORTED_INDEX_TYPES = new Set([
  "plainIndex",
  "int_64Index",
  "uint_64Index",
  "float_64Index",
  "datetimeIndex",
  "timedeltaIndex",
  "rangeIndex",
  // TODO(tvst): Support other index types
])

interface Props {
  width: number
  element: ImmutableMap<string, any>
}

interface PropsWithHeight extends Props {
  height: number | undefined
}

interface State {}

class Chart extends React.PureComponent<PropsWithHeight, State> {
  render(): JSX.Element {
    const { element, width, height } = this.props
    // Default height is 200 if not specified.
    const chartXOffset = 0 // 35;
    const chartDims = {
      width: (element.get("width") || width) + chartXOffset,
      height: element.get("height") || height || 200,
    }

    // Convert the data into a format that Recharts understands.
    const dataFrame = element.get("data")
    const data = []
    const [rows, cols] = tableGetRowsAndCols(dataFrame.get("data"))

    const indexType = dataFrame.get("index").get("type")
    const hasSupportedIndex = SUPPORTED_INDEX_TYPES.has(indexType)

    // transform to number, e.g. to support Date
    let indexTransform: any = undefined
    // transform to human readable tick, e.g. to support Date
    let tickFormatter: any = undefined
    switch (indexType) {
      case "datetimeIndex":
        indexTransform = (date: Date) => date.getTime()
        tickFormatter = (millis: number) =>
          format.dateToString(new Date(millis))
        break
      case "timedeltaIndex":
        indexTransform = (date: Date) => date.getTime()
        tickFormatter = (millis: number) =>
          format.durationToString(new Duration(millis))
        break
      case "float_64Index":
        tickFormatter = (float: number) => float.toFixed(2)
        break
      default:
        break
    }

    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const rowData: any = {}

      if (hasSupportedIndex) {
        rowData[INDEX_COLUMN_DESIGNATOR] = indexGet(
          dataFrame.get("index"),
          0,
          rowIndex
        )
        if (indexTransform) {
          rowData[INDEX_COLUMN_DESIGNATOR] = indexTransform(
            rowData[INDEX_COLUMN_DESIGNATOR]
          )
        }
      }

      for (let colIndex = 0; colIndex < cols; colIndex++) {
        rowData[indexGet(dataFrame.get("columns"), 0, colIndex)] = tableGet(
          dataFrame.get("data"),
          colIndex,
          rowIndex
        )
      }
      data.push(rowData)
    }

    // Parse out the chart props into an object.
    const chart_props: boolean = extractProps(element)
    // for (const chartProperty of element.get('props'))
    //   chart_props[chartProperty.get('key')] = chartProperty.get('value');

    return (
      <div className="stChart" style={chartDims}>
        <div style={{ ...chartDims, left: -chartXOffset }}>
          {React.createElement(
            COMPONENTS[element.get("type")],
            { ...chartDims, data, ...{ chart_props } },
            ...element.get("components").map((component: any) => {
              const component_props: any = extractProps(component)
              const isXAxis = component.get("type") === "XAxis"
              if (isXAxis && tickFormatter) {
                component_props["tickFormatter"] = tickFormatter
              }
              return React.createElement(
                COMPONENTS[component.get("type")],
                component_props
              )
            })
          )}
        </div>
      </div>
    )
  }
}

function extractProps(element: any): boolean {
  function tryParseFloat(s: string): string | number {
    s = s.trim()
    const f = parseFloat(s)
    return isNaN(f) ? s : f
  }

  const props: any = {}
  element.get("props").forEach((prop: any) => {
    let value = prop.get("value")

    // Do a little special-casing here. This is a hack which has to be fixed.
    if (value === "true") {
      value = true
    } else if (value === "false") {
      value = false
    } else if (prop.get("key") === "domain") {
      value = prop
        .get("value")
        .split(",")
        .map((x: any) => tryParseFloat(x))
    }
    props[prop.get("key")] = value
  })
  return props
}

class WithFullScreenWrapper extends React.Component<Props> {
  render(): JSX.Element {
    const { element, width } = this.props
    return (
      <FullScreenWrapper width={width}>
        {({ width, height }) => (
          <Chart element={element} width={width} height={height} />
        )}
      </FullScreenWrapper>
    )
  }
}

export default WithFullScreenWrapper
