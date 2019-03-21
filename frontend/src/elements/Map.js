/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Displays a Python Exception in the Report.
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
} from '../dataFrameProto';
// import './ExceptionElement.css';

/**
  * Functional element representing formatted text.
  */
class Map extends PureComponent {
  render() {
    const {map, width} = this.props;
    try {
      const points = map.get('points');

      // element.map.center_lat = points['lat'].mean()
      // element.map.center_lon = points['lon'].mean()
      // element.map.zoom = 13;

      // NYC -> 40.7831° N, 73.9712° W

      // Create an array of circles to display.
      const circles = [];
      const nPoints = tableGetRowsAndCols(points.get('data'))[0];
      const latCol = indexGetByName(points.get('columns'), 'lat');
      const lonCol = indexGetByName(points.get('columns'), 'lon');
      if (latCol < 0 || lonCol < 0) {
        throw new Error("Map points must have 'lat' and 'lon' columns.");
      }
      for (let i = 0; i < nPoints; i++) {
        const position = [
          tableGet(points.get('data'), latCol, i),
          tableGet(points.get('data'), lonCol, i),
        ];
        circles.push(<Circle
          center={position}
          fillColor="red"
          opacity={0.1}
          radius={120}
          stroke={false}
          key={i}
        />);
      }

      // Compute the center of the map;
      let center = this.center;
      if (this.center === undefined) {
        if (nPoints === 0) {
          center = [37.7749, -122.4194]; // San Francisco
        } else {
          let sumLat = 0.0;
          let sumLon = 0.0;
          for (let indx = 0; indx < nPoints; indx++) {
            sumLat += tableGet(points.get('data'), latCol, indx);
            sumLon += tableGet(points.get('data'), lonCol, indx);
          }
          center = this.center = [sumLat / nPoints, sumLon / nPoints];
        }
      }

      // Draw the map.
      const zoom = 13;

      return (
        <LeafletMap style={{width, height: width}} center={center} zoom={zoom}>
          <TileLayer
            /* eslint-disable-next-line max-len */
            attribution="&amp;copy <a href=&quot;http://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LayerGroup>
            { circles }
          </LayerGroup>
        </LeafletMap>
      );
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
