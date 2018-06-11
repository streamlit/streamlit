import React, {PureComponent} from 'react';
import DeckGL, {
  ArcLayer,
  GridLayer,
  HexagonLayer,
  LineLayer,
  PointCloudLayer,
  ScatterplotLayer,
  ScreenGridLayer,
  TextLayer,
} from 'deck.gl';
import MapGL from 'react-map-gl';
import {dataFrameToArrayOfDicts} from '../dataFrameProto';

import {Alert}  from 'reactstrap';

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

    // TODO: Grab map style from props.
    this.mapStyle = 'grey';

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
    try {
      if (this.mapStyle) {
        return (
          <MapGL
            {...this.state.viewport}
            mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN}
            onViewportChange={this._onViewportChange.bind(this)}
            >
            <DeckGL
              {...this.state.viewport}
              layers={this.buildLayers()} />
          </MapGL>
        );

      } else {
        return (
          <DeckGL
            {...this.state.viewport}
            layers={this.buildLayers()} />
        );
      }
    } catch (e) {
      console.log(e.stack);
      return (
        <Alert color="danger">
          <strong>{e.name}</strong>: {e.message}
        </Alert>
      );
    }
  }

  buildLayers() {
    const layers = this.props.element.get('layers');
    return layers.map(layer => this.buildLayer(layer)).toArray();
  }

  buildLayer(layer) {
    const data = dataFrameToArrayOfDicts(layer.get('data'));
    const spec = JSON.parse(layer.get('spec'));
    parseEncodings(spec);

    const type = spec.type || '';
    delete spec.type;

    switch (type.toLowerCase()) {
      case 'arclayer':
        return new ArcLayer(
          {data, ...Defaults.ArcLayer, ...spec});

      case 'gridlayer':
        return new GridLayer(
          {data, ...Defaults.GridLayer, ...spec});

      case 'hexagonlayer':
        return new HexagonLayer(
          {data, ...Defaults.HexagonLayer, ...spec});

      case 'linelayer':
        return new LineLayer(
          {data, ...Defaults.LineLayer, ...spec});

      case 'pointcloudlayer':
        return new PointCloudLayer(
          {data, ...Defaults.PointCloudLayer, ...spec});

      case 'scatterplotlayer':
        return new ScatterplotLayer(
          {data, ...Defaults.ScatterplotLayer, ...spec});

      case 'screengridlayer':
        return new ScreenGridLayer(
          {data, ...Defaults.ScreenGridLayer, ...spec});

      case 'textlayer':
        return new TextLayer(
          {data, ...Defaults.TextLayer, ...spec});

      default:
        throw new Error(`Unsupported layer type "${type}"`);
    }
  }
}


/**
 * Returns the first non-null/non-undefined argument.
 *
 * Usage:
 *   fallback(value, fallbackValue)
 *
 * Accepts infinitely many arguments:
 *   fallback(value, fallback1, fallback2, fallback3)
 */
function fallback() {
  for (let i = 0; i < arguments.length; i++) {
    if (arguments[i] != null) return arguments[i];
  }
  return null;
}

function getPositionFromLatLonColumns(d) {
  return [fallback(d.longitude, d.lon), fallback(d.latitude, d.lat)];
}

function getEndPositionFromLatLonColumn(d) {
  return [fallback(d.longitude2, d.lon2), fallback(d.latitude2, d.lat2)];
}

function getPositionFromPositionXYZColumns(d) {
  return [
    fallback(d.longitude, d.lon, d.positionX, d.x),
    fallback(d.latitude, d.lat, d.positionY, d.y),
    fallback(d.latitude, d.lat, d.positionZ, d.z),
  ];
}

function getNormalFromNormalXYZColumns(d) {
  return [d.normalX, d.normalY, d.normalZ];
}

const DEFAULT_COLOR = [200, 30, 0, 128];

function getColorFromColorRGBAColumns(d) {
  return d.colorR && d.colorG && d.colorB ?
      [d.colorR, d.colorG, d.colorB, d.colorA == null ? 255 : d.colorA] :
      DEFAULT_COLOR;
}

function getSourceColorFromSourceColorRGBAColumns(d) {
  return d.sourceColorR && d.sourceColorG && d.sourceColorB ?
      [d.sourceColorR, d.sourceColorG, d.sourceColorB,
          d.sourceColorA == null ? 255 : d.sourceColorA] :
      DEFAULT_COLOR;
}

function getTargetColorFromTargetColorRGBAColumns(d) {
  return d.targetColorR && d.targetColorG && d.targetColorB ?
      [d.targetColorR, d.targetColorG, d.targetColorB,
          d.targetColorA == null ? 255 : d.targetColorA] :
      DEFAULT_COLOR;
}

/**
 * Converts spec from
 * {
 *   ...
 *   encodings: {
 *     foo: 'bar',
 *   },
 *   ...
 * }
 *
 * to
 * {
 *   ...
 *   getFoo: d => d.bar,
 *   ...
 * }
 */
function parseEncodings(spec) {
  const encodings = spec.encodings;
  if (!encodings) return;

  delete spec.encodings;

  Object.keys(encodings).forEach(key => {
    spec[makeGetterName(key)] = d => d[encodings[key]];
  });
}


/**
 * Takes a string 'foo' and returns 'getFoo'.
 */
function makeGetterName(key) {
  if (typeof key != 'string' || key.length == 0)
    throw new Error('Encodings must be strings');

  return 'get' + key.charAt(0).toUpperCase() + key.slice(1);
}


const Defaults = {
  ArcLayer: {
    getSourceColor: getSourceColorFromSourceColorRGBAColumns,
    getTargetColor: getTargetColorFromTargetColorRGBAColumns,
    getSourcePosition: getPositionFromLatLonColumns,
    getTargetPosition: getEndPositionFromLatLonColumn,
  },

  // GeoJsonLayer: TODO. Data needs to be sent as JSON, not dataframe.

  GridLayer: {
    getPosition: getPositionFromLatLonColumns,
  },

  HexagonLayer: {
    getPosition: getPositionFromLatLonColumns,
  },

  LineLayer: {
    getSourcePosition: getPositionFromLatLonColumns,
    getTargetPosition: getEndPositionFromLatLonColumn,
  },

  // IconLayer: TODO
  // PathLayer: TODO

  PointCloudLayer: {
    getColor: getColorFromColorRGBAColumns,
    getPosition: getPositionFromPositionXYZColumns,
    getNormal: getNormalFromNormalXYZColumns,
  },

  // PolygonLayer: TODO

  ScatterplotLayer: {
    getColor: getColorFromColorRGBAColumns,
    getPosition: getPositionFromLatLonColumns,
    getRadius: d => fallback(d.radius, 100),
  },

  ScreenGridLayer: {
    getPosition: getPositionFromLatLonColumns,
    getWeight: d => d.weight,
  },

  TextLayer: {
    getColor: getColorFromColorRGBAColumns,
    getPixelOffset:
        d => [fallback(d.pixelOffsetX, 0), fallback(d.pixelOffsetY, 0)],
    getPosition: getPositionFromLatLonColumns,
  },
};


export default DeckGlMap;
