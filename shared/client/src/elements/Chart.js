import React, { PureComponent } from 'react';
import { Alert }  from 'reactstrap';
import { tableGetRowsAndCols, indexGet, tableGet } from 'streamlit-shared/lib/dataFrameProto';
import { format, Duration } from '../format';

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
}

/** Column name used to designate the dataframe index. */
const INDEX_COLUMN_DESIGNATOR = '::index';

/** Types of dataframe-indices that are supported as x axes. */
const SUPPORTED_INDEX_TYPES = new Set([
  'int_64Index', 'uint_64Index', 'float_64Index', 'datetimeIndex',
  'timedeltaIndex', 'rangeIndex',
  // TODO(tvst): Support other index types
]);

class Chart extends PureComponent {
  render() {
    try {
      const {chart, width} = this.props;
      // Default height is 200 if not specified.
      const chartXOffset = 0; // 35;
      const chartDims = {
        width: (chart.get('width') || width) + chartXOffset,
        height: chart.get('height') || 200,
      }

      // Convert the data into a format that Recharts understands.
      const dataFrame = chart.get('data');
      const data = [];
      const [rows, cols] = tableGetRowsAndCols(dataFrame.get('data'));

      const indexType = dataFrame.get('index').get('type');
      const hasSupportedIndex = SUPPORTED_INDEX_TYPES.has(indexType);

      // transform to number, e.g. to support Date
      let indexTransform = undefined
      // transform to human readable tick, e.g. to support Date
      let tickFormatter = undefined
      console.log(`Chart.render() the indexType is ${indexType}`)
      switch (indexType) {
        case 'datetimeIndex':
          indexTransform = date => date.getTime()
          tickFormatter = millis => format.dateToString(new Date(millis));
          break;
        case 'timedeltaIndex':
          indexTransform = date => date.getTime()
          tickFormatter = millis => format.durationToString(new Duration(millis));
          break;
        case 'float_64Index':
          tickFormatter = float => float.toFixed(2);
      }

      for (let rowIndex = 0 ; rowIndex < rows ; rowIndex++ ) {
        let rowData = {};

        if (hasSupportedIndex) {
          rowData[INDEX_COLUMN_DESIGNATOR] =
              indexGet(dataFrame.get('index'), 0, rowIndex);
          if (indexTransform) {
            rowData[INDEX_COLUMN_DESIGNATOR] = indexTransform(rowData[INDEX_COLUMN_DESIGNATOR])
          }
        }

        for (let colIndex = 0 ; colIndex < cols ; colIndex++) {
          rowData[indexGet(dataFrame.get('columns'), 0, colIndex)] =
              tableGet(dataFrame.get('data'), colIndex, rowIndex);
        }
        data.push(rowData)
      }

      // Parse out the chart props into an object.
      const chart_props = extractProps(chart);
      // for (const chartProperty of chart.get('props'))
      //   chart_props[chartProperty.get('key')] = chartProperty.get('value');

      return (
        <div style={chartDims}>
          <div style={{...chartDims, left: -chartXOffset, position: 'absolute'}}>
            {
              React.createElement(
                COMPONENTS[chart.get('type')],
                  {...chartDims, data, ...chart_props},
                  ...chart.get('components').map((component) => {
                    const component_props = extractProps(component);
                    const isXAxis = component.get('type') === 'XAxis'
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
    } catch (e) {
      console.log(e.stack);
      return (
        <Alert color="danger">
          <strong>{e.name}</strong>: {e.message}
        </Alert>
      );
    }
  }
}

function extractProps(elt) {
  function tryParseFloat(s) {
    s = s.trim()
    const f = parseFloat(s)
    return isNaN(f) ? s : f;
  }

  const props = {}
  for (const prop of elt.get('props')) {
    let value = prop.get('value');

    // Do a little special-casing here. This is a hack which has to be fixed.
    if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    } else if (prop.get('key') === 'domain') {
      value = prop.get('value').split(',').map((x) => tryParseFloat(x))
    }
    props[prop.get('key')] = value;
  }
  return props;
}

export default Chart;
