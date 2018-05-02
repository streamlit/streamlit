/**
 * Displays a Python Exception in the Report.
 */

import React, { PureComponent} from 'react';
import { Map as LeafletMap, TileLayer, Marker, Popup } from 'react-leaflet'
// import './ExceptionElement.css';
// import { dispatchOneOf } from 'streamlit-shared/lib/immutableProto';

 /**
  * Functional element representing formatted text.
  */
class Map extends PureComponent {
  render() {
    this.state = {
      lat: 51.505,
      lng: -0.09,
      zoom: 13,
    }

    const {map, width} = this.props;
    console.log('map:', map.toJS())

    const center = [map.get('centerLat'), map.get('centerLon')];
    const zoom = map.get('zoom');
    return (
      <LeafletMap style={{width, height: width}} center={center} zoom={zoom}>
        <TileLayer
          attribution="&amp;copy <a href=&quot;http://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center}>
          <Popup>
            <span>
              This is the center!
            </span>
          </Popup>
        </Marker>
      </LeafletMap>
    )
  }
}

export default Map;
