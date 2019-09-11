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

import React from "react"
import PropTypes from "prop-types"
import DeckGL, {
  ArcLayer,
  GridLayer,
  HexagonLayer,
  LineLayer,
  PointCloudLayer,
  ScatterplotLayer,
  ScreenGridLayer,
  TextLayer,
} from "deck.gl"
import Immutable from "immutable"
import { StaticMap } from "react-map-gl"
import { dataFrameToArrayOfDicts } from "../../../lib/dataFrameProto"
import "mapbox-gl/dist/mapbox-gl.css"
import "./DeckGlChart.scss"

const MAPBOX_ACCESS_TOKEN =
  "pk.eyJ1IjoidGhpYWdvdCIsImEiOiJjamh3bm85NnkwMng4M3dydnNveWwzeWNzIn0.vCBDzNsEF2uFSFk2AM0WZQ"

class DeckGlChart extends React.PureComponent {
  constructor(props) {
    super(props)

    const specStr = this.props.element.get("spec")
    const spec = specStr ? JSON.parse(specStr) : {}
    const v = spec.viewport || {}

    this.initialViewState = {
      width: v.width || props.width,
      height: v.height || 500,
      longitude: v.longitude || 0,
      latitude: v.latitude || 0,
      pitch: v.pitch || 0,
      bearing: v.bearing || 0,
      zoom: v.zoom || 1,
    }

    this.mapStyle = getStyleUrl(v.mapStyle)

    this.fixHexLayerBug_bound = this.fixHexLayerBug.bind(this)
    this.state = { initialized: false }

    // HACK: Load layers a little after loading the map, to hack around a bug
    // where HexagonLayers were not drawing on first load but did load when the
    // script got re-executed.
    setTimeout(this.fixHexLayerBug_bound, 0)
  }

  fixHexLayerBug() {
    this.setState({ initialized: true })
  }

  render() {
    return (
      <div
        className="deckglchart stDeckGlChart"
        style={{
          height: this.initialViewState.height,
          width: this.initialViewState.width,
        }}
      >
        <DeckGL
          initialViewState={this.initialViewState}
          height={this.initialViewState.height}
          width={this.initialViewState.width}
          controller
          layers={this.state.initialized ? this.buildLayers() : []}
        >
          <StaticMap
            height={this.initialViewState.height}
            width={this.initialViewState.width}
            mapStyle={this.mapStyle}
            mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN}
          />
        </DeckGL>
      </div>
    )
  }

  buildLayers() {
    const layers = this.props.element.get("layers")
    return layers.map(layer => buildLayer(layer)).toArray()
  }
}

DeckGlChart.propTypes = {
  element: PropTypes.instanceOf(Immutable.Map).isRequired,
  width: PropTypes.number.isRequired,
}

/**
 * Defines default getters for columns.
 */
const Defaults = {
  ArcLayer: {
    getSourceColor: getSourceColorFromSourceColorRGBAColumns,
    getTargetColor: getTargetColorFromTargetColorRGBAColumns,
    getSourcePosition: getPositionFromLatLonColumns,
    getTargetPosition: getTargetPositionFromLatLonColumn,
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
    getTargetPosition: getTargetPositionFromLatLonColumn,
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
    getPixelOffset: d => [
      fallback(d.pixelOffsetX, 0),
      fallback(d.pixelOffsetY, 0),
    ],
    getPosition: getPositionFromLatLonColumns,
    getAlignmentBaseline: "bottom",
  },
}

function buildLayer(layer) {
  const data = dataFrameToArrayOfDicts(layer.get("data"))
  const spec = JSON.parse(layer.get("spec"))

  const type = spec.type ? spec.type.toLowerCase() : ""
  delete spec.type

  parseGetters(type, spec)

  switch (type) {
    case "arclayer":
      return new ArcLayer({
        data,
        ...Defaults.ArcLayer,
        ...spec,
      })

    case "gridlayer":
      return new GridLayer({
        data,
        ...Defaults.GridLayer,
        ...spec,
      })

    case "hexagonlayer":
      return new HexagonLayer({
        data,
        ...Defaults.HexagonLayer,
        ...spec,
      })

    case "linelayer":
      return new LineLayer({
        data,
        ...Defaults.LineLayer,
        ...spec,
      })

    case "pointcloudlayer":
      return new PointCloudLayer({
        data,
        ...Defaults.PointCloudLayer,
        ...spec,
      })

    case "scatterplotlayer":
      return new ScatterplotLayer({
        data,
        ...Defaults.ScatterplotLayer,
        ...spec,
      })

    case "screengridlayer":
      return new ScreenGridLayer({
        data,
        ...Defaults.ScreenGridLayer,
        ...spec,
      })

    case "textlayer":
      return new TextLayer({
        data,
        ...Defaults.TextLayer,
        ...spec,
      })

    default:
      throw new Error(`Unsupported layer type "${type}"`)
  }
}

// Set of DeckGL Layers that take a getPosition argument. We'll allow users to
// specify position columns via getLatitude and getLongitude instead.
const POSITION_LAYER_TYPES = new Set([
  "gridlayer",
  "hexagonlayer",
  "scatterplotlayer",
  "screengridlayer",
  "textlayer",
])

// Set of DeckGL Layers that take a getSourcePosition/getTargetPosition
// arguments.  We'll allow users to specify position columns via
// getLatitude/getTargetLatitude and getLongitude/getTargetLongitude instead.
const SOURCE_TARGET_POSITION_LAYER_TYPES = new Set(["arclayer", "linelayer"])

/**
 * Take a short "map style" string and convert to the full URL for the style.
 * (And it only does this if the input string is not already a URL.)
 *
 * See https://www.mapbox.com/maps/ or https://www.mapbox.com/mapbox-gl-js/api/
 */
function getStyleUrl(styleStr = "light-v9") {
  if (
    styleStr.startsWith("http://") ||
    styleStr.startsWith("https://") ||
    styleStr.startsWith("mapbox://")
  ) {
    return styleStr
  }

  return `mapbox://styles/mapbox/${styleStr}`
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
function fallback(...args) {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] != null) {
      return args[i]
    }
  }
  return null
}

/* Define a bunch of getters */

function getPositionFromLatLonColumns(d) {
  return [fallback(d.longitude, d.lon), fallback(d.latitude, d.lat)]
}

function getTargetPositionFromLatLonColumn(d) {
  return [fallback(d.longitude2, d.lon2), fallback(d.latitude2, d.lat2)]
}

function getPositionFromPositionXYZColumns(d) {
  return [
    fallback(d.longitude, d.lon, d.positionX, d.x),
    fallback(d.latitude, d.lat, d.positionY, d.y),
    fallback(d.latitude, d.lat, d.positionZ, d.z),
  ]
}

function getNormalFromNormalXYZColumns(d) {
  return [d.normalX, d.normalY, d.normalZ]
}

const DEFAULT_COLOR = [200, 30, 0, 160]

function getColorFromColorRGBAColumns(d) {
  return d.colorR && d.colorG && d.colorB
    ? [d.colorR, d.colorG, d.colorB, d.colorA == null ? 255 : d.colorA]
    : DEFAULT_COLOR
}

function getSourceColorFromSourceColorRGBAColumns(d) {
  return d.colorR && d.colorG && d.colorB
    ? [d.colorR, d.colorG, d.colorB, d.colorA == null ? 255 : d.colorA]
    : DEFAULT_COLOR
}

function getTargetColorFromTargetColorRGBAColumns(d) {
  return d.targetColorR && d.targetColorG && d.targetColorB
    ? [
        d.targetColorR,
        d.targetColorG,
        d.targetColorB,
        d.targetColorA == null ? 255 : d.targetColorA,
      ]
    : DEFAULT_COLOR
}

function parseGetters(type, spec) {
  // If this is a layer that accepts a getPosition argument, build that
  // argument from getLatiude and getLongitude.
  if (
    POSITION_LAYER_TYPES.has(type) &&
    spec.getLatitude &&
    spec.getLongitude
  ) {
    const latField = spec.getLatitude
    const lonField = spec.getLongitude
    spec.getPosition = d => [d[lonField], d[latField]]
  }

  // Same as the above, but for getSourcePosition/getTargetPosition.
  if (
    SOURCE_TARGET_POSITION_LAYER_TYPES.has(type) &&
    spec.getLatitude &&
    spec.getLongitude &&
    spec.getTargetLatitude &&
    spec.getTargetLongitude
  ) {
    const latField = spec.getLatitude
    const lonField = spec.getLongitude
    const latField2 = spec.getTargetLatitude
    const lonField2 = spec.getTargetLongitude
    spec.getSourcePosition = d => [d[lonField], d[latField]]
    spec.getTargetPosition = d => [d[lonField2], d[latField2]]
  }

  Object.keys(spec).forEach(key => {
    if (!key.startsWith("get")) {
      return
    }
    const v = spec[key]
    spec[key] =
      typeof v === "function"
        ? v // Leave functions untouched.
        : typeof v === "string"
        ? d => d[v] // Make getters from strings.
        : () => v // Make constant function otherwise.
  })
}

export default DeckGlChart
