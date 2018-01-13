import React from 'react';
import {
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis
} from 'recharts';

// Todo: Get rid of this and use the recharts version.
import { AutoSizer } from 'react-virtualized';

// Represents a chart with some data
function Chart(props) {
  const height=200;
  return (
    <div style={{height}}>
      <AutoSizer>
        {({width}) => (
          <LineChart width={width} height={height} data={props.data}>
            <XAxis dataKey="x" />
            {/* <XAxis dataKey="x"/> */}
            <YAxis
              type="number"
              domain={[0.0, 1.0]}
            />
            <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
            <Line
              isAnimationActive={false}
              type="linear"
              dataKey="y"
              stroke="rgb(40, 113, 238)"
              dot={false}
            />
            <Legend />
          </LineChart>
        )}
      </AutoSizer>
    </div>
  );
}

export default Chart;
