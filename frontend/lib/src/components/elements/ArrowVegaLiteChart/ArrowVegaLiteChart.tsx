/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { PureComponent } from "react"

import { withTheme } from "@emotion/react"
import embed from "vega-embed"
import * as vega from "vega"
import { SignalValue } from "vega"
import { expressionInterpreter } from "vega-interpreter"

import {
  WidgetInfo,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"
import { debounce, notNullOrUndefined } from "@streamlit/lib/src/util/utils"
import { logMessage } from "@streamlit/lib/src/util/log"
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"
import { ensureError } from "@streamlit/lib/src/util/ErrorHandling"
import { Quiver } from "@streamlit/lib/src/dataframes/Quiver"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form"

import "@streamlit/lib/src/assets/css/vega-embed.css"
import "@streamlit/lib/src/assets/css/vega-tooltip.css"

import {
  getDataSets,
  VegaLiteChartElement,
  getDataArray,
  dataIsAnAppendOfPrev,
  getDataArrays,
  getInlineData,
} from "./arrowUtils"
import { applyStreamlitTheme, applyThemeDefaults } from "./CustomTheme"
import { StyledVegaLiteChartContainer } from "./styled-components"

const DEFAULT_DATA_NAME = "source"

/**
 * Fix bug where Vega Lite was vertically-cropping the x-axis in some cases.
 * For example, in e2e/scripts/add_rows.py
 */
const BOTTOM_PADDING = 20

/**
 * Debounce time for triggering a widget state update
 * This prevents to rapid updates to the widget state.
 */
const DEBOUNCE_TIME_MS = 150

// This is the state that is sent to the backend
// This needs to be the same structure that is also defined
// in the Python code.
export interface VegaLiteState {
  select: Record<string, any>
}

interface Props {
  element: VegaLiteChartElement
  theme: EmotionTheme
  width: number
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

export interface PropsWithFullScreen extends Props {
  height?: number
  isFullScreen: boolean
}

interface State {
  error?: Error
  selections: Record<string, any>
}

export class ArrowVegaLiteChart extends PureComponent<
  PropsWithFullScreen,
  State
> {
  /**
   * The Vega view object
   */
  private vegaView?: vega.View

  /**
   * Finalizer for the embedded vega object. Must be called to dispose
   * of the vegaView when it's no longer used.
   */
  private vegaFinalizer?: () => void

  /**
   * The default data name to add to.
   */
  private defaultDataName = DEFAULT_DATA_NAME

  /**
   * The html element we attach the Vega view to.
   */
  private element: HTMLDivElement | null = null

  /**
   * Helper to manage form clear listeners.
   * This is used to reset the selection state when the form is cleared.
   */
  private readonly formClearHelper = new FormClearHelper()

  readonly state = {
    error: undefined,
    selections: {} as Record<string, any>,
  }

  public async componentDidMount(): Promise<void> {
    try {
      console.log("mounting")
      await this.createView()
    } catch (e) {
      console.log("componentDidMount error", e)
      const error = ensureError(e)
      this.setState({ error })
    }
  }

  public componentWillUnmount(): void {
    console.log("unmounting")
    // TODO(lukasmasuch): This is probably not needed anymore, or?
    // If the element ID is provide (e.g. with selections activated)
    // store the current chart state in the widget manager so that it
    // can be used for restoring the state when the component is re-mounted.
    // if (this.props.element?.id) {
    //   const viewState = this.vegaView?.getState({
    //     // There are also `signals` data, but I believe its
    //     // not relevant for restoring the selection state.
    //     data: (_name?: string, _operator?: any) => {
    //       return true
    //     },
    //   })

    //   if (notNullOrUndefined(viewState)) {
    //     console.log("Store state", viewState)
    //     this.props.widgetMgr?.setElementState(
    //       this.props.element.id,
    //       "viewState",
    //       viewState
    //     )
    //   }
    // }

    this.finalizeView()
  }

  /**
   * Finalize the view so it can be garbage collected. This should be done
   * when a new view is created, and when the component unmounts.
   */
  private finalizeView = (): any => {
    if (this.vegaFinalizer) {
      this.vegaFinalizer()
    }
    this.vegaFinalizer = undefined
    this.vegaView = undefined
  }

  /**
   * Extracts and returns the names of selection parameters from a given Vega-Lite chart specification.
   * This method is specifically designed for use with Vega-Lite version 5 specifications.
   *
   * It parses the 'params' property of the specification, if present, to retrieve the names
   * of all selection parameters (parameters with a 'select' property).
   *
   * For more details on selection in Vega-Lite, visit:
   * https://vega.github.io/vega-lite/docs/selection.html
   *
   * @param spec {any} - The Vega-Lite chart specification object, expected to conform to the
   * structure utilized by Vega-Lite 5.
   * @returns {string[]} An array of strings, where each string is the name of a selector from
   * the chart's specification. Returns an empty array if no selectors are found.
   *
   * Example:
   * ```
   * const vegaLiteSpec = {
   *   params: [
   *     { name: 'brush', select: 'interval' },
   *     { name: 'click', select: 'point', toggle: 'event.shiftKey' }
   *   ]
   * };
   * const selectors = getSelectorsFromSpec(vegaLiteSpec);
   * console.log(selectors); // Output: ['brush', 'click']
   * ```
   */
  public getSelectorsFromSpec(spec: any): string[] {
    if ("params" in spec) {
      const select: any[] = []
      spec.params.forEach((item: any) => {
        // Only parameters with a select property are relevant
        // selection parameters for us. Also, its required
        // that the parameter have a name. This is required in the vega
        // lite spec, but we check anyways to be extra safe.
        if ("select" in item && "name" in item && item.name) {
          select.push(item.name)
        }
      })
      return select
    }
    return []
  }

  public async componentDidUpdate(
    prevProps: PropsWithFullScreen
  ): Promise<void> {
    const { element: prevElement, theme: prevTheme } = prevProps
    const { element, theme } = this.props

    const prevSpec = prevElement.spec
    const { spec } = element

    if (
      !this.vegaView ||
      prevSpec !== spec ||
      prevTheme !== theme ||
      prevProps.width !== this.props.width ||
      prevProps.height !== this.props.height ||
      prevProps.element.vegaLiteTheme !== this.props.element.vegaLiteTheme ||
      prevProps.element.isSelectEnabled !== this.props.element.isSelectEnabled
    ) {
      logMessage("Vega spec changed.")
      try {
        await this.createView()
      } catch (e) {
        console.log("Error in componentDidUpdate", e)
        const error = ensureError(e)

        this.setState({ error })
      }
      return
    }

    const prevData = prevElement.data
    const { data } = element

    if (prevData || data) {
      this.updateData(this.defaultDataName, prevData, data)
    }

    const prevDataSets = getDataSets(prevElement) || {}
    const dataSets = getDataSets(element) || {}

    for (const [name, dataset] of Object.entries(dataSets)) {
      const datasetName = name || this.defaultDataName
      const prevDataset = prevDataSets[datasetName]

      this.updateData(datasetName, prevDataset, dataset)
    }

    // Remove all datasets that are in the previous but not the current datasets.
    for (const name of Object.keys(prevDataSets)) {
      if (!dataSets.hasOwnProperty(name) && name !== this.defaultDataName) {
        this.updateData(name, null, null)
      }
    }

    this.vegaView.resize().runAsync()
  }

  public generateSpec = (): any => {
    const { element: el, theme, isFullScreen, width, height } = this.props
    const spec = JSON.parse(el.spec)
    console.log("generateSpec", JSON.parse(el.spec))
    const { useContainerWidth } = el
    if (el.vegaLiteTheme === "streamlit") {
      spec.config = applyStreamlitTheme(spec.config, theme)
    } else if (spec.usermeta?.embedOptions?.theme === "streamlit") {
      spec.config = applyStreamlitTheme(spec.config, theme)
      // Remove the theme from the usermeta so it doesn't get picked up by vega embed.
      spec.usermeta.embedOptions.theme = undefined
    } else {
      // Apply minor theming improvements to work better with Streamlit
      spec.config = applyThemeDefaults(spec.config, theme)
    }

    // const selectionParams = this.getSelectorsFromSpec(spec)

    // const storedValue = this.props.widgetMgr.getStringValue(el)
    // console.log("storedValue", storedValue)
    // if (storedValue !== undefined) {
    //   const parsedStoredValue = JSON.parse(storedValue)
    //   if (parsedStoredValue.select) {
    //     console.log("parsedStoredValue", parsedStoredValue)
    //     selectionParams.forEach(selector => {
    //       spec.params.forEach((param: any) => {
    //         if (param.name && param.name === selector) {
    //           // initialize interval and point values if they exist to maintain state
    //           // https://vega.github.io/vega-lite/docs/param-value.html
    //           if (param.select.type && param.select.type === "point") {
    //             try {
    //               const values = parsedStoredValue.select[selector]
    //               param.select.fields = Object.keys(values[0])
    //               param.value = values
    //               console.log("set initial value", param)
    //             } catch (e) {
    //               logMessage(e)
    //             }
    //           } else if (param.select.type === "interval") {
    //             try {
    //               const values = parsedStoredValue.select[selector]
    //               param.value = values
    //               console.log("set initial value", param)
    //             } catch (e) {
    //               logMessage(e)
    //             }
    //           }
    //         }
    //       })
    //     })
    //   }
    // }

    if (isFullScreen) {
      spec.width = width
      spec.height = height

      if ("vconcat" in spec) {
        spec.vconcat.forEach((child: any) => {
          child.width = width
        })
      }
    } else if (useContainerWidth) {
      spec.width = width

      if ("vconcat" in spec) {
        spec.vconcat.forEach((child: any) => {
          child.width = width
        })
      }
    }

    if (!spec.padding) {
      spec.padding = {}
    }

    if (spec.padding.bottom == null) {
      spec.padding.bottom = BOTTOM_PADDING
    }

    if (spec.datasets) {
      throw new Error("Datasets should not be passed as part of the spec")
    }

    // TODO(lukasmasuch): how can we correctly handle encodings for various chart types?
    // attempt to add encodings from chart to selection parameter in order to get point interval
    // This is to ensure that we can consistently recreate state in fullscreen / non fullscreen mode
    // https://github.com/altair-viz/altair/issues/3285#issuecomment-1858860696
    if (el.isSelectEnabled && "params" in spec) {
      if ("encoding" in spec) {
        spec.params.forEach((param: any) => {
          if (!("select" in param)) {
            // We are only interested in transforming select parameters.
            return
          }

          console.log("ITEM", param.select)
          if (["interval", "point"].includes(param.select)) {
            console.log("Transform", param.select)
            // The select object can be either a single string specifying
            // "interval" or "point" or an object that can contain additional
            // properties as defined here: https://vega.github.io/vega-lite/docs/selection.html
            // To make our life easier, we convert the string to the full object specification.
            param.select = {
              type: param.select,
            }
          }
          console.log(param.select.type)
          if (!("type" in param.select)) {
            // The type property is required in the spec.
            // But we check anyways and skip all parameters that don't have it.
            return
          }

          if (
            param.select.type === "point" &&
            param.select.encodings === undefined
          ) {
            // TODO(lukasmasuch): Does this work always?
            param.select.encodings = Object.keys(spec.encoding)
          }
        })
      }
      // TODO(lukasmasuch): There are other types of concationations:
      // const concatenationKeys = ["hconcat", "vconcat", "layer"]

      // concatenationKeys.forEach(key => {
      //   if (key in spec) {
      //     try {
      //       spec.params.forEach((param: any) => {
      //         if (
      //           "select" in param &&
      //           "type" in param.select &&
      //           param.select.type === "point" &&
      //           param.select.encodings === undefined
      //         ) {
      //           param.select.encodings = Object.keys(spec[key][0].encoding)
      //         }
      //       })
      //     } catch (e) {
      //       logMessage(e)
      //     }
      //   }
      // })
    }
    console.log("Generated spec", spec)
    return spec
  }

  /**
   * Update the dataset in the Vega view. This method tried to minimize changes
   * by automatically creating and applying diffs.
   *
   * @param name The name of the dataset.
   * @param prevData The dataset before the update.
   * @param data The dataset to use for the update.
   */
  private updateData(
    name: string,
    prevData: Quiver | null,
    data: Quiver | null
  ): void {
    if (!this.vegaView) {
      throw new Error("Chart has not been drawn yet")
    }

    console.log("Update data", name)

    if (!data || data.data.numRows === 0) {
      // The new data is empty, so we remove the dataset from the chart view.
      const view = this.vegaView as any
      // TODO(lukasmasuch): Can we replace this with this.vegaView.data(name)
      // eslint-disable-next-line no-underscore-dangle
      const viewHasDataWithName = view._runtime.data.hasOwnProperty(name)
      if (viewHasDataWithName) {
        this.vegaView.remove(name, vega.truthy)
      }
      return
    }

    if (!prevData || prevData.data.numRows === 0) {
      // The previous data was empty, so we just insert the new data.
      this.vegaView.insert(name, getDataArray(data))
      return
    }

    const { dataRows: prevNumRows, dataColumns: prevNumCols } =
      prevData.dimensions
    const { dataRows: numRows, dataColumns: numCols } = data.dimensions

    // Check if dataframes have same "shape" but the new one has more rows.
    if (
      dataIsAnAppendOfPrev(
        prevData,
        prevNumRows,
        prevNumCols,
        data,
        numRows,
        numCols
      )
    ) {
      if (prevNumRows < numRows) {
        // Insert the new rows.
        this.vegaView.insert(name, getDataArray(data, prevNumRows))
      }
    } else {
      // Clean the dataset and insert from scratch.
      this.vegaView.data(name, getDataArray(data))
      logMessage(
        `Had to clear the ${name} dataset before inserting data through Vega view.`
      )
    }
  }

  /**
   * Configure the selections for this chart if the chart has selections enabled.
   *
   * @param spec The Vega-Lite specification for the chart.
   */
  private maybeConfigureSelections = (spec: any): void => {
    if (this.vegaView === undefined) {
      // This check is mainly to make the type checker happy.
      // this.vegaView is guaranteed to be defined here.
      return
    }

    const { widgetMgr, element } = this.props

    if (!element?.id || !element.isSelectEnabled) {
      // To configure selections, it needs to be activated and
      // the element ID must be set.
      return
    }

    // Try to load the previous state of the chart from the element state.
    // This is useful to restore the selection state when the component is re-mounted
    // or when its put into fullscreen mode.
    const viewState = this.props.widgetMgr?.getElementState(
      this.props.element.id,
      "viewState"
    )
    if (notNullOrUndefined(viewState)) {
      console.log("Load state", viewState)
      try {
        this.vegaView = this.vegaView.setState(viewState)
      } catch (e) {
        console.log("ERRRRRRROR")
      }
    }

    // Extract all relevant named selection parameters from the vega-lite spec.
    const selectionParams = this.getSelectorsFromSpec(spec)
    const selectionParamsStateNames = selectionParams.map(
      (item, _index) => `${item}_store`
    )

    // Add listeners for all selection events:
    // Find out more here: https://vega.github.io/vega/docs/api/view/#view_addSignalListener
    selectionParams.forEach((item, _index) => {
      this.vegaView?.addSignalListener(
        item,
        debounce(DEBOUNCE_TIME_MS, (name: string, value: SignalValue) => {
          console.log("signal", name, value)

          // Store the current chart state in the widget manager so that it
          // can be used for restoring the state when the component unmounted and
          // created again. This can happen when elements are added before it within
          // the delta path.
          console.log("STATE", this.vegaView?.getState())
          const viewState = this.vegaView?.getState({
            // There are also `signals` data, but I believe its
            // not relevant for restoring the selection state.
            data: (_name?: string, _operator?: any) => {
              return _name ? selectionParamsStateNames.includes(_name) : false
            },
            recurse: false,
          })

          if (notNullOrUndefined(viewState)) {
            console.log("Store state", viewState)
            this.props.widgetMgr?.setElementState(
              this.props.element.id,
              "viewState",
              viewState
            )
          }

          // If selection encodings are correctly specified, vega-lite will return
          // a list of selected points within the vlPoint.or property:
          // https://github.com/vega/altair/blob/f1b4e2c84da2fba220022c8a285cc8280f824ed8/altair/utils/selection.py#L50
          // We want to just return this list of points instead of the entire object.
          let processedSelection = value
          if ("vlPoint" in value && "or" in value.vlPoint) {
            processedSelection = value.vlPoint.or
          }

          // Update the component-internal selection state
          const updatedSelections = {
            select: {
              ...(this.state.selections?.select || {}),
              [name]: processedSelection || {},
            } as VegaLiteState,
          }
          this.setState({
            selections: updatedSelections,
          })

          // Update the widget state if the selection state has changed
          // compared to the last update.
          const newWidgetState = JSON.stringify(updatedSelections)
          const currentWidgetState = widgetMgr.getStringValue(
            this.props.element as WidgetInfo
          )

          if (
            currentWidgetState === undefined ||
            currentWidgetState !== newWidgetState
          ) {
            this.props.widgetMgr?.setStringValue(
              this.props.element as WidgetInfo,
              newWidgetState,
              {
                fromUi: true,
              },
              this.props.fragmentId
            )
          }
        })
      )
    })

    /**
     * Callback to reset the selection and update the widget state.
     * This might also send the empty selection state to the backend.
     */
    const reset = (): void => {
      console.log("reset")
      if (Object.keys(this.state.selections).length === 0) {
        // Nothing is selected, so we don't need to do anything.
        return
      }

      this.setState({
        selections: {},
      })

      const emptySelectionState: VegaLiteState = {
        // TODO(lukasmasuch): We might actually want to have
        //  this initialized with empty selections for all selectors.
        select: {},
      }

      this.props.widgetMgr?.setStringValue(
        this.props.element as WidgetInfo,
        JSON.stringify(emptySelectionState),
        {
          fromUi: true,
        },
        this.props.fragmentId
      )
    }

    // Add the form clear listener if we are in a form (formId defined)
    if (this.props.element.formId) {
      this.formClearHelper.manageFormClearListener(
        this.props.widgetMgr,
        this.props.element.formId,
        reset
      )
    }
  }

  /**
   * Create a new Vega view and add the data.
   */
  private async createView(): Promise<void> {
    logMessage("Creating a new Vega view.")
    console.log("Create view")
    if (!this.element) {
      throw Error("Element missing.")
    }

    // Finalize the previous view so it can be garbage collected.
    this.finalizeView()

    const { element } = this.props
    const spec = this.generateSpec()
    const options = {
      // Adds interpreter support for Vega expressions that is compliant with CSP
      ast: true,
      expr: expressionInterpreter,

      // Disable default styles so that vega doesn't inject <style> tags in the
      // DOM. We set these styles manually for finer control over them and to
      // avoid inlining styles.
      tooltip: { disableDefaultStyle: true },
      defaultStyle: false,
      forceActionsMenu: true,
    }

    const { vgSpec, view, finalize } = await embed(this.element, spec, options)

    this.vegaView = view

    this.maybeConfigureSelections(spec)

    this.vegaFinalizer = finalize

    const datasets = getDataArrays(element)

    // Heuristic to determine the default dataset name.
    const datasetNames = datasets ? Object.keys(datasets) : []
    if (datasetNames.length === 1) {
      const [datasetName] = datasetNames
      this.defaultDataName = datasetName
    } else if (datasetNames.length === 0 && vgSpec.data) {
      this.defaultDataName = DEFAULT_DATA_NAME
    }

    const dataObj = getInlineData(element)
    if (dataObj) {
      view.insert(this.defaultDataName, dataObj)
    }
    if (datasets) {
      for (const [name, data] of Object.entries(datasets)) {
        view.insert(name, data)
      }
    }

    await view.runAsync()

    // Fix bug where the "..." menu button overlaps with charts where width is
    // set to -1 on first load.
    this.vegaView.resize().runAsync()
  }

  public render(): JSX.Element {
    if (this.state.error) {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw this.state.error
    }
    console.log("render")

    return (
      // Create the container Vega draws inside.
      <StyledVegaLiteChartContainer
        data-testid="stArrowVegaLiteChart"
        useContainerWidth={this.props.element.useContainerWidth}
        isFullScreen={this.props.isFullScreen}
        ref={c => {
          this.element = c
        }}
      />
    )
  }
}

export default withTheme(withFullScreenWrapper(ArrowVegaLiteChart))
