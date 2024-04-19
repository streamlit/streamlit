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

import React, {
  ReactElement,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react"

import { useTheme } from "@emotion/react"
import Plot, { Figure as PlotlyFigureType } from "react-plotly.js"

import { EmotionTheme } from "@streamlit/lib/src/theme"
import { PlotlyChart as PlotlyChartProto } from "@streamlit/lib/src/proto"
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  keysToSnakeCase,
  notNullOrUndefined,
} from "@streamlit/lib/src/util/utils"
import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form/FormClearHelper"

import {
  applyStreamlitTheme,
  layoutWithThemeDefaults,
  replaceTemporaryColors,
} from "./CustomTheme"

export interface PlotlyChartProps {
  width: number
  element: PlotlyChartProto
  height: number | undefined
  isFullScreen: boolean
  widgetMgr: WidgetStateManager
  disabled: boolean
  fragmentId?: string
}

export interface PlotlyIFrameProps {
  width: number
  height: number | undefined
  url: string
}

// Copied and Pasted from Plotly type def
export interface SelectionRange {
  x: number[]
  y: number[]
}

export interface Selection extends SelectionRange {
  xref: string
  yref: string
}

// Default height for Plotly charts
export const DEFAULT_HEIGHT = 450
// Minimum width for Plotly charts
const MIN_WIDTH = 150

/**
 * Parses an SVG path string into separate x and y coordinates.
 *
 * The function takes a single SVG path string as input. This path string should start with 'M'
 * (move to command), followed by pairs of x and y coordinates separated by commas, and optionally
 * end with 'Z' to close the path. Each pair of coordinates is separated by 'L' (line to command).
 *
 * Example Input:
 * "M4.016412414518674,8.071685352641575L4.020620725933719,7.8197516509841165Z"
 *
 * Example Output:
 * {
 *   x: [4.016412414518674, 4.020620725933719],
 *   y: [8.071685352641575, 7.8197516509841165]
 * }
 *
 * @param {string} pathData - The SVG path string to be parsed.
 * @returns {SelectionRange} An object containing two arrays: `x` for all x coordinates and `y` for all y coordinates.
 */
export function parseLassoPath(pathData: string): SelectionRange {
  if (pathData === "") {
    return {
      x: [],
      y: [],
    }
  }
  const points = pathData.replace("M", "").replace("Z", "").split("L")

  const x: number[] = []
  const y: number[] = []

  points.forEach(point => {
    const [xVal, yVal] = point.split(",").map(Number)
    x.push(xVal)
    y.push(yVal)
  })

  return { x, y }
}

/**
 * Parses a box selection object into separate x and y coordinates.
 *
 * The function takes a box selection object as input. This object should contain the following
 * fields: x0, x1, y0, y1. These fields represent the x and y coordinates of the box selection
 * in the plotly chart.
 *
 * Example Input:
 * {
 *   x0: 0.1,
 *   x1: 0.2,
 *   y0: 0.3,
 *   y1: 0.4
 * }
 *
 * Example Output:
 * {
 *   x: [0.1, 0.2],
 *   y: [0.3, 0.4]
 * }
 *
 * @param {Object} selection - The box selection object to be parsed.
 * @returns {SelectionRange} An object containing two arrays: `x` for all x coordinates and `y` for all y coordinates.
 */
export function parseBoxSelection(selection: any): SelectionRange {
  const hasRequiredFields =
    "x0" in selection &&
    "x1" in selection &&
    "y0" in selection &&
    "y1" in selection

  if (!hasRequiredFields) {
    return { x: [], y: [] }
  }

  const x: number[] = [selection.x0, selection.x1]
  const y: number[] = [selection.y0, selection.y1]
  return { x, y }
}

/**
 * Apply theming to the Plotly figure.
 *
 * @param plotlyFigure The Plotly figure to apply theming to
 * @param chartTheme The theme of the chart (streamlit or empty string)
 * @param theme The current theme of the app
 * @returns The Plotly figure with theming applied
 */
function applyTheming(
  plotlyFigure: PlotlyFigureType,
  chartTheme: string,
  theme: EmotionTheme
): PlotlyFigureType {
  const spec = JSON.parse(
    replaceTemporaryColors(JSON.stringify(plotlyFigure), theme, chartTheme)
  )
  if (chartTheme === "streamlit") {
    applyStreamlitTheme(spec, theme)
  } else {
    // Apply minor theming improvements to work better with Streamlit
    spec.layout = layoutWithThemeDefaults(spec.layout, theme)
  }
  return spec
}

/** Render a Plotly chart from a FigureProto */
function PlotlyFigure({
  element,
  width,
  height,
  isFullScreen,
  widgetMgr,
  disabled,
  fragmentId,
}: Readonly<PlotlyChartProps>): ReactElement {
  const theme: EmotionTheme = useTheme()

  // Load the initial figure spec from the element message
  const initialFigureSpec = useMemo<PlotlyFigureType>(() => {
    console.log("Update initial figure spec")
    if (!element.figure?.spec) {
      return {
        layout: {},
        data: [],
        frames: undefined,
      }
    }

    return JSON.parse(element.figure.spec)
  }, [element.id, element.figure?.spec])

  const [plotlyFigure, setPlotlyFigure] = useState<PlotlyFigureType>(() => {
    console.log("Load figure state")
    // If there was already a state with a figure using the same id,
    // use that to recover the state. This happens in some situations
    // where a component un-mounts and mounts again.
    const initialFigureState = widgetMgr.getElementState(element.id, "figure")
    if (initialFigureState) {
      return initialFigureState
    }
    return applyTheming(initialFigureSpec, element.theme, theme)
  })

  const plotlyConfig = useMemo(() => {
    console.log("Update config")
    if (!element.figure?.config) {
      return {}
    }

    if (element.selectionMode.length > 0) {
    }

    const config = JSON.parse(element.figure.config)

    if (!config.modeBarButtonsToRemove) {
      // Hide the logo by default
      config.displaylogo = false

      // Only modify the mode bar buttons if it's not already set
      // in the config provided by the user.
      const modeBarButtonsToRemove = ["sendDataToCloud"]
      if (
        !element.selectionMode.includes(PlotlyChartProto.SelectionMode.LASSO)
      ) {
        // Remove the lasso button if lasso selection is not activated
        modeBarButtonsToRemove.push("lasso2d")
      }

      if (
        !element.selectionMode.includes(PlotlyChartProto.SelectionMode.BOX)
      ) {
        // Remove the box select button if box selection is not activated
        modeBarButtonsToRemove.push("select2d")
      }
      config.modeBarButtonsToRemove = modeBarButtonsToRemove
    }
    return config
  }, [element.id, element.figure?.config])

  const isSelectionActivated = element.selectionMode.length > 0 && !disabled

  // TODO(lukasmasuch): Do we have to reload if the figure spec changes in element?

  useEffect(() => {
    console.log("Update spec based on updated input data")
    // Whenever the initial figure spec changes, we need to update
    // the figure spec with the new spec from the element.
    setPlotlyFigure(applyTheming(initialFigureSpec, element.theme, theme))
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [initialFigureSpec])

  useEffect(() => {
    console.log("Theme changed")
    // If the theme changes, we need to reapply the theming to the figure
    setPlotlyFigure((prevState: PlotlyFigureType) => {
      return applyTheming(prevState, element.theme, theme)
    })
  }, [element.id, theme, element.theme])

  useEffect(() => {
    console.log(
      "Selection changed",
      initialFigureSpec.layout.clickmode,
      initialFigureSpec.layout.hovermode,
      initialFigureSpec.layout.dragmode
    )
    setPlotlyFigure((prevState: PlotlyFigureType) => {
      if (isSelectionActivated) {
        // TODO(lukasmasuch) Should we move this to the backend?
        if (
          element.selectionMode.includes(PlotlyChartProto.SelectionMode.POINTS)
        ) {
          // https://plotly.com/javascript/reference/layout/#layout-clickmode
          // This allows single point selections and shift click to add / remove selections
          prevState.layout.clickmode = "event+select"
        } else {
          // If points selection is not activated, we deactivate the `select` behavior.
          prevState.layout.clickmode = "event"
        }
        prevState.layout.hovermode = "closest"
        console.log(prevState.layout.dragmode)
        if (
          element.selectionMode.includes(PlotlyChartProto.SelectionMode.BOX)
        ) {
          // Configure select (box selection) as the activated drag mode:
          prevState.layout.dragmode = "select"
        } else if (
          element.selectionMode.includes(PlotlyChartProto.SelectionMode.LASSO)
        ) {
          // Configure lass (lasso selection) as the activated drag mode:
          prevState.layout.dragmode = "lasso"
        } else {
          prevState.layout.dragmode = "pan"
        }
      } else {
        prevState.layout.clickmode = initialFigureSpec.layout.clickmode
        prevState.layout.hovermode = initialFigureSpec.layout.hovermode
        prevState.layout.dragmode = initialFigureSpec.layout.dragmode
      }
      return prevState
    })
  }, [element.id])

  let calculatedWidth = element.useContainerWidth
    ? // Apply a min width to prevent the chart running into issues with negative
      // width values if the browser window is too small:
      Math.max(width, MIN_WIDTH)
    : initialFigureSpec.layout.width
  // TODO(lukasmasuch): Do we have to use a default height here?
  let calculatedHeight = initialFigureSpec.layout.height

  if (isFullScreen) {
    calculatedWidth = width
    calculatedHeight = height
  }

  if (
    plotlyFigure.layout.height !== calculatedHeight ||
    plotlyFigure.layout.width !== calculatedWidth
  ) {
    // Update the figure with the new height and width (if they have changed)
    setPlotlyFigure({
      ...plotlyFigure,
      layout: {
        ...plotlyFigure.layout,
        height: calculatedHeight,
        width: calculatedWidth,
      },
    })
  }

  /**
   * Callback to handle selections on the plotly chart.
   */
  const handleSelection = (
    event: Readonly<Plotly.PlotSelectionEvent>
  ): void => {
    console.log("Selection event", event)
    if (!event) {
      return
    }

    const selectionState: any = {
      select: {
        points: [],
        point_indices: [],
        box: [],
        lasso: [],
      },
    }
    // Use a set for point indices since all numbers should be unique:
    const selectedPointIndices = new Set<number>()
    const selectedBoxes: Selection[] = []
    const selectedLassos: Selection[] = []
    const selectedPoints: Array<any> = []

    // event.selections doesn't show up in the PlotSelectionEvent
    // @ts-expect-error
    const { selections, points } = event
    // TODO: check this if:
    if (points.length === 0 && selections && selections.length === 0) {
      return
    }

    points.forEach(function (point: any) {
      selectedPoints.push({
        ...point,
        legendgroup: point.data.legendgroup || undefined,
        // Remove data and full data as they have been deemed to be unnecessary data overhead
        data: undefined,
        fullData: undefined,
      })
      if (notNullOrUndefined(point.pointIndex)) {
        selectedPointIndices.add(point.pointIndex)
      }

      // If pointIndices is present (e.g. selection on histogram chart),
      // add all of them to the set
      if (
        notNullOrUndefined(point.pointIndices) &&
        point.pointIndices.length > 0
      ) {
        point.pointIndices.forEach((item: number) =>
          selectedPointIndices.add(item)
        )
      }
    })

    if (selections) {
      selections.forEach((selection: any) => {
        // box selection
        if (selection.type === "rect") {
          const xAndy = parseBoxSelection(selection)
          const returnSelection: Selection = {
            xref: selection.xref,
            yref: selection.yref,
            x: xAndy.x,
            y: xAndy.y,
          }
          selectedBoxes.push(returnSelection)
        }
        // lasso selection
        if (selection.type === "path") {
          const xAndy = parseLassoPath(selection.path)
          const returnSelection: Selection = {
            xref: selection.xref,
            yref: selection.yref,
            x: xAndy.x,
            y: xAndy.y,
          }
          selectedLassos.push(returnSelection)
        }
      })
    }

    selectionState.select.points = selectedPoints.map((point: any) =>
      keysToSnakeCase(point)
    )
    // use snake case to replicate pythonic naming
    selectionState.select.point_indices = Array.from(selectedPointIndices)
    selectionState.select.box = selectedBoxes
    selectionState.select.lasso = selectedLassos

    const currentSelectionState = widgetMgr.getStringValue(element)
    const newSelectionState = JSON.stringify(selectionState)
    if (currentSelectionState !== newSelectionState) {
      // Only update the widget state if it has changed
      widgetMgr.setStringValue(
        element,
        newSelectionState,
        { fromUi: true },
        fragmentId
      )
    }
  }

  /**
   * Callback resets selections in the chart and
   * sends out an empty selection state.
   */
  const resetSelections = useCallback(
    (resetSelectionInFigure = true): void => {
      console.log("Reset selections")
      const emptySelectionState: any = {
        // We use snake case here since this is the widget state
        // that is sent and used in the backend. Therefore, it should
        // conform with the Python naming conventions.
        select: {
          points: [],
          point_indices: [],
          box: [],
          lasso: [],
        },
      }
      const currentSelectionState = widgetMgr.getStringValue(element)
      const newSelectionState = JSON.stringify(emptySelectionState)
      if (currentSelectionState !== newSelectionState) {
        // Only update the widget state if it has changed
        widgetMgr.setStringValue(
          element,
          newSelectionState,
          { fromUi: true },
          fragmentId
        )
      }
      if (resetSelectionInFigure) {
        // We need to do this reset with a short timeout, because otherwise
        // the onUpdate callback seems to overwrite the selection state
        // that we set here. The timeout will make sure that this is executed
        // after the onUpdate callback.
        setTimeout(() => {
          // Reset the selection info within the plotly figure
          setPlotlyFigure((prevFigure: PlotlyFigureType) => {
            return {
              ...prevFigure,
              data: prevFigure.data.map((trace: any) => {
                return {
                  ...trace,
                  // Set to null to clear the selection an empty
                  // array here would still show everything as opaque
                  selectedpoints: null,
                }
              }),
              layout: {
                ...prevFigure.layout,
                // selections is not part of the plotly typing:
                selections: [],
              },
            }
          })
        }, 50)
      }
    },
    [element.id, widgetMgr, fragmentId]
  )
  console.log(plotlyFigure)
  // This is required for the form clearing functionality:
  useEffect(() => {
    // TODO(lukasmasuch): This is executed way to often because
    // resetSelections changes with every change in the plotly figure.
    console.log("Clear form handler", element.formId)
    if (!element.formId) {
      return
    }

    const formClearHelper = new FormClearHelper()
    // On form clear, reset the selections (in chart & widget state)
    formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      resetSelections
    )

    return () => {
      formClearHelper.disconnect()
    }
  }, [element.formId, widgetMgr, resetSelections])

  return (
    <Plot
      key={isFullScreen ? "fullscreen" : "original"}
      className="stPlotlyChart"
      data={plotlyFigure.data}
      layout={plotlyFigure.layout}
      config={plotlyConfig}
      frames={plotlyFigure.frames ?? undefined}
      // This is fired after a selection is made on the chart
      onSelected={isSelectionActivated ? handleSelection : () => {}}
      // Double click is needed to make it easier to the user to
      // reset the selection. The default handling can be a bit annoying
      // sometimes.
      onDoubleClick={
        isSelectionActivated
          ? () => {
              console.log("onDoubleClick event")
              resetSelections()
            }
          : undefined
      }
      onDeselect={
        isSelectionActivated
          ? () => {
              console.log("onDeselect event")
              // Plotly is also resetting the UI state already for
              // deselect events. So, we don't need to do it on our side.
              // Thats why the flag is false.
              resetSelections(false)
            }
          : undefined
      }
      onInitialized={figure => {
        console.log("onInitialized")
        widgetMgr.setElementState(element.id, "figure", figure)
      }}
      // Update the figure state on every change to the figure itself:
      onUpdate={figure => {
        console.log("onUpdate")
        widgetMgr.setElementState(element.id, "figure", figure)
        setPlotlyFigure(figure)
      }}
    />
  )
}

/** Render an iframed Plotly chart from a URL */
function renderIFrame({
  url,
  width,
  height: propHeight,
}: PlotlyIFrameProps): ReactElement {
  const height = propHeight || DEFAULT_HEIGHT
  return (
    <iframe
      title="Plotly"
      src={url}
      style={{ width, height, colorScheme: "normal" }}
    />
  )
}

export function PlotlyChart({
  width,
  element,
  height,
  isFullScreen,
  widgetMgr,
  disabled,
}: Readonly<PlotlyChartProps>): ReactElement {
  switch (element.chart) {
    case "url":
      return renderIFrame({
        url: element.url as string,
        height,
        width,
      })
    case "figure":
      return (
        <PlotlyFigure
          width={width}
          element={element}
          height={height}
          isFullScreen={isFullScreen}
          widgetMgr={widgetMgr}
          disabled={disabled}
        />
      )
    default:
      throw new Error(`Unrecognized PlotlyChart type: ${element.chart}`)
  }
}

export default withFullScreenWrapper(PlotlyChart)
