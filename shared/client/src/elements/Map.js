/**
 * Displays a Python Exception in the Report.
 */

import React, { PureComponent} from 'react';
import {
  Circle,
  LayerGroup,
  Map as LeafletMap,
  TileLayer,
} from 'react-leaflet';
import { Alert }  from 'reactstrap';
import {
  indexGetByName,
  tableGet,
  tableGetRowsAndCols,
} from 'streamlit-shared/lib/dataFrameProto';
// import './ExceptionElement.css';

 /**
  * Functional element representing formatted text.
  */
class Map extends PureComponent {
  render() {
    const {map, width} = this.props;
    try {
      const points = map.get('points')

      // Create an array of circles to display.
      const circles = [];
      const [nPoints, _] = tableGetRowsAndCols(points.get('data'));
      const lat_col = indexGetByName(points.get('columns'), 'lat');
      const lon_col = indexGetByName(points.get('columns'), 'lon');
      if (lat_col < 0 || lon_col < 0)
        throw new Error("Map points must have 'lat' and 'lon' columns.");
      for (var i = 0 ; i < nPoints ; i++) {
        const position = [
          tableGet(points.get('data'), lat_col, i),
          tableGet(points.get('data'), lon_col, i)
        ];
        circles.push(<Circle
          center={position}
          fillColor="red"
          opacity={0.1}
          radius={60}
          stroke={false}
          key={i}
        />);
        console.log(circles[i]);
      }
      console.log('circles', circles);

      const center = [map.get('centerLat'), map.get('centerLon')];
      const zoom = map.get('zoom');
      return (
        <LeafletMap style={{width, height: width}} center={center} zoom={zoom}>
          <TileLayer
            attribution="&amp;copy <a href=&quot;http://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LayerGroup>
            { circles }
          </LayerGroup>
        </LeafletMap>
      )
    } catch (e) {
      console.log(e.stack);
      return (
        <Alert style={{width}} color="danger">
          <strong>{e.name}</strong>: {e.message}
        </Alert>
      );
    }
  }
}

export default Map;
