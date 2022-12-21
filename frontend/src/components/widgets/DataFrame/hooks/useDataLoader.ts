/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React from "react"

import { GridCell, DataEditorProps } from "@glideapps/glide-data-grid"
import { useTheme } from "@emotion/react"

import { Quiver } from "src/lib/Quiver"
import { logError, logWarning } from "src/lib/log"
import { Arrow as ArrowProto } from "src/autogen/proto"
import { notNullOrUndefined } from "src/lib/utils"
import { Theme } from "src/theme"

import {
  getColumnTypeFromQuiver,
  getColumnsFromQuiver,
  getCellFromQuiver,
} from "../quiverUtils"
import EditingState from "../EditingState"
import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  getTextCell,
  ColumnTypes,
  ColumnCreator,
  isErrorCell,
} from "../columns"

/**
 * Options to configure columns.
 */
interface ColumnConfigProps {
  width?: number
  title?: string
  type?: string
  hidden?: boolean
  editable?: boolean
  metadata?: Record<string, unknown>
  alignment?: string
}

/**
 * Apply the column configuration if supplied.
 */
function applyColumnConfig(
  columnProps: BaseColumnProps,
  columnsConfig: Map<string | number, ColumnConfigProps>
): BaseColumnProps {
  if (!columnsConfig) {
    // No column config configured
    return columnProps
  }

  let columnConfig
  if (columnsConfig.has(columnProps.title)) {
    columnConfig = columnsConfig.get(columnProps.title)
  } else if (columnsConfig.has(`index:${columnProps.indexNumber}`)) {
    columnConfig = columnsConfig.get(`index:${columnProps.indexNumber}`)
  }

  if (!columnConfig) {
    // No column config found for this column
    return columnProps
  }

  return {
    ...columnProps,
    // Update title:
    ...(notNullOrUndefined(columnConfig.title)
      ? {
          title: columnConfig.title,
        }
      : {}),

    // Update width:
    ...(notNullOrUndefined(columnConfig.width)
      ? {
          width: columnConfig.width,
        }
      : {}),
    ...(notNullOrUndefined(columnConfig.type)
      ? {
          customType: columnConfig.type.toLowerCase().trim(),
        }
      : {}),
    // Update editable state:
    ...(notNullOrUndefined(columnConfig.editable)
      ? {
          isEditable: columnConfig.editable,
        }
      : {}),
    // Update hidden state:
    ...(notNullOrUndefined(columnConfig.hidden)
      ? {
          isHidden: columnConfig.hidden,
        }
      : {}),
    // Add column type metadata:
    ...(notNullOrUndefined(columnConfig.metadata)
      ? {
          columnTypeMetadata: columnConfig.metadata,
        }
      : {}),
    // Add column alignment:
    ...(notNullOrUndefined(columnConfig.alignment) &&
    ["left", "center", "right"].includes(columnConfig.alignment)
      ? {
          contentAlignment: columnConfig.alignment,
        }
      : {}),
  } as BaseColumnProps
}

function getColumnConfig(element: ArrowProto): Map<string, any> {
  if (!element.columns) {
    return new Map()
  }
  try {
    return new Map(Object.entries(JSON.parse(element.columns)))
  } catch (error) {
    // This is not expected to happen, but if it does, we'll return an empty map
    // and log the error to the console.
    logError(error)
    return new Map()
  }
}

/**
 * Create return type for useDataLoader hook based on the DataEditorProps.
 */
type DataLoaderReturn = {
  columns: BaseColumn[]
} & Pick<DataEditorProps, "getCellContent">

function getColumnType(column: BaseColumnProps): ColumnCreator {
  // Create a column instance based on the column properties
  let ColumnType: ColumnCreator | undefined
  if (notNullOrUndefined(column.customType)) {
    if (ColumnTypes.has(column.customType)) {
      ColumnType = ColumnTypes.get(column.customType)
    } else {
      logWarning(
        `Unknown column type configured in column configuration: ${column.customType}`
      )
    }
  }
  if (!notNullOrUndefined(ColumnType)) {
    // Load based on quiver type
    ColumnType = getColumnTypeFromQuiver(column.quiverType)
  }
  return ColumnType
}

/**
 * A custom hook that handles all data loading capabilities for the interactive data table.
 * This also includes the logic to load and configure columns.
 * And features that influence the data representation and column configuration
 * such as column resizing, sorting, etc.
 */
function useDataLoader(
  element: ArrowProto,
  data: Quiver,
  numRows: number,
  disabled: boolean,
  editingState: React.MutableRefObject<EditingState>
): DataLoaderReturn {
  const theme: Theme = useTheme()
  // TODO(lukasmasuch): Use state here for optimization?
  const columnsConfig = getColumnConfig(element)

  const stretchColumns: boolean =
    element.useContainerWidth ||
    (notNullOrUndefined(element.width) && element.width > 0)

  /**
   * Returns a list of glide-data-grid compatible columns based on a Quiver instance.
   */
  // TODO(lukasmasuch): Does this need to be a callback?
  const columns: BaseColumn[] = getColumnsFromQuiver(data)
    .map(column => {
      // Apply column configurations
      if (column.isIndex) {
        const updatedColumn = {
          ...column,
          ...applyColumnConfig(column, columnsConfig),
          isEditable: false, // TODO(lukasmasuch): Editing for index columns is currently not supported.
          isStretched: stretchColumns,
        } as BaseColumnProps
        const ColumnType = getColumnType(updatedColumn)
        return ColumnType(updatedColumn)
      }
      let updatedColumn = {
        ...column,
        ...applyColumnConfig(column, columnsConfig),
        isStretched: stretchColumns,
      } as BaseColumnProps

      const ColumnType = getColumnType(updatedColumn)

      // Make sure editing is deactivated if the column is read-only, disabled,
      // or a not editable type.
      if (
        element.editingMode === ArrowProto.EditingMode.READ_ONLY ||
        disabled ||
        ColumnType.isEditableType === false
      ) {
        updatedColumn = {
          ...updatedColumn,
          isEditable: false,
        }
      }

      return ColumnType(updatedColumn)
    })
    .filter(column => {
      // Filter out all columns that are hidden
      return !column.isHidden
    })

  const getCellContent = React.useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      if (data.isEmpty()) {
        // TODO(lukasmasuch): Is this still needed for editable tables?
        return {
          ...getTextCell(true, true),
          displayData: "empty",
        } as GridCell
      }

      if (col > columns.length - 1) {
        return getErrorCell(
          "Column index out of bounds.",
          "This should never happen. Please report this bug."
        )
      }

      if (row > numRows - 1) {
        return getErrorCell(
          "Row index out of bounds.",
          "This should never happen. Please report this bug."
        )
      }
      const column = columns[col]

      function getCell(): GridCell {
        const originalCol = column.indexNumber
        const originalRow = editingState.current.getOriginalRowIndex(row)

        // Use editing state if editable or if it is an appended row
        if (
          column.isEditable ||
          editingState.current.isAddedRow(originalRow)
        ) {
          const editedCell = editingState.current.getCell(
            originalCol,
            originalRow
          )
          if (editedCell !== undefined) {
            return editedCell
          }
        }

        try {
          // Quiver has the header in first row
          const quiverCell = data.getCell(originalRow + 1, originalCol)
          return getCellFromQuiver(column, quiverCell, data.cssStyles)
        } catch (error) {
          logError(error)
          return getErrorCell(
            "Error during cell creation.",
            `This should never happen. Please report this bug. \nError: ${error}`
          )
        }
      }

      const cell = getCell()

      // Add a background for non-editable or error cells:
      if (
        isErrorCell(cell) ||
        (element.editingMode !== ArrowProto.EditingMode.READ_ONLY &&
          !column.isEditable)
      ) {
        return {
          ...cell,
          themeOverride: {
            bgCell: theme.colors.bgMix,
            bgCellMedium: theme.colors.bgMix,
          },
        }
      }
      return cell
    },
    [columns, numRows, data, editingState]
  )

  return {
    columns,
    getCellContent,
  }
}

export default useDataLoader
