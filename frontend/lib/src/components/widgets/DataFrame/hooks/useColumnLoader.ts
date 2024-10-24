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
import React from "react"

import { useTheme } from "@emotion/react"
import merge from "lodash/merge"

import {
  getAllColumnsFromArrow,
  getColumnTypeFromArrow,
  getEmptyIndexColumn,
} from "@streamlit/lib/src/components/widgets/DataFrame/arrowUtils"
import {
  BaseColumn,
  BaseColumnProps,
  ColumnCreator,
  ColumnTypes,
  ObjectColumn,
} from "@streamlit/lib/src/components/widgets/DataFrame/columns"
import { Quiver } from "@streamlit/lib/src/dataframes/Quiver"
import { Arrow as ArrowProto } from "@streamlit/lib/src/proto"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import { logError, logWarning } from "@streamlit/lib/src/util/log"
import {
  isNullOrUndefined,
  notNullOrUndefined,
} from "@streamlit/lib/src/util/utils"

// Using this ID for column config will apply the config to all index columns
export const INDEX_IDENTIFIER = "_index"
// Prefix used in the config column mapping when referring to a column via the numeric position
export const COLUMN_POSITION_PREFIX = "_pos:"

// Predefined column widths configurable by the user
export const COLUMN_WIDTH_MAPPING = {
  small: 75,
  medium: 200,
  large: 400,
}

/**
 * Options to configure columns.
 *
 * This needs to be kept in sync with the ColumnConfig TypeDict in the backend.
 * This will be eventually replaced with a proto message.
 */
export interface ColumnConfigProps {
  label?: string
  width?: "small" | "medium" | "large" | number
  help?: string
  hidden?: boolean
  disabled?: boolean
  required?: boolean
  default?: number | string | boolean
  alignment?: "left" | "center" | "right"
  pinned?: boolean
  // uses snake_case to match the property names in the backend:
  type_config?: Record<string, unknown>
}

/**
 * Parse the user-defined width configuration and return the width in pixels.
 */
function parseWidthConfig(
  width?: "small" | "medium" | "large" | number
): number | undefined {
  if (isNullOrUndefined(width)) {
    return undefined
  }

  if (typeof width === "number") {
    return width
  }

  if (width in COLUMN_WIDTH_MAPPING) {
    return COLUMN_WIDTH_MAPPING[width]
  }

  return undefined
}

/**
 * Apply the user-defined column configuration if supplied.
 *
 * @param columnProps - The column properties to apply the config to.
 * @param columnConfigMapping - The user-defined column configuration mapping.
 *
 * @return the column properties with the config applied.
 */
export function applyColumnConfig(
  columnProps: BaseColumnProps,
  columnConfigMapping: Map<string | number, ColumnConfigProps>
): BaseColumnProps {
  if (!columnConfigMapping) {
    // No column config configured
    return columnProps
  }

  let columnConfig
  if (
    columnConfigMapping.has(columnProps.name) &&
    columnProps.name !== INDEX_IDENTIFIER // "index" is not supported as name for normal columns
  ) {
    // Config is configured based on the column name
    columnConfig = columnConfigMapping.get(columnProps.name)
  } else if (
    columnConfigMapping.has(
      `${COLUMN_POSITION_PREFIX}${columnProps.indexNumber}`
    )
  ) {
    // Config is configured based on the column position, e.g. col:0 -> first column
    columnConfig = columnConfigMapping.get(
      `${COLUMN_POSITION_PREFIX}${columnProps.indexNumber}`
    )
  } else if (
    columnProps.isIndex &&
    columnConfigMapping.has(INDEX_IDENTIFIER)
  ) {
    // Config is configured for the index column (or all index columns for multi-index)
    columnConfig = columnConfigMapping.get(INDEX_IDENTIFIER)
  }

  if (!columnConfig) {
    // No column config found for this column
    return columnProps
  }

  // This will update all column props with the user-defined config for all
  // configuration options that are not undefined:
  return merge({ ...columnProps }, {
    title: columnConfig.label,
    width: parseWidthConfig(columnConfig.width),
    isEditable: notNullOrUndefined(columnConfig.disabled)
      ? !columnConfig.disabled
      : undefined,
    isHidden: columnConfig.hidden,
    isPinned: columnConfig.pinned,
    isRequired: columnConfig.required,
    columnTypeOptions: columnConfig.type_config,
    contentAlignment: columnConfig.alignment,
    defaultValue: columnConfig.default,
    help: columnConfig.help,
  } as BaseColumnProps) as BaseColumnProps
}

/**
 * Extracts the user-defined column configuration from the JSON config.
 *
 * @param configJson - the column config JSON from the proto.
 *
 * @returns the user-defined column configuration.
 */
export function getColumnConfig(configJson: string): Map<string, any> {
  if (!configJson) {
    return new Map()
  }
  try {
    return new Map(Object.entries(JSON.parse(configJson)))
  } catch (error) {
    // This is not expected to happen, but if it does, we'll return an empty map
    // and log the error to the console.
    logError(error)
    return new Map()
  }
}

type ColumnLoaderReturn = {
  columns: BaseColumn[]
}

/**
 * Get the column type (creator class of column type) for the given column properties.
 *
 * @param column - The column properties.
 *
 * @returns the column creator of the corresponding column type.
 */
export function getColumnType(column: BaseColumnProps): ColumnCreator {
  const customType = column.columnTypeOptions?.type as string
  // Create a column instance based on the column properties
  let ColumnType: ColumnCreator | undefined
  if (notNullOrUndefined(customType)) {
    if (ColumnTypes.has(customType)) {
      ColumnType = ColumnTypes.get(customType)
    } else {
      logWarning(
        `Unknown column type configured in column configuration: ${customType}`
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
 * Custom hook that handles loads and configures all table columns from the Arrow table.
 *
 * @param element - The proto message of the dataframe element
 * @param data - The Arrow data extracted from the proto message
 * @param disabled - Whether the widget is disabled
 *
 * @returns the columns and the cell content getter compatible with glide-data-grid.
 */
function useColumnLoader(
  element: ArrowProto,
  data: Quiver,
  disabled: boolean
): ColumnLoaderReturn {
  const theme: EmotionTheme = useTheme()

  const columnConfigMapping = React.useMemo(() => {
    return getColumnConfig(element.columns)
  }, [element.columns])

  const stretchColumns: boolean =
    element.useContainerWidth ||
    (notNullOrUndefined(element.width) && element.width > 0)

  // Converts the columns from Arrow into columns compatible with glide-data-grid
  const columns: BaseColumn[] = React.useMemo(() => {
    let configuredColumns = getAllColumnsFromArrow(data)
      .map(column => {
        // Apply column configurations
        let updatedColumn = {
          ...column,
          ...applyColumnConfig(column, columnConfigMapping),
          isStretched: stretchColumns,
        } as BaseColumnProps
        console.log("updatedColumn", updatedColumn, columnConfigMapping)
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

        if (
          element.editingMode !== ArrowProto.EditingMode.READ_ONLY &&
          updatedColumn.isEditable == true
        ) {
          // Set editable icon for all editable columns:
          updatedColumn = {
            ...updatedColumn,
            icon: "editable",
          }

          // Make sure that required columns are not hidden when editing mode is dynamic:
          if (
            updatedColumn.isRequired &&
            element.editingMode === ArrowProto.EditingMode.DYNAMIC
          ) {
            updatedColumn = {
              ...updatedColumn,
              isHidden: false,
            }
          }
        }

        return ColumnType(updatedColumn, theme)
      })
      .filter(column => {
        // Filter out all columns that are hidden
        return !column.isHidden
      })

    const orderedColumns: BaseColumn[] = []

    // Add all pinned columns to the beginning of the list:
    const unpinnedColumns: BaseColumn[] = []
    configuredColumns.forEach(column => {
      if (column.isPinned) {
        orderedColumns.push(column)
      } else {
        unpinnedColumns.push(column)
      }
    })

    if (element.columnOrder && element.columnOrder.length > 0) {
      // Reorder non-pinned columns based on the configured column order:
      element.columnOrder.forEach(columnName => {
        const column = configuredColumns.find(
          column => column.name === columnName
        )
        if (column && !column.isPinned) {
          orderedColumns.push(column)
        }
      })
    } else {
      // Add all unpinned columns to the end of the list:
      orderedColumns.push(...unpinnedColumns)
    }

    configuredColumns = orderedColumns

    // If all columns got filtered out, we add an empty index column
    // to prevent errors from glide-data-grid.
    return configuredColumns.length > 0
      ? configuredColumns
      : [ObjectColumn(getEmptyIndexColumn())]
  }, [
    data,
    columnConfigMapping,
    stretchColumns,
    disabled,
    element.editingMode,
    element.columnOrder,
    theme,
  ])

  return {
    columns,
  }
}

export default useColumnLoader
