/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
  FC,
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import Plot, { Figure as PlotlyFigureType } from "react-plotly.js"

import { PlotlyChart as PlotlyChartProto } from "@streamlit/protobuf"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import { withFullScreenWrapper } from "~lib/components/shared/FullScreenWrapper"
import { FormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { applyTheming, handleSelection, sendEmptySelection } from "./utils"

// Minimum width for Plotly charts
const MIN_WIDTH = 150
// Default height for Plotly charts when no height is specified
const DEFAULT_PLOTLY_HEIGHT = 450

// Custom icon used in the fullscreen expand toolbar button:
/* eslint-disable streamlit-custom/no-hardcoded-theme-values */
const FULLSCREEN_EXPAND_ICON = {
  width: 600,
  height: 470,
  name: "fullscreen-expand",
  // https://fontawesome.com/icons/expand?f=classic&s=solid
  path: "M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z",
}
const FULLSCREEN_COLLAPSE_ICON = {
  width: 600,
  height: 470,
  name: "fullscreen-collapse",
  // https://fontawesome.com/icons/compress?f=classic&s=solid
  path: "M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V64zM320 320c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32s32-14.3 32-32V384h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320z",
}

export interface PlotlyChartProps {
  element: PlotlyChartProto
  widgetMgr: WidgetStateManager
  disabled: boolean
  fragmentId?: string
  disableFullscreenMode?: boolean
  width: number
}

/**
 * Note: we do not have any React-testing-library tests because Plotly doesn't support it
 * https://github.com/plotly/react-plotly.js/issues/176
 */

export function PlotlyChart({
  element,
  widgetMgr,
  disabled,
  fragmentId,
  disableFullscreenMode,
}: Readonly<PlotlyChartProps>): ReactElement {
  const theme = useEmotionTheme()
  const {
    expanded: isFullScreen,
    width: elWidth,
    height,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)
  const width = elWidth || 0

  // Load the initial figure spec from the element message
  const initialFigureSpec = useMemo<PlotlyFigureType>(() => {
    if (!element.spec) {
      return {
        layout: {},
        data: [],
        frames: undefined,
      }
    }

    return JSON.parse(element.spec)
    // We want to reload the initialFigureSpec object whenever the element id changes
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.id, element.spec])

  const [plotlyFigure, setPlotlyFigure] = useState<PlotlyFigureType>(() => {
    // If there was already a state with a figure using the same id,
    // use that to recover the state. This happens in some situations
    // where a component un-mounts and mounts again.
    const initialFigureState = widgetMgr.getElementState(element.id, "figure")
    if (initialFigureState) {
      return initialFigureState
    }
    return applyTheming(initialFigureSpec, element.theme, theme)
  })

  const isSelectionActivated = element.selectionMode.length > 0 && !disabled
  const isLassoSelectionActivated =
    isSelectionActivated &&
    element.selectionMode.includes(PlotlyChartProto.SelectionMode.LASSO)
  const isBoxSelectionActivated =
    isSelectionActivated &&
    element.selectionMode.includes(PlotlyChartProto.SelectionMode.BOX)
  const isPointsSelectionActivated =
    isSelectionActivated &&
    element.selectionMode.includes(PlotlyChartProto.SelectionMode.POINTS)

  const plotlyConfig = useMemo(() => {
    if (!element.config) {
      // If there is no config, return an empty object
      return {}
    }

    const config = JSON.parse(element.config)

    // Customize the plotly toolbar:
    if (!disableFullscreenMode) {
      // Add a fullscreen button to the plotly toolbar:
      config.modeBarButtonsToAdd = [
        {
          name: isFullScreen ? "Close fullscreen" : "Fullscreen",
          icon: isFullScreen
            ? FULLSCREEN_COLLAPSE_ICON
            : FULLSCREEN_EXPAND_ICON,
          click: () => {
            if (isFullScreen && collapse) {
              collapse()
            } else if (expand) {
              expand()
            }
          },
        },
        ...(config.modeBarButtonsToAdd ?? []),
      ]
    }

    if (!config.modeBarButtonsToRemove) {
      // Only modify the mode bar buttons if it's not already set
      // in the config provided by the user.

      // Hide the logo by default
      config.displaylogo = false

      const modeBarButtonsToRemove = ["sendDataToCloud"]

      if (!isSelectionActivated) {
        // Remove lasso & select buttons in read-only charts:
        modeBarButtonsToRemove.push("lasso2d", "select2d")
      } else {
        if (!isLassoSelectionActivated) {
          // Remove the lasso button if lasso selection is not activated
          modeBarButtonsToRemove.push("lasso2d")
        }

        if (!isBoxSelectionActivated) {
          // Remove the box select button if box selection is not activated
          modeBarButtonsToRemove.push("select2d")
        }
      }

      config.modeBarButtonsToRemove = modeBarButtonsToRemove
    }
    return config
    // We want to reload the plotlyConfig object whenever the element id changes
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    element.id,
    element.config,
    isFullScreen,
    disableFullscreenMode,
    isSelectionActivated,
    isLassoSelectionActivated,
    isBoxSelectionActivated,
    collapse,
    expand,
  ])

  useEffect(() => {
    // If the theme changes, we need to reapply the theming to the figure
    setPlotlyFigure((prevState: PlotlyFigureType) => {
      return applyTheming(prevState, element.theme, theme)
    })
  }, [element.id, theme, element.theme])

  useEffect(() => {
    let updatedClickMode: typeof initialFigureSpec.layout.clickmode =
      initialFigureSpec.layout.clickmode
    let updatedHoverMode: typeof initialFigureSpec.layout.hovermode =
      initialFigureSpec.layout.hovermode
    let updatedDragMode: typeof initialFigureSpec.layout.dragmode =
      initialFigureSpec.layout.dragmode

    if (disabled) {
      updatedClickMode = "none"
      updatedDragMode = "pan"
    } else if (isSelectionActivated) {
      if (!initialFigureSpec.layout.clickmode) {
        // If the user has already set the clickmode, we don't want to override it here.
        // Otherwise, we are selecting the best clickmode based on the selection modes.
        if (isPointsSelectionActivated) {
          // https://plotly.com/javascript/reference/layout/#layout-clickmode
          // This allows single point selections and shift click to add / remove selections
          updatedClickMode = "event+select"
        } else {
          // If points selection is not activated, we set the clickmode to none (no single item clicks)
          updatedClickMode = "none"
        }
      }

      if (!initialFigureSpec.layout.hovermode) {
        // If the user has already set the hovermode, we don't want to override it here.
        updatedHoverMode = "closest"
      }

      if (!initialFigureSpec.layout.dragmode) {
        // If the user has already set the dragmode, we don't want to override it here.
        // If not, we are selecting the best drag mode based on the selection modes.
        if (isPointsSelectionActivated) {
          // Pan drag mode has priority in case points selection is activated
          updatedDragMode = "pan"
        } else if (isBoxSelectionActivated) {
          // Configure select (box selection) as the activated drag mode:
          updatedDragMode = "select"
        } else if (isLassoSelectionActivated) {
          // Configure lasso (lasso selection) as the activated drag mode:
          updatedDragMode = "lasso"
        } else {
          updatedDragMode = "pan"
        }
      }
    }

    setPlotlyFigure((prevState: PlotlyFigureType) => {
      if (
        prevState.layout.clickmode === updatedClickMode &&
        prevState.layout.hovermode === updatedHoverMode &&
        prevState.layout.dragmode === updatedDragMode
      ) {
        // Nothing has changed, just return the previous state
        return prevState
      }

      return {
        ...prevState,
        layout: {
          ...prevState.layout,
          clickmode: updatedClickMode,
          hovermode: updatedHoverMode,
          dragmode: updatedDragMode,
        },
      }
    })
    // We want to reload these options whenever the element id changes
    // or the selection modes change.
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    element.id,
    isSelectionActivated,
    isPointsSelectionActivated,
    isBoxSelectionActivated,
    isLassoSelectionActivated,
    disabled,
  ])

  let calculatedWidth =
    width === -1
      ? // In some situations - e.g. initial loading of tabs - the width is set to -1
        // before its able to determine the real width. We want to keep the previous
        // width in this case.
        plotlyFigure.layout?.width
      : Math.max(
          element.useContainerWidth
            ? width
            : Math.min(initialFigureSpec.layout.width ?? width, width ?? 0),
          // Apply a min width to prevent the chart running into issues with negative
          // width values if the browser window is too small:
          MIN_WIDTH
        )

  // Get the initial height, using a default if not specified
  let calculatedHeight = initialFigureSpec.layout.height

  if (isFullScreen) {
    calculatedWidth = width
    calculatedHeight = height
  } else if (calculatedHeight === undefined) {
    calculatedHeight = DEFAULT_PLOTLY_HEIGHT
  }

  if (
    plotlyFigure.layout.height !== calculatedHeight ||
    plotlyFigure.layout.width !== calculatedWidth
  ) {
    // Update the figure with the new height and width (if they have changed)
    setPlotlyFigure((prevFigure: PlotlyFigureType) => {
      return {
        ...prevFigure,
        layout: {
          ...prevFigure.layout,
          height: calculatedHeight,
          width: calculatedWidth,
        },
      }
    })
  }

  /**
   * Callback to handle selections on the plotly chart.
   */
  const handleSelectionCallback = useCallback(
    (event: Readonly<Plotly.PlotSelectionEvent>): void => {
      handleSelection(event, widgetMgr, element, fragmentId)
    },
    // We are using element.id here instead of element since we don't
    // shallow reference equality will not work correctly for element.
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [element.id, widgetMgr, fragmentId]
  )

  /**
   * Callback resets selections in the chart and
   * sends out an empty selection state.
   */
  const resetSelectionsCallback = useCallback(
    (resetSelectionInFigure = true): void => {
      sendEmptySelection(widgetMgr, element, fragmentId)

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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
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
    // We are using element.id here instead of element since we don't
    // shallow reference equality will not work correctly for element.
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [element.id, widgetMgr, fragmentId]
  )

  // This is required for the form clearing functionality:
  useEffect(() => {
    if (!element.formId || !isSelectionActivated) {
      // We don't need the form clear functionality if its not in a form
      // or if selections are not activated.
      return
    }

    const formClearHelper = new FormClearHelper()
    // On form clear, reset the selections (in chart & widget state)
    formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      resetSelectionsCallback
    )

    return () => {
      formClearHelper.disconnect()
    }
  }, [
    element.formId,
    widgetMgr,
    isSelectionActivated,
    resetSelectionsCallback,
  ])

  useEffect(() => {
    if (!isSelectionActivated) {
      return
    }
    // The point selection during the lasso or box selection seems
    // to be a bit buggy. Sometimes, points gets unselected without
    // triggering an onDeselect event.
    // Therefore, we are deactivating the event+select clickmode
    // if the dragmode is set to select or lasso.
    let clickmode: "event+select" | "event" | "none"
    if (
      plotlyFigure.layout?.dragmode === "select" ||
      plotlyFigure.layout?.dragmode === "lasso"
    ) {
      clickmode = "event"
    } else {
      // Reset to either none or event+select based on if points selection mode
      // is activated or not.
      clickmode = isPointsSelectionActivated ? "event+select" : "none"
    }

    if (plotlyFigure.layout?.clickmode !== clickmode) {
      setPlotlyFigure((prevFigure: PlotlyFigureType) => {
        return {
          ...prevFigure,
          layout: {
            ...prevFigure.layout,
            clickmode: clickmode,
          },
        }
      })
    }
    // We only want to trigger this effect if the dragmode changes.
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotlyFigure.layout?.dragmode])

  return (
    <div className="stPlotlyChart" data-testid="stPlotlyChart">
      <Plot
        data={plotlyFigure.data}
        layout={plotlyFigure.layout}
        config={plotlyConfig}
        frames={plotlyFigure.frames ?? undefined}
        style={{
          // Hide the plotly chart if the width is not defined yet
          // to prevent flickering issues.
          visibility:
            plotlyFigure.layout?.width === undefined ? "hidden" : undefined,
        }}
        onSelected={isSelectionActivated ? handleSelectionCallback : () => {}}
        // Double click is needed to make it easier to the user to
        // reset the selection. The default handling can be a bit annoying
        // sometimes.
        onDoubleClick={
          isSelectionActivated ? () => resetSelectionsCallback() : undefined
        }
        onDeselect={
          isSelectionActivated
            ? () => {
                // Plotly is also resetting the UI state already for
                // deselect events. So, we don't need to do it on our side.
                // Thats why the flag is false.
                resetSelectionsCallback(false)
              }
            : undefined
        }
        onInitialized={figure => {
          widgetMgr.setElementState(element.id, "figure", figure)
        }}
        // Update the figure state on every change to the figure itself:
        onUpdate={figure => {
          // Save the updated figure state to allow it to be recovered
          widgetMgr.setElementState(element.id, "figure", figure)
          setPlotlyFigure(figure)
        }}
      />
    </div>
  )
}

const PlotlyChartWidthCheck: FC<Omit<PlotlyChartProps, "width">> = props => {
  const { width } = useRequiredContext(ElementFullscreenContext)

  // If the width is not defined yet, we don't want to render the chart because
  // it can cause issues with Plotly's rendering where elements will be
  // positioned incorrectly
  if (!width) {
    return null
  }

  return <PlotlyChart width={width} {...props} />
}

const PlotlyChartWithFullScreenWrapper = withFullScreenWrapper(
  PlotlyChartWidthCheck
)
export default memo(PlotlyChartWithFullScreenWrapper)
