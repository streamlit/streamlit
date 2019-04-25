/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react';
import {
  tableGetRowsAndCols,
  indexGet,
  tableGet,
  INDEX_COLUMN_DESIGNATOR,
} from '../dataFrameProto';
import { format, Duration } from '../format';
import { PureStreamlitElement } from './util/StreamlitElement';

import * as recharts from 'recharts';

import './Chart.css';

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
};

/** Types of dataframe-indices that are supported as x axes. */
const SUPPORTED_INDEX_TYPES = new Set([
  'plainIndex', 'int_64Index', 'uint_64Index', 'float_64Index',
  'datetimeIndex', 'timedeltaIndex', 'rangeIndex',
  // TODO(tvst): Support other index types
]);

class Chart extends PureStreamlitElement {
  safeRender() {
    const {element, width} = this.props;
    // Default height is 200 if not specified.
    const chartXOffset = 0; // 35;
    const chartDims = {
      width: (element.get('width') || width) + chartXOffset,
      height: element.get('height') || 200,
    };

    // Convert the data into a format that Recharts understands.
    const dataFrame = element.get('data');
    const data = [];
    const [rows, cols] = tableGetRowsAndCols(dataFrame.get('data'));

    const indexType = dataFrame.get('index').get('type');
    const hasSupportedIndex = SUPPORTED_INDEX_TYPES.has(indexType);

    // transform to number, e.g. to support Date
    let indexTransform = undefined;
    // transform to human readable tick, e.g. to support Date
    let tickFormatter = undefined;
    switch (indexType) {
      case 'datetimeIndex':
        indexTransform = date => date.getTime();
        tickFormatter = millis => format.dateToString(new Date(millis));
        break;
      case 'timedeltaIndex':
        indexTransform = date => date.getTime();
        tickFormatter = millis => format.durationToString(new Duration(millis));
        break;
      case 'float_64Index':
        tickFormatter = float => float.toFixed(2);
        break;
      default:
        break;
    }

    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      let rowData = {};

      if (hasSupportedIndex) {
        rowData[INDEX_COLUMN_DESIGNATOR] =
            indexGet(dataFrame.get('index'), 0, rowIndex);
        if (indexTransform) {
          rowData[INDEX_COLUMN_DESIGNATOR] =
              indexTransform(rowData[INDEX_COLUMN_DESIGNATOR]);
        }
      }

      for (let colIndex = 0; colIndex < cols; colIndex++) {
        rowData[indexGet(dataFrame.get('columns'), 0, colIndex)] =
            tableGet(dataFrame.get('data'), colIndex, rowIndex);
      }
      data.push(rowData);
    }

    // Parse out the chart props into an object.
    const chart_props = extractProps(element);
    // for (const chartProperty of element.get('props'))
    //   chart_props[chartProperty.get('key')] = chartProperty.get('value');

    return (
      <div style={chartDims}>
        <div style={{...chartDims, left: -chartXOffset, position: 'absolute'}}>
          {
            React.createElement(
              COMPONENTS[element.get('type')],
              {...chartDims, data, ...chart_props},
              ...element.get('components').map((component) => {
                const component_props = extractProps(component);
                const isXAxis = component.get('type') === 'XAxis';
                if (isXAxis && tickFormatter) {
                  component_props['tickFormatter'] = tickFormatter;
                }
                return React.createElement(
                  COMPONENTS[component.get('type')], component_props);
              }
              )
            )
          }
        </div>
      </div>
    );
  }
}

function extractProps(elt) {
  function tryParseFloat(s) {
    s = s.trim();
    const f = parseFloat(s);
    return isNaN(f) ? s : f;
  }

  const props = {};
  for (const prop of elt.get('props')) {
    let value = prop.get('value');

    // Do a little special-casing here. This is a hack which has to be fixed.
    if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    } else if (prop.get('key') === 'domain') {
      value = prop.get('value').split(',').map((x) => tryParseFloat(x));
    }
    props[prop.get('key')] = value;
  }
  return props;
}

export default Chart;
