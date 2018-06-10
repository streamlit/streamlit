import React, {PureComponent} from 'react';
import DeckGL, {ScatterplotLayer, TextLayer} from 'deck.gl';
import MapGL from 'react-map-gl';
import {dataFrameToArrayOfDicts} from '../dataFrameProto';

import { Alert }  from 'reactstrap';

import {
  indexGetByName,
  tableGet,
  tableGetRowsAndCols,
} from '../dataFrameProto';

// import './DeckGlMap.css';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoidGhpYWdvdCIsImEiOiJjamh3bm85NnkwMng4M3dydnNveWwzeWNzIn0.vCBDzNsEF2uFSFk2AM0WZQ';

class DeckGlMap extends PureComponent {
  constructor(props) {
    super(props);

    // TODO: Set lat/lon/zoom based on data, if not set explicitly.
    const optStr = this.props.element.get('options');
    const opt = optStr ? JSON.parse(optStr) : {};
    const v = opt.viewport || {};

    this.state = {
      viewport: {
        width: v.width || props.width,
        height: v.height || 500,
        longitude: v.longitude || 0,
        latitude: v.latitude || 0,
        pitch: v.pitch || 0,
        bearing: v.bearing || 0,
        zoom: v.zoom || 1,
      },
    };
  }

  _onViewportChange(viewport) {
    this.setState({
      viewport: {...this.state.viewport, ...viewport},
    });
  }

  render() {
    const data = dataFrameToArrayOfDicts(this.props.element.get('data'));

    try {
      return (
        <MapGL
          {...this.state.viewport}
          mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN}
          onViewportChange={this._onViewportChange.bind(this)}
          >
          <DeckGL
            {...this.state.viewport}
            layers={[
              new ScatterplotLayer({
                data: data,
                //data: [{lon: -122.402, lat: 37.79, color: "#ff0000", radius: 1000}],
                opacity: 0.3,
                getPosition: d => [d.lon, d.lat],
                getRadius: d => d.radius == null ? 100 : d.radius,
                getColor: d => d.color == null ? [200, 30, 0, 128] : hexToRgba(d.color),
              }),
            ]} />
        </MapGL>
      )
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


function fallback(x, def) {
  if (x == null) return def;
  return x;
}

function hexToRgba(hex) {
  if (!hex || typeof hex != 'string') {
    throw new Error('Hex value must be a string');
  }

  if (hex.length == 0) {
    throw new Error('Hex string cannot have zero length');
  }

  if (hex[0] != '#') {
    throw new Error('Hex string must start with "#"');
  }

  hex = hex.substr(1);

  // Add alpha.
  if (hex.length == 3) hex += 'f';
  else if (hex.length == 6) hex += 'ff';

  // If shorthand: rgba
  if (hex.length == 4) {
    const res = hex.match(/[a-f0-9]/gi);
    if (res.length != 4) {
      throw new Error(
          'Hex string must be of form #rgb, #rgba, #rrggbb, or #rrggbbaa');
    }
    return res.map(v => parseInt(v + v, 16));

  // If longhand: rrggbbaa
  } else if (hex.length == 8) {
    const res = hex.match(/[a-f0-9]{2}/gi);
    if (res.length != 4) {
      throw new Error(
          'Hex string must be of form #rgb, #rgba, #rrggbb, or #rrggbbaa');
    }
    return res.map(v => parseInt(v, 16));
  }

  if (!hex) throw new Error('Bad hex string');
}

export default DeckGlMap;
