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

import { Quiver } from "src/lib/Quiver"
import { Arrow as ArrowProto } from "src/autogen/proto"
import { notNullOrUndefined, isNullOrUndefined } from "src/lib/utils"
import { logWarning, logError } from "src/lib/log"

import {
  getColumnTypeFromArrow,
  getColumnsFromArrow,
  getCellFromArrow,
} from "src/components/widgets/DataFrame/arrowUtils"
import EditingState from "src/components/widgets/DataFrame/EditingState"
import {
  BaseColumn,
  BaseColumnProps,
  getErrorCell,
  ColumnTypes,
  ColumnCreator,
} from "src/components/widgets/DataFrame/columns"

// Using this ID for column config will apply the config to all index columns
export const INDEX_IDENTIFIER = "index"
// Prefix used in the config column mapping when referring to a column via the numeric position
export const COLUMN_POSITION_PREFIX = "col:"

/**
 * Options to configure columns.
 */
export interface ColumnConfigProps {
  width?: number
  title?: string
  type?: string
  hidden?: boolean
  editable?: boolean
  metadata?: Record<string, unknown>
  alignment?: string
}

/**
 * Apply the user-defined column configuration if supplied.
 *
 * @param columnProps - The column properties to apply the config to.
 * @param columnsConfig - The user-defined column configuration.
 *
 * @return the column properties with the config applied.
 */
export function applyColumnConfig(
  columnProps: BaseColumnProps,
  columnsConfig: Map<string | number, ColumnConfigProps>
): BaseColumnProps {
  if (!columnsConfig) {
    // No column config configured
    return columnProps
  }

  let columnConfig
  if (columnsConfig.has(columnProps.title)) {
    // Config is configured based on the column title
    columnConfig = columnsConfig.get(columnProps.title)
  } else if (
    columnsConfig.has(`${COLUMN_POSITION_PREFIX}${columnProps.indexNumber}`)
  ) {
    // Config is configured based on the column position, e.g. col:0 -> first column
    columnConfig = columnsConfig.get(
      `${COLUMN_POSITION_PREFIX}${columnProps.indexNumber}`
    )
  } else if (columnProps.isIndex && columnsConfig.has(INDEX_IDENTIFIER)) {
    // Config is configured for the index column (or all index columns for multi-index)
    columnConfig = columnsConfig.get(INDEX_IDENTIFIER)
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
    // Select a column type:
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
    ...(notNullOrUndefined(columnConfig.alignment)
      ? {
          contentAlignment: columnConfig.alignment,
        }
      : {}),
  } as BaseColumnProps
}

/**
 * Extracts the user-defined column configuration from the proto message.
 *
 * @param element - The proto message of the dataframe element.
 *
 * @returns the user-defined column configuration.
 */
export function getColumnConfig(element: ArrowProto): Map<string, any> {
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

type DataLoaderReturn = {
  columns: BaseColumn[]
} & Pick<DataEditorProps, "getCellContent">

/**
 * Get the column type (creator class of column type) for the given column properties.
 *
 * @param column - The column properties.
 *
 * @returns the column creator of the corresponding column type.
 */
export function getColumnType(column: BaseColumnProps): ColumnCreator {
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
  if (isNullOrUndefined(ColumnType)) {
    // Load based on arrow type
    ColumnType = getColumnTypeFromArrow(column.arrowType)
  }
  return ColumnType
}

/**
 * Custom hook that handles all data loading capabilities for the interactive data table.
 * This also includes the logic to load and configure columns.
 *
 * @param element - The proto message of the dataframe element
 * @param data - The Arrow data extracted from the proto message
 * @param numRows - The number of rows of the current state (includes row additions/deletions)
 * @param disabled - Whether the widget is disabled
 * @param editingState - The editing state of the data editor
 *
 * @returns the columns and the cell content getter compatible with glide-data-grid.
 */
function useDataLoader(
  element: ArrowProto,
  data: Quiver,
  numRows: number,
  disabled: boolean,
  editingState: React.MutableRefObject<EditingState>
): DataLoaderReturn {
  // TODO(lukasmasuch): We might use state to store the column config as additional optimization?
  const columnsConfig = getColumnConfig(element)

  const stretchColumns: boolean =
    element.useContainerWidth ||
    (notNullOrUndefined(element.width) && element.width > 0)

  // Converts the columns from Arrow into columns compatible with glide-data-grid
  const columns: BaseColumn[] = getColumnsFromArrow(data)
    .map(column => {
      // Apply column configurations
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

      const originalCol = column.indexNumber
      const originalRow = editingState.current.getOriginalRowIndex(row)

      // Use editing state if editable or if it is an appended row
      if (column.isEditable || editingState.current.isAddedRow(originalRow)) {
        const editedCell = editingState.current.getCell(
          originalCol,
          originalRow
        )
        if (editedCell !== undefined) {
          return editedCell
        }
      }

      try {
        // Arrow has the header in first row
        const arrowCell = data.getCell(originalRow + 1, originalCol)
        return getCellFromArrow(column, arrowCell, data.cssStyles)
      } catch (error) {
        logError(error)
        return getErrorCell(
          "Error during cell creation.",
          `This should never happen. Please report this bug. \nError: ${error}`
        )
      }
    },
    [columns, numRows, data, editingState]
  )

  return {
    columns,
    getCellContent,
  }
}

export default useDataLoader
