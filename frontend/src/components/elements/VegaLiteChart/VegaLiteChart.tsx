/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Map as ImmutableMap} from 'immutable'
import { StreamlitElement, StProps, StState } from 'components/shared/StreamlitElement/'
import { tableGetRowsAndCols, indexGet, tableGet } from 'lib/dataFrameProto'
import { logMessage } from 'lib/log'

import * as vega from 'vega'
import * as vl from 'vega-lite'
import tooltip from 'vega-tooltip'

import './VegaLiteChart.scss'


const MagicFields = {
  DATAFRAME_INDEX: '(index)',
}


/** Types of dataframe-indices that are supported as x axes. */
const SUPPORTED_INDEX_TYPES = new Set([
  'datetimeIndex',
  'float_64Index',
  'int_64Index',
  'rangeIndex',
  'timedeltaIndex',
  'uint_64Index',
])

interface Props extends StProps {
  element: ImmutableMap<string, any>;
}


class VegaLiteChart extends StreamlitElement<Props, StState> {
  /**
   * The Vega view object
   */
  private vegaView: vega.View | undefined

  /**
   * The default data name to add to.
   */
  private defaultDataName = 'source'

  /**
   * The html element we attach the Vega view to.
   */
  private element: HTMLDivElement | null = null

  public safeRender(): JSX.Element {
    return (
      // Create the container Vega draws inside.
      <div className="stVegaLiteChart" ref={c => this.element = c} />)
  }

  public safeComponentDidMount(): void {
    this.createView()
  }

  public safeComponentDidUpdate(): void {
    this.createView()
  }

  /**
   * Detect whether rows were appended to dataframe and, if so, pretend this
   * component did not update and instead use Vega Views's own .insert() method,
   * which is faster.
   */
  public safeShouldComponentUpdate(newProps: Props, newState: StState): boolean {
    const data0 = this.props.element.get('data')
    const data1 = newProps.element.get('data')

    if (!data0 || !data1) { return true }
    if (!data0.get('data') || !data1.get('data')) { return true }

    const [numRows0, numCols0] = tableGetRowsAndCols(data0.get('data'))
    const [numRows1, numCols1] = tableGetRowsAndCols(data1.get('data'))

    const spec0 = this.props.element.get('spec')
    const spec1 = newProps.element.get('spec')

    const dataChanged = data0 !== data1
    const specChanged = spec0 !== spec1

    // If spec changed, doesn't matter whether data changed. Redraw
    // whole chart.
    if (specChanged) {
      return true
    }

    // Just a small optimization: if spec and data are all the same,
    // we know there's no need to redraw anything and can quit here.
    if (!dataChanged) {
      return false
    }

    // Check if dataframes have same "shape" but the new one has more rows.
    if (numCols0 === numCols1 && numRows0 <= numRows1 &&
        // Check if the new dataframe looks like it's a superset of the old one.
        // (this is a very light check, and not guaranteed to be right!)
        data0[0] === data1[0] && data0[numRows0 - 1] === data1[numRows0 - 1]) {

      if (numRows0 < numRows1) {
        this.addRows(data1, numRows0)
        // Since we're handling the redraw using VegaLite's addRows(), tell
        // React not to redraw the chart.
        return false
      }
    }

    // Data changed and we did not use addRows() for it, so tell React to redraw
    // the chart.
    return true
  }

  /**
   * Uses Vega View's insert() method to add more data to the chart.
   * See https://vega.github.io/vega/docs/api/view/
   */
  private addRows(data: any, startIndex: number): void {
    if (!this.vegaView) {
      throw new Error('Chart has not been drawn yet')
    }
    const rows = getDataArray(data, startIndex)
    // TODO: Support adding rows to datasets with different names.
    this.vegaView.insert(this.defaultDataName, rows)
    this.vegaView.run()
  }

  private createView(): void {
    logMessage('Creating a new Vega view. We only should do this when the spec changes.')

    if (this.vegaView) {
      // Finalize the previous view so it can be garbage collected.
      this.vegaView.finalize()
    }

    const el = this.props.element

    const spec = JSON.parse(el.get('spec'))

    if (spec.datasets) {
      throw new Error('Datasets should not be passed as part of the spec')
    }

    if (spec.width === 0) {
      spec.width = this.props.width
    }

    const datasets = getDataSets(el)

    if (datasets) {
      if (!spec.data) {
        throw new Error(
          'Must specify "data" field when using "dataset"')
      }
      spec.datasets = datasets
    }

    const vgSpec = vl.compile(spec).spec

    // Heuristic to determine the default dataset name.
    const datasetNames = datasets ? Object.keys(datasets) : []
    if (datasetNames.length === 1) {
      this.defaultDataName = datasetNames[0]
    } else if (datasetNames.length === 0 && vgSpec.data) {
      this.defaultDataName = vgSpec.data[0].name
    }

    const runtime = vega.parse(vgSpec)
    const view = new vega.View(runtime, {
      logLevel:  vega.Warn,
      render: 'canvas',
      container: this.element,
    })

    const dataObj = getInlineData(el)
    if (dataObj) {
      view.insert(this.defaultDataName, dataObj)
    }

    tooltip(view)

    this.vegaView = view
    view.run()
  }
}


function getInlineData(el: ImmutableMap<string, any>): {[field: string]: any}[] | null {
  const dataProto = el.get('data')

  if (!dataProto) {
    return null
  }

  return getDataArray(dataProto)
}


function getDataSets(el: ImmutableMap<string, any>): {[dataset: string]: any[] } | null {
  if (!el.get('datasets') || el.get('datasets').isEmpty()) {
    return null
  }

  const datasets: {[dataset: string]: any[]} = {}

  el.get('datasets').forEach((x: any, i: number) => {
    if (!x) { return }
    datasets[x.get('name')] = getDataArray(x.get('data'))
  })

  return datasets
}


function getDataArray(dataProto: any, startIndex = 0): {[field: string]: any}[] {
  if (!dataProto.get('data')) { return [] }
  if (!dataProto.get('index')) { return [] }
  if (!dataProto.get('columns')) { return [] }

  const dataArr = []
  const [rows, cols] = tableGetRowsAndCols(dataProto.get('data'))

  const indexType = dataProto.get('index').get('type')
  const hasSupportedIndex = SUPPORTED_INDEX_TYPES.has(indexType)

  for (let rowIndex = startIndex; rowIndex < rows; rowIndex++) {
    let row: {[field: string]: any} = {}

    if (hasSupportedIndex) {
      row[MagicFields.DATAFRAME_INDEX] =
          indexGet(dataProto.get('index'), 0, rowIndex)
    }

    for (let colIndex = 0; colIndex < cols; colIndex++) {
      row[indexGet(dataProto.get('columns'), 0, colIndex)] =
          tableGet(dataProto.get('data'), colIndex, rowIndex)
    }

    dataArr.push(row)
  }

  return dataArr
}


export default VegaLiteChart
