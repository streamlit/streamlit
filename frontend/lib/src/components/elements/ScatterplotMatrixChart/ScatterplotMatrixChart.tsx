/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import {
  memo,
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { getLogger } from "loglevel"

import { ScatterplotMatrixChart as ScatterplotMatrixChartProto } from "@streamlit/protobuf"

import ErrorElement from "~lib/components/shared/ErrorElement/ErrorElement"
import { FormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import { Quiver } from "~lib/dataframes/Quiver"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  DEFAULT_QUERY_COLORS,
  ScatterplotMatrixEngine,
  ScatterplotMatrixPoint,
  ScatterplotMatrixSelection,
  ScatterplotMatrixViewState,
} from "./scatterplotMatrixEngine"
import {
  StyledScatterplotMatrixCanvas,
  StyledScatterplotMatrixChart,
} from "./styled-components"

const LOG = getLogger("ScatterplotMatrixChart")

export interface ScatterplotMatrixChartProps {
  element: ScatterplotMatrixChartProto
  widgetMgr: WidgetStateManager
  disabled?: boolean
  fragmentId?: string
}

/** Key under which the navigation/viewport state is stored in the element state. */
const VIEW_STATE_KEY = "viewState"

interface ChartData {
  attributes: string[]
  points: ScatterplotMatrixPoint[]
}

/**
 * Extracts the matrix dimension values and point labels from the
 * Arrow-serialized dataframe. Rows containing non-finite values in any
 * dimension are skipped, but ids keep referencing the original positional
 * row indices.
 */
export function extractChartData(
  quiverData: Quiver,
  columns: string[],
  labelColumn: string
): ChartData {
  const { numDataRows, numDataColumns, numIndexColumns } =
    quiverData.dimensions

  const columnPositions = new Map<string, number>()
  for (let colIndex = 0; colIndex < numDataColumns; colIndex += 1) {
    const colPos = colIndex + numIndexColumns
    columnPositions.set(String(quiverData.columnNames[0][colPos]), colPos)
  }

  const attributePositions = columns.map(column => columnPositions.get(column))
  const labelPosition =
    labelColumn !== "" ? columnPositions.get(labelColumn) : undefined

  const points: ScatterplotMatrixPoint[] = []
  for (let rowIndex = 0; rowIndex < numDataRows; rowIndex += 1) {
    const atts: number[] = []
    let isValid = true
    for (const position of attributePositions) {
      if (position === undefined) {
        isValid = false
        break
      }
      const { content } = quiverData.getCell(rowIndex, position)
      const value = Number(content)
      if (!Number.isFinite(value)) {
        isValid = false
        break
      }
      atts.push(value)
    }
    if (!isValid) {
      continue
    }
    let label = String(rowIndex)
    if (labelPosition !== undefined) {
      const { content } = quiverData.getCell(rowIndex, labelPosition)
      label = String(content ?? rowIndex)
    }
    points.push({ id: rowIndex, label, atts })
  }

  return { attributes: columns, points }
}

/** Parses the per-layer point ids from a stored widget selection state. */
export function parseStoredSelection(
  storedValue: string | undefined,
  numLayers: number
): number[][] {
  if (!storedValue) {
    return []
  }
  try {
    const parsed = JSON.parse(storedValue)
    const layers: unknown = parsed?.selection?.query_layers
    if (!Array.isArray(layers)) {
      return []
    }
    return layers
      .slice(0, numLayers)
      .map(layer =>
        Array.isArray(layer?.indices)
          ? layer.indices.filter((index: unknown) => typeof index === "number")
          : []
      )
  } catch (error) {
    LOG.warn("Failed to parse the stored selection state.", error)
    return []
  }
}

function ScatterplotMatrixChart({
  element,
  widgetMgr,
  disabled,
  fragmentId,
}: Readonly<ScatterplotMatrixChartProps>): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<ScatterplotMatrixEngine | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const chartData = useMemo(
    () =>
      element.data
        ? extractChartData(
            new Quiver(element.data),
            element.columns,
            element.label
          )
        : { attributes: element.columns, points: [] },
    [element.data, element.columns, element.label]
  )

  // The engine synchronizes an external system (a WebGL canvas with its own
  // event handling and render loop), hence the imperative setup effect.
  useEffect(() => {
    if (canvasRef.current === null) {
      return undefined
    }

    const numQueryLayers =
      element.queryColors.length || DEFAULT_QUERY_COLORS.length
    const initialSelection = element.selectionsActivated
      ? parseStoredSelection(widgetMgr.getStringValue(element), numQueryLayers)
      : []

    let engine: ScatterplotMatrixEngine | null = null
    try {
      engine = new ScatterplotMatrixEngine({
        canvas: canvasRef.current,
        attributes: chartData.attributes,
        points: chartData.points,
        title: element.title,
        queryColors: element.queryColors,
        rollSpeed: element.rollSpeed || 1,
        initialSelection,
        // Keep navigation/zoom state across app reruns (which rebuild the
        // engine): the element id is stable for identical inputs.
        initialViewState:
          widgetMgr.getElementState<ScatterplotMatrixViewState>(
            element.id,
            VIEW_STATE_KEY
          ),
        onViewStateChange: (viewState: ScatterplotMatrixViewState) =>
          widgetMgr.setElementState(element.id, VIEW_STATE_KEY, viewState),
        onSelectionChange: element.selectionsActivated
          ? (selection: ScatterplotMatrixSelection) => {
              const newValue = JSON.stringify({ selection })
              if (widgetMgr.getStringValue(element) !== newValue) {
                widgetMgr.setStringValue(
                  element,
                  newValue,
                  { fromUi: true },
                  fragmentId
                )
              }
            }
          : undefined,
        disabled: disabled ?? false,
      })
    } catch (engineError) {
      LOG.error(
        "Failed to initialize the scatterplot matrix engine.",
        engineError
      )
      setError(
        engineError instanceof Error
          ? engineError
          : new Error(String(engineError))
      )
      return undefined
    }
    engineRef.current = engine
    setError(null)

    return () => {
      engineRef.current = null
      engine?.dispose()
    }
    // `disabled` is intentionally omitted: rebuilding the engine (and its
    // WebGL context) just to toggle a boolean would be wasteful. The
    // dedicated effect below keeps an existing engine's disabled state in
    // sync via `setDisabled` instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, widgetMgr, fragmentId, chartData])

  // Reset all query layers when the enclosing form is cleared.
  useEffect(() => {
    if (!element.selectionsActivated || !element.formId) {
      return undefined
    }
    const formClearHelper = new FormClearHelper()
    formClearHelper.manageFormClearListener(widgetMgr, element.formId, () => {
      engineRef.current?.clearAllQueries()
    })
    return () => formClearHelper.disconnect()
  }, [element.selectionsActivated, element.formId, widgetMgr])

  // Sync disabled state into the existing engine without rebuilding it (a
  // full rebuild would recreate the WebGL context for a boolean flag). Also
  // blur the canvas so an already-focused canvas can't keep receiving
  // keyboard events after becoming disabled (tabIndex alone only prevents
  // *future* focusing, it doesn't remove existing focus).
  useEffect(() => {
    engineRef.current?.setDisabled(disabled ?? false)
    if (disabled) {
      canvasRef.current?.blur()
    }
  }, [disabled])

  if (error !== null) {
    return (
      <ErrorElement
        name="Scatterplot matrix chart error"
        message={error.message}
      />
    )
  }

  return (
    <StyledScatterplotMatrixChart
      className="stScatterplotMatrixChart"
      data-testid="stScatterplotMatrixChart"
    >
      <StyledScatterplotMatrixCanvas
        ref={canvasRef}
        isDisabled={disabled ?? false}
        tabIndex={disabled ? -1 : 0}
        aria-label={element.title || "Scatterplot matrix chart"}
        data-testid="stScatterplotMatrixChartCanvas"
      />
    </StyledScatterplotMatrixChart>
  )
}

export default memo(ScatterplotMatrixChart)
