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
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react"

import isArray from "lodash/isArray"
import isEmpty from "lodash/isEmpty"
import merge from "lodash/merge"
import mergeWith from "lodash/mergeWith"
import { getLogger } from "loglevel"

import { Arrow as ArrowProto, streamlit } from "@streamlit/protobuf"

import {
  getColumnTypeFromArrow,
  getConfiguredWidth,
  initAllColumnsFromArrow,
  initEmptyIndexColumn,
  shouldUseContainerWidth,
} from "~lib/components/widgets/DataFrame/arrowUtils"
import {
  BaseColumn,
  BaseColumnProps,
  ColumnCreator,
  ColumnTypes,
  ObjectColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { Quiver } from "~lib/dataframes/Quiver"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme"
import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

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

const LOG = getLogger("useColumnLoader")

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
 * Custom merge function to merge column config objects.
 */
const mergeColumnConfig = (
  target: ColumnConfigProps,
  source: ColumnConfigProps
): ColumnConfigProps => {
  // Don't merge arrays, just overwrite the old value with the new value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const customMergeArrays = (_objValue: object, srcValue: object): any => {
    // If the new value is an array, just return it as is (overwriting the old)
    if (isArray(srcValue)) {
      return srcValue
    }
  }

  return mergeWith(target, source, customMergeArrays)
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

  let columnConfig: ColumnConfigProps = {}

  // Merge all possible ways to provide column config for a specific column:
  // The order / priority of how this is merged is important!

  // 1. Config is configured for the index column (or all index columns for multi-index)
  if (columnProps.isIndex && columnConfigMapping.has(INDEX_IDENTIFIER)) {
    columnConfig = mergeColumnConfig(
      columnConfig,
      columnConfigMapping.get(INDEX_IDENTIFIER) ?? {}
    )
  }

  // 2. Config is configured based on the column position, e.g. _pos:0 -> first column
  if (
    columnConfigMapping.has(
      `${COLUMN_POSITION_PREFIX}${columnProps.indexNumber}`
    )
  ) {
    columnConfig = mergeColumnConfig(
      columnConfig,
      columnConfigMapping.get(
        `${COLUMN_POSITION_PREFIX}${columnProps.indexNumber}`
      ) ?? {}
    )
  }

  // 3. Config is configured based on the column name
  if (
    columnConfigMapping.has(columnProps.name) &&
    columnProps.name !== INDEX_IDENTIFIER // "_index" is not supported as name for normal columns
  ) {
    columnConfig = mergeColumnConfig(
      columnConfig,
      columnConfigMapping.get(columnProps.name) ?? {}
    )
  }

  // 4. Config is configured based on the column id
  // This is mainly used by the frontend component to apply changes to columns
  // based on user configuration on the UI.
  if (columnConfigMapping.has(columnProps.id)) {
    columnConfig = mergeColumnConfig(
      columnConfig,
      columnConfigMapping.get(columnProps.id) ?? {}
    )
  }

  // No column config found for this column
  if (isEmpty(columnConfig)) {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function getColumnConfig(configJson: string): Map<string, any> {
  if (!configJson) {
    return new Map()
  }
  try {
    return new Map(Object.entries(JSON.parse(configJson)))
  } catch (error) {
    // This is not expected to happen, but if it does, we'll return an empty map
    // and log the error to the console.
    LOG.error(error)
    return new Map()
  }
}

type ColumnLoaderReturn = {
  // All the visible columns:
  columns: BaseColumn[]
  // All the columns of the dataframe, including hidden ones:
  allColumns: BaseColumn[]
  // Callback to set the column config state:
  setColumnConfigMapping: Dispatch<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    SetStateAction<Map<string, any>>
  >
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
      LOG.warn(
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
 * @param columnOrder - The custom column order state. This is a list of column names or column ids.
 *        If this is empty, the columns will be ordered by their position in the Arrow table.
 *
 * @returns the columns and the cell content getter compatible with glide-data-grid
 * and the parsed column config mapping.
 */
function useColumnLoader(
  element: ArrowProto,
  data: Quiver,
  disabled: boolean,
  columnOrder: string[],
  widthConfig?: streamlit.IWidthConfig | null
): ColumnLoaderReturn {
  const theme = useEmotionTheme()

  // Memoize the column config parsing to avoid unnecessary re-renders & re-parsing:
  const parsedColumnConfig = useMemo(
    () => getColumnConfig(element.columns),
    [element.columns]
  )

  // Initialize state with the parsed column config:
  // We need that to allow changing the column config state
  // (e.g. via changes by the user in the UI)
  const [columnConfigMapping, setColumnConfigMapping] =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    useState<Map<string, any>>(parsedColumnConfig)

  // Resync state whenever the parsed column config from the proto changes:
  useEffect(() => {
    setColumnConfigMapping(parsedColumnConfig)
  }, [parsedColumnConfig])

  const shouldUseContainerWidthValue = useMemo(
    () => shouldUseContainerWidth(element, widthConfig),
    [element, widthConfig]
  )

  const configuredWidth = useMemo(
    () => getConfiguredWidth(element, widthConfig),
    [element, widthConfig]
  )

  const stretchColumns: boolean =
    shouldUseContainerWidthValue ||
    (notNullOrUndefined(configuredWidth) && configuredWidth > 0)

  // Allow content wrapping if the configured row height is greater than 4rem.
  // 4rem was arbitrarily chosen because it looks and feels good. Its using rem
  // so that it adapts to changes in the root font size (configurable by the user).
  const isWrappingAllowed: boolean =
    notNullOrUndefined(element.rowHeight) &&
    element.rowHeight > convertRemToPx("4rem")

  // Converts the columns from Arrow into columns compatible with glide-data-grid
  const allColumns: BaseColumn[] = useMemo(() => {
    return initAllColumnsFromArrow(data).map(column => {
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
  }, [
    data,
    columnConfigMapping,
    stretchColumns,
    element.editingMode,
    disabled,
    theme,
  ])

  const columns: BaseColumn[] = useMemo(() => {
    const visibleColumns = initAllColumnsFromArrow(data)
      .map(column => {
        // Apply column configurations
        let updatedColumn = {
          ...column,
          ...applyColumnConfig(column, columnConfigMapping),
          isStretched: stretchColumns,
          isWrappingAllowed: isWrappingAllowed,
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

    const pinnedColumns: BaseColumn[] = []
    const unpinnedColumns: BaseColumn[] = []

    if (columnOrder?.length) {
      // The column order list can contain either column names - if configured by the user -
      // or column ids - if configured by the frontend component.

      // Special case: index columns not part of the column order
      // are shown as the first columns in the table
      visibleColumns.forEach(column => {
        if (
          column.isIndex &&
          !columnOrder.includes(column.name) &&
          !columnOrder.includes(column.id) &&
          // Don't add the index column if it is explicitly not pinned
          column.isPinned !== false
        ) {
          pinnedColumns.push(column)
        }
      })

      // Reorder columns based on the configured column order:
      columnOrder.forEach(columnName => {
        const column = visibleColumns.find(
          columnArg =>
            columnArg.name === columnName || columnArg.id === columnName
        )
        if (column) {
          if (column.isPinned) {
            pinnedColumns.push(column)
          } else {
            unpinnedColumns.push(column)
          }
        }
      })
    } else {
      // If no column order is configured, we just need to split
      // the columns into pinned and unpinned:
      visibleColumns.forEach(column => {
        if (column.isPinned) {
          pinnedColumns.push(column)
        } else {
          unpinnedColumns.push(column)
        }
      })
    }

    const orderedColumns = [...pinnedColumns, ...unpinnedColumns]

    // If all columns got filtered out, we add an empty index column
    // to prevent errors from glide-data-grid.
    return orderedColumns.length > 0
      ? orderedColumns
      : [ObjectColumn(initEmptyIndexColumn())]
  }, [
    data,
    columnConfigMapping,
    isWrappingAllowed,
    stretchColumns,
    disabled,
    element.editingMode,
    columnOrder,
    theme,
  ])

  return {
    columns,
    allColumns,
    setColumnConfigMapping,
  }
}

export default useColumnLoader
