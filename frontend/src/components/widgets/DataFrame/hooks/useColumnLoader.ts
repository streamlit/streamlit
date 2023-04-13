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
import { merge } from "lodash"

import { Quiver } from "src/lib/Quiver"
import { Arrow as ArrowProto } from "src/autogen/proto"
import { notNullOrUndefined, isNullOrUndefined } from "src/lib/utils"
import { logWarning, logError } from "src/lib/log"

import {
  getColumnTypeFromArrow,
  getAllColumnsFromArrow,
  getEmptyIndexColumn,
} from "src/components/widgets/DataFrame/arrowUtils"
import {
  BaseColumn,
  BaseColumnProps,
  ObjectColumn,
  ColumnTypes,
  ColumnCreator,
} from "src/components/widgets/DataFrame/columns"

// Using this ID for column config will apply the config to all index columns
export const INDEX_IDENTIFIER = "index"
// Prefix used in the config column mapping when referring to a column via the numeric position
export const COLUMN_POSITION_PREFIX = "col:"

export const COLUMN_WIDTH_MAPPING = {
  small: 75,
  medium: 200,
  large: 400,
}
/**
 * Options to configure columns.
 *
 * This needs to be kept in sync with the ColumnConfig TypeDict in the backend.
 * This will eventually replaced with a proto message.
 */
export interface ColumnConfigProps {
  title?: string
  width?: "small" | "medium" | "large"
  help?: string
  hidden?: boolean
  disabled?: boolean
  required?: boolean
  default?: number | string | boolean
  type?: string
  // uses snake_case to match the property names in the backend:
  type_options?: Record<string, unknown>
  alignment?: string
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
  if (columnConfigMapping.has(columnProps.title)) {
    // Config is configured based on the column name
    columnConfig = columnConfigMapping.get(columnProps.title)
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
    title: columnConfig.title,
    width:
      notNullOrUndefined(columnConfig.width) &&
      columnConfig.width in COLUMN_WIDTH_MAPPING
        ? COLUMN_WIDTH_MAPPING[columnConfig.width]
        : undefined,
    customType: columnConfig.type?.toLowerCase().trim(),
    isEditable: notNullOrUndefined(columnConfig.disabled)
      ? !columnConfig.disabled
      : undefined,
    isHidden: columnConfig.hidden,
    isRequired: columnConfig.required,
    columnTypeOptions: columnConfig.type_options,
    contentAlignment: columnConfig.alignment,
    help: columnConfig.help,
    defaultValue: columnConfig.default,
  } as BaseColumnProps) as BaseColumnProps
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
  // TODO(lukasmasuch): We might use state to store the column config as additional optimization?
  const columnConfigMapping = getColumnConfig(element)

  const stretchColumns: boolean =
    element.useContainerWidth ||
    (notNullOrUndefined(element.width) && element.width > 0)

  // Converts the columns from Arrow into columns compatible with glide-data-grid
  const configuredColumns: BaseColumn[] = getAllColumnsFromArrow(data)
    .map(column => {
      // Apply column configurations
      let updatedColumn = {
        ...column,
        ...applyColumnConfig(column, columnConfigMapping),
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

  // If all columns got filtered out, we add an empty index column
  // to prevent errors from glide-data-grid.
  const columns =
    configuredColumns.length > 0
      ? configuredColumns
      : [ObjectColumn(getEmptyIndexColumn())]

  return {
    columns,
  }
}

export default useColumnLoader
