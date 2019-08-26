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

import React from 'react'
import {
  Circle,
  LayerGroup,
  Map as LeafletMap,
  TileLayer,
} from 'react-leaflet'
import {
  indexGetByName,
  tableGet,
  tableGetRowsAndCols,
} from '../../../lib/dataFrameProto'
import './Map.scss'

/**
  * Functional element representing formatted text.
  */
class Map extends React.PureComponent {
  render() {
    const {element, width} = this.props
    const points = element.get('points')

    // Create an array of circles to display.
    const circles = []
    const nPoints = tableGetRowsAndCols(points.get('data'))[0]
    const latCol = indexGetByName(points.get('columns'), 'lat')
    const lonCol = indexGetByName(points.get('columns'), 'lon')
    if (latCol < 0 || lonCol < 0) {
      throw new Error("Map points must have 'lat' and 'lon' columns.")
    }
    for (let i = 0; i < nPoints; i++) {
      const position = [
        tableGet(points.get('data'), latCol, i),
        tableGet(points.get('data'), lonCol, i),
      ]
      circles.push(<Circle
        center={position}
        fillColor="red"
        opacity={0.1}
        radius={120}
        stroke={false}
        key={i}
      />)
    }

    // Compute the center of the map;
    let center = this.center
    if (this.center === undefined) {
      if (nPoints === 0) {
        center = [37.7749, -122.4194] // San Francisco
      } else {
        let sumLat = 0.0
        let sumLon = 0.0
        for (let indx = 0; indx < nPoints; indx++) {
          sumLat += tableGet(points.get('data'), latCol, indx)
          sumLon += tableGet(points.get('data'), lonCol, indx)
        }
        center = this.center = [sumLat / nPoints, sumLon / nPoints]
      }
    }

    // Draw the map.
    const zoom = 13

    return (
      <LeafletMap center={center} zoom={zoom} className="stMap" style={{width, height: width}}>
        <TileLayer
          /* eslint-disable-next-line max-len */
          attribution="&amp;copy <a href=&quot;http://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LayerGroup>
          { circles }
        </LayerGroup>
      </LeafletMap>
    )
  }
}

export default Map
