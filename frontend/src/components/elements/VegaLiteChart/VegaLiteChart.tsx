/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Map as ImmutableMap} from 'immutable'
import {StProps, StState, PureStreamlitElement} from 'components/shared/StreamlitElement/'
import {tableGetRowsAndCols, indexGet, tableGet} from 'lib/dataFrameProto'
import {logMessage} from 'lib/log'

import * as vega from 'vega'
import * as vl from 'vega-lite'
import tooltip from 'vega-tooltip'

import './VegaLiteChart.scss'


const MagicFields = {
  DATAFRAME_INDEX: '(index)',
}


const DEFAULT_DATA_NAME = 'source'


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


class VegaLiteChart extends PureStreamlitElement<Props, StState> {
  /**
   * The Vega view object
   */
  private vegaView: vega.View | undefined

  /**
   * The default data name to add to.
   */
  private defaultDataName = DEFAULT_DATA_NAME

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

  public safeComponentDidUpdate(prevProps: Props): void {
    // TODO: Don't create a new view just because the width changed.
    // Instead, we should set the `width` signal.
    if (prevProps.width !== this.props.width) {
      this.createView()
      return
    }

    const prevElement = prevProps.element
    const element = this.props.element

    const prevSpec = prevElement.get('spec')
    const spec = element.get('spec')

    if (!this.vegaView || prevSpec !== spec) {
      logMessage('Vega spec changed.')
      this.createView()
      return
    }

    const prevData = prevElement.get('data')
    const data = element.get('data')

    this.updateData(this.defaultDataName, prevData, data)

    const prevDataSets = getDataSets(prevElement) || {}
    const dataSets = getDataSets(element) || {}

    for (const [name, dataset] of Object.entries(dataSets)) {
      const datasetName = name ? name : this.defaultDataName
      const prevDataset = prevDataSets[datasetName]
      this.updateData(datasetName, prevDataset, dataset)
    }

    this.vegaView.resize().runAsync()
  }


  /**
   * Update the dataset in the Vega view. This method tried to minimize changes
   * by automatically creating and applying diffs.
   *
   * @param name The name of the dataset.
   * @param prevData The dataset before the update.
   * @param data The dataset at the current state.
   */
  private updateData(
      name: string, prevData: ImmutableMap<string, any>,
      data: ImmutableMap<string, any>): void {
    if (!this.vegaView) {
      throw new Error('Chart has not been drawn yet')
    }

    if (!data || !data.get('data')) {
      this.vegaView.remove(name, vega.truthy)
      return
    }

    if (!prevData || !prevData.get('data')) {
      this.vegaView.insert(name, getDataArray(data))
      return
    }

    const [prevNumRows, prevNumCols] = tableGetRowsAndCols(prevData.get('data'))
    const [numRows, numCols] = tableGetRowsAndCols(data.get('data'))

    // Check if dataframes have same "shape" but the new one has more rows.
    if (dataIsAnAppendOfPrev(prevData, prevNumRows, prevNumCols, data, numRows, numCols)) {
      if (prevNumRows < numRows) {
        this.vegaView.insert(name, getDataArray(data, prevNumRows))
      }
    } else {
      // Clean the dataset and insert from scratch.
      const cs = vega.changeset().remove(vega.truthy).insert(getDataArray(data))
      this.vegaView.change(name, cs)
      logMessage(`Had to clear the ${name} dataset before inserting data through Vega view.`)
    }
  }

  /**
   * Create a new Vega view and add the data.
   */
  private createView(): void {
    logMessage('Creating a new Vega view.')

    if (this.vegaView) {
      // Finalize the previous view so it can be garbage collected.
      this.vegaView.finalize()
    }

    const el = this.props.element

    const spec = JSON.parse(el.get('spec'))

    if (spec.datasets) {
      throw new Error('Datasets should not be passed as part of the spec')
    }

    const datasets = getDataArrays(el)

    if (spec.width === 0) {
      spec.width = this.props.width
    }

    const vgSpec = vl.compile(spec).spec

    // Heuristic to determine the default dataset name.
    const datasetNames = datasets ? Object.keys(datasets) : []
    if (datasetNames.length === 1) {
      this.defaultDataName = datasetNames[0]
    } else if (datasetNames.length === 0 && vgSpec.data) {
      this.defaultDataName = DEFAULT_DATA_NAME
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
    if (datasets) {
      for (const [name, data] of Object.entries(datasets)) {
        view.insert(name, data)
      }
    }

    tooltip(view)

    this.vegaView = view
    view.runAsync()
  }
}


function getInlineData(el: ImmutableMap<string, any>): {[field: string]: any}[] | null {
  const dataProto = el.get('data')

  if (!dataProto) {
    return null
  }

  return getDataArray(dataProto)
}


function getDataArrays(el: ImmutableMap<string, any>): {[dataset: string]: any[] } | null {
  const datasets = getDataSets(el)

  if (datasets == null) {
    return null
  }

  const datasetArrays: {[dataset: string]: any[]} = {}

  for (const [name, dataset] of Object.entries(datasets)) {
    datasetArrays[name] = getDataArray(dataset)
  }

  return datasetArrays
}


function getDataSets(el: ImmutableMap<string, any>): {[dataset: string]: any} | null {
  if (!el.get('datasets') || el.get('datasets').isEmpty()) {
    return null
  }

  const datasets: {[dataset: string]: any} = {}

  el.get('datasets').forEach((x: any, i: number) => {
    if (!x) { return }
    const name = x.get('hasName') ? x.get('name') : null
    datasets[name] = x.get('data')
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


/**
 * Checks if data looks like it's just prevData plus some appended rows.
 */
function dataIsAnAppendOfPrev(
    prevData: ImmutableMap<string, number>, prevNumCols: number, prevNumRows: number,
    data: ImmutableMap<string, number>, numRows: number, numCols: number) {
  // Check whether dataframes have the same shape.

  if (prevNumCols !== numCols) {
    return false
  }

  if (prevNumRows > numRows) {
    return false
  }

  const df0 = prevData.get('data')
  const df1 = data.get('data')
  const c = numCols - 1
  const r0 = prevNumRows - 1
  const r1 = numRows - 1

  // Check if the new dataframe looks like it's a superset of the old one.
  // (this is a very light check, and not guaranteed to be right!)
  if (tableGet(df0, c, 0) !== tableGet(df1, c, 0) ||
      tableGet(df0, c, r0) !== tableGet(df1, c, r1)) {
    return false
  }

  return true
}


export default VegaLiteChart
