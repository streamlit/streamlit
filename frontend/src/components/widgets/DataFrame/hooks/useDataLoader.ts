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
import { transparentize } from "color2k"

import { Quiver } from "src/lib/Quiver"
import { logError } from "src/lib/log"
import { Arrow as ArrowProto } from "src/autogen/proto"
import { notNullOrUndefined } from "src/lib/utils"
import { Theme } from "src/theme"
import { logWarning } from "src/lib/log"

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
  ObjectColumn,
  ColumnCreator,
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
          //TODO(lukasmasuch): Merge in metadata?
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

  // TODO(lukasmasuch): This should be also dependent on element or data
  // But this currently triggers updates on every rerender.

  // TODO(lukasmasuch): Use state here for optimization?
  const columnsConfig = getColumnConfig(element)

  const stretchColumns: boolean =
    element.useContainerWidth ||
    (notNullOrUndefined(element.width) && element.width > 0)

  /**
   * Returns a list of glide-data-grid compatible columns based on a Quiver instance.
   */
  // TODO(lukasmasuch): Does this need to be a callback?
  const columns = getColumnsFromQuiver(data)
    .map(column => {
      // Apply column configurations
      if (column.isIndex) {
        return {
          ...column,
          ...applyColumnConfig(column, columnsConfig),
          isEditable: false, // TODO(lukasmasuch): Editing for index columns is currently not supported.
          isStretched: stretchColumns,
        } as BaseColumnProps
      } else {
        let updatedColumn = {
          ...column,
          ...applyColumnConfig(column, columnsConfig),
          isStretched: stretchColumns,
        } as BaseColumnProps

        // Make sure editing is deactivated if the column is read-only or disabled:
        if (
          element.editingMode === ArrowProto.EditingMode.READ_ONLY ||
          disabled
        ) {
          updatedColumn = {
            ...updatedColumn,
            isEditable: false,
          }
        }

        // Add a background for non-editable cells, if the overall table is editable:
        if (
          element.editingMode !== ArrowProto.EditingMode.READ_ONLY &&
          !updatedColumn.isEditable
        ) {
          updatedColumn = {
            ...updatedColumn,
            themeOverride: {
              bgCell: transparentize(theme.colors.darkenedBgMix100, 0.95),
              bgCellMedium: transparentize(
                theme.colors.darkenedBgMix100,
                0.95
              ),
            },
          }
        }

        return updatedColumn
      }
    })
    .filter(column => {
      // Filter out all columns that are hidden
      return !column.isHidden
    })
    .map(column => {
      // Create a column instance based on the column properties
      let ColumnType: ColumnCreator | undefined
      if (notNullOrUndefined(column.customType)) {
        if (ColumnTypes.has(column.customType)) {
          ColumnType = ColumnTypes.get(column.customType)
        } else {
          logWarning(
            "Unknown column type configured in column configuration: " +
              column.customType
          )
        }
      }
      if (!notNullOrUndefined(ColumnType)) {
        // Load based on quiver type
        ColumnType = getColumnTypeFromQuiver(column.quiverType)
      }

      // Load column instance
      return ColumnType(column)
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

      // const originalCol = column.indexNumber
      // const originalRow = row
      //getOriginalIndex(row)

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
    },
    [columns, numRows, data, editingState]
  )

  return {
    columns,
    getCellContent,
  }
}

export default useDataLoader
