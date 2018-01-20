import React from 'react';
import { tableGetRowsAndCols, indexGet, tableGet } from '../dataFrameProto';
import { AutoSizer } from 'react-virtualized';

import * as recharts from 'recharts';
const COMPONENTS = {
  ////////////
  // Charts //
  ////////////

  AreaChart         : recharts.AreaChart,
  BarChart          : recharts.BarChart,
  LineChart         : recharts.LineChart,
  ComposedChart     : recharts.ComposedChart,
  // PieChart       <- not implemented
  RadarChart        : recharts.RadarChart,
  // RadialBarChart <- not implemented
  // ScatterChart   <- not implemented
  Treemap           : recharts.Treemap,

  ////////////////////////
  // General Components //
  ////////////////////////

  // ResponsiveContainer, <- not implemented
  Area              : recharts.Area,
  Legend            : recharts.Legend,
  Tooltip           : recharts.Tooltip,
  // Cell           <- not implemented
  // Text           <- not implemented
  // Label          <- not implemented
  // LabelList      <- not implemented

  //////////////////////////
  // Cartesian Components //
  //////////////////////////

  Area              : recharts.Area,
  Bar               : recharts.Bar,
  Line              : recharts.Line,
  Scatter           : recharts.Scatter,
  XAxis             : recharts.XAxis,
  YAxis             : recharts.YAxis,
  ZAxis             : recharts.ZAxis,
  Brush             : recharts.Brush,
  CartesianAxis     : recharts.CartesianAxis,
  CartesianGrid     : recharts.CartesianGrid,
  ReferenceLine     : recharts.ReferenceLine,
  ReferenceDot      : recharts.ReferenceDot,
  ReferenceArea     : recharts.ReferenceArea,
  ErrorBar          : recharts.ErrorBar,

  //////////////////////
  // Polar Components //
  //////////////////////

  Pie               : recharts.Pie,
  Radar             : recharts.Radar,
  RadialBar         : recharts.RadialBar,
  PolarAngleAxis    : recharts.PolarAngleAxis,
  PolarGrid         : recharts.PolarGrid,
  PolarRadiusAxis   : recharts.PolarRadiusAxis,

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

// Represents a chart with some data
function Chart({element}) {
  // Default height is 200 if not specified.
  const height = element.height || 200;

  // Convert the data into a format that Recharts understands.
  const dataFrame = element.data;
  const data = [];
  const [rows, cols] = tableGetRowsAndCols(dataFrame.data);
  for (let rowIndex = 0 ; rowIndex < rows ; rowIndex++ ) {
    let rowData = {};
    for (let colIndex = 0 ; colIndex < cols ; colIndex++) {
      rowData[indexGet(dataFrame.columns, 0, colIndex)] =
        tableGet(dataFrame.data, colIndex, rowIndex);
    }
    data.push(rowData)
  }

  const chartXOffset = 35;
  return (
    <div style={{height, left: -chartXOffset}}>
      <AutoSizer>
        {(dims) => {
          const width = (element.width || dims.width) + chartXOffset;
          const chart_props = {};
          for (const chartProperty of element.props)
            chart_props[chartProperty.key] = chartProperty.value;
          console.log('chart_props:')
          console.log(chart_props)
          return React.createElement(
            COMPONENTS[element.type],
            {width, height, data, ...chart_props},
            ...element.components.map((component) => {
                const component_props = {};
                for (const chartProperty of component.props)
                  component_props[chartProperty.key] = chartProperty.value;
                return React.createElement(
                  COMPONENTS[component.type],
                  component_props);
            })
          );
        }}
      </AutoSizer>
    </div>
  );
}

export default Chart;
