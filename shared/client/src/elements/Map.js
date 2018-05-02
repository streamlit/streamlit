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

    const {width} = this.props;
    const position = [this.state.lat, this.state.lng];
    return (
      <LeafletMap style={{width, height: width}} center={position} zoom={this.state.zoom}>
        <TileLayer
          attribution="&amp;copy <a href=&quot;http://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>
            <span>
              A pretty CSS3 popup. <br /> Easily customizable.
            </span>
          </Popup>
        </Marker>
      </LeafletMap>
    )
  }
}

export default Map;
