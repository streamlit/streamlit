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

import {
  Theme as GlideTheme,
  GridCell,
  GridCellKind,
  NumberCell,
  TextCell,
  UriCell,
} from "@glideapps/glide-data-grid"
import { DatePickerType } from "@glideapps/glide-data-grid-cells"
import { Field, Null } from "apache-arrow"
import moment from "moment"

import { Arrow as ArrowProto, streamlit } from "@streamlit/protobuf"

import {
  convertTimeToDate,
  format as formatArrowCell,
} from "~lib/dataframes/arrowFormatUtils"
import {
  ArrowType,
  DataFrameCellType,
  isBooleanType,
  isBytesType,
  isCategoricalType,
  isDatetimeType,
  isDateType,
  isDecimalType,
  isEmptyType,
  isListType,
  isNumericType,
  isObjectType,
  isRangeIndexType,
  isStringType,
  isTimeType,
} from "~lib/dataframes/arrowTypeUtils"
import { StyledCell } from "~lib/dataframes/pandasStylerUtils"
import { DataFrameCell, Quiver } from "~lib/dataframes/Quiver"
import { fontSizes } from "~lib/theme/primitives/typography"
import { isNullOrUndefined, notNullOrUndefined } from "~lib/util/utils"

import {
  BaseColumn,
  BaseColumnProps,
  CheckboxColumn,
  ColumnCreator,
  DateColumn,
  DateTimeColumn,
  DateTimeColumnParams,
  isErrorCell,
  LinkColumnParams,
  ListColumn,
  NumberColumn,
  NumberColumnParams,
  ObjectColumn,
  removeLineBreaks,
  SelectboxColumn,
  TextColumn,
  TimeColumn,
} from "./columns"

/**
 * Extracts a CSS property value from a given CSS style string by using a regex.
 *
 * @param htmlElementId - The ID of the HTML element to extract the property for.
 * @param property - The css property to extract the value for.
 * @param cssStyle - The css style string.
 *
 * @return the CSS property value or undefined if the property is not found.
 */
export function extractCssProperty(
  htmlElementId: string,
  property: string,
  cssStyle: string
): string | undefined {
  // Check if the css even includes the property we are looking for.
  // The html element ID already gets checked in applyPandasStylerCss
  // we don't check it again for performance reasons.
  if (!cssStyle.includes(property)) {
    return undefined
  }

  // This regex is supposed to extract the value of a CSS property
  // for a specified HTML element ID from a CSS style string:
  const regex = new RegExp(
    `${htmlElementId}[,\\s].*{(?:[^}]*[\\s;]{1})?${property}:\\s*([^;}]+)[;]?.*}`,
    "gm"
  )
  // Makes the regex simpler to match the element correctly:
  cssStyle = cssStyle.replace(/{/g, " {")

  const match = regex.exec(cssStyle)
  if (match) {
    return match[1].trim()
  }

  return undefined
}
/**
 * Applies pandas styler CSS to style the cell.
 *
 * @param cell: The cell to style.
 * @param cssId: The css ID of the cell.
 * @param cssStyles: All CSS styles from pandas styler.
 *
 * @return a styled grid cell.
 */
export function applyPandasStylerCss(
  cell: GridCell,
  cssId: string,
  cssStyles: string
): GridCell {
  const themeOverride = {} as Partial<GlideTheme>
  if (!cssStyles.includes(cssId)) {
    // If the CSS styles don't contain the CSS ID, we can skip applying the styles.
    // This is a performance optimization to avoid running a regex if the
    // property or element is not even in the style string.
    return cell
  }

  // Extract and apply the font color
  const fontColor = extractCssProperty(cssId, "color", cssStyles)
  if (fontColor) {
    themeOverride.textDark = fontColor

    // Apply text color also for cells that don't use textDark:
    if (cell.kind === GridCellKind.Bubble) {
      themeOverride.textBubble = fontColor
    }
    if (cell.kind === GridCellKind.Uri) {
      themeOverride.linkColor = fontColor
    }
  }

  // Extract and apply the background color
  const backgroundColor = extractCssProperty(
    cssId,
    "background-color",
    cssStyles
  )
  if (backgroundColor) {
    themeOverride.bgCell = backgroundColor
  }

  if (backgroundColor === "yellow" && fontColor === undefined) {
    // Yellow is used by pandas styler as the default highlight color.
    // But yellow won't work well with our default font color in dark mode.
    // Therefore, we are overriding the font color to our dark font color which
    // always works well with yellow background.
    themeOverride.textDark = "#31333F"
  }

  // Extract and apply the font weight:
  const fontWeight = extractCssProperty(cssId, "font-weight", cssStyles)
  if (fontWeight) {
    // It's not recommended to directly use the theme primitives. However,
    // we don't change our fontsize primitives (since they are already in rem)
    // and we don't have access to the theme here (would be quite a big refactoring to
    // get access to the theme)
    themeOverride.baseFontStyle = `${fontWeight} ${fontSizes.sm}`
  }

  if (themeOverride) {
    // Apply the background and font color in the theme override
    return {
      ...cell,
      themeOverride,
    }
  }
  return cell
}

/**
 * Maps the data type from Arrow to a column type.
 */
export function getColumnTypeFromArrow(arrowType: ArrowType): ColumnCreator {
  if (isStringType(arrowType) || isEmptyType(arrowType)) {
    return TextColumn
  }
  if (isDatetimeType(arrowType)) {
    return DateTimeColumn
  }
  if (isTimeType(arrowType)) {
    return TimeColumn
  }
  if (isDateType(arrowType)) {
    return DateColumn
  }
  if (isObjectType(arrowType) || isBytesType(arrowType)) {
    return ObjectColumn
  }
  if (isBooleanType(arrowType)) {
    return CheckboxColumn
  }
  if (isNumericType(arrowType)) {
    return NumberColumn
  }
  if (isCategoricalType(arrowType)) {
    return SelectboxColumn
  }
  if (isListType(arrowType)) {
    return ListColumn
  }

  return ObjectColumn
}

/**
 * Parses the header names of a single column into a group and title.
 *
 * The group is only filled if there are more than one header for the column
 * (multi-level headers).
 *
 * @param columnHeaderNames - The column header names.
 *
 * @return the group and title.
 */
function parseColumnHeaderNames(columnHeaderNames: string[]): {
  title: string
  group: string | undefined
} {
  const title =
    columnHeaderNames.length > 0
      ? columnHeaderNames[columnHeaderNames.length - 1]
      : ""

  // If there are > 1 header columns, join all these headers with a "/"
  // and use it as the group name, but ignore empty strings headers.
  // This does not include the last column, which we use as the actual
  // column name. E.g.
  // columnHeaders = ["a", "b", "c"] -> group = "a / b" name: "c"
  // columnHeaders = ["", "b", "c"] -> group = "b" name: "c"
  // columnHeaders = ["a", "", ""] -> group = "a" name: ""

  const group =
    columnHeaderNames.length > 1
      ? columnHeaderNames
          .slice(0, -1)
          .filter(column => column !== "")
          .join(" / ")
      : undefined

  return {
    title,
    group,
  }
}

/**
 * Initialize the column props with default values.
 *
 * @param columnProps - The column props.
 *
 * @return the column props.
 */
function initColumn(
  columnProps: Partial<BaseColumnProps> & {
    id: BaseColumnProps["id"]
    indexNumber: BaseColumnProps["indexNumber"]
    name: BaseColumnProps["name"]
    title: BaseColumnProps["title"]
    arrowType: BaseColumnProps["arrowType"]
  }
): BaseColumnProps {
  return {
    group: undefined,
    isEditable: false,
    isIndex: false,
    isPinned: false,
    isHidden: false,
    isStretched: false,
    ...columnProps,
  }
}

/**
 * Initialize an index column from the Arrow data.
 *
 * Index columns only exist if the data got processed by Pandas.
 *
 * @param data - The Arrow data.
 * @param indexPosition - The numeric position of the index column.
 *
 * @return the column props for the index column.
 */
export function initIndexFromArrow(
  data: Quiver,
  indexPosition: number
): BaseColumnProps {
  // columnNames is a matrix of column names.
  // Multi-level headers will have more than one row of column names.
  // We need to extract the list of header names for this given index column
  // and subsequently parse it into a title and group.
  const columnHeaderNames = data.columnNames.map(
    column => column[indexPosition]
  )
  const { title, group } = parseColumnHeaderNames(columnHeaderNames)

  const arrowType = data.columnTypes[indexPosition]

  let isEditable = true

  if (isRangeIndexType(arrowType)) {
    // Range indices are not editable
    isEditable = false
  }

  return initColumn({
    id: `_index-${indexPosition}`,
    indexNumber: indexPosition,
    name: title,
    title,
    group,
    isEditable,
    arrowType,
    isIndex: true,
    isPinned: true,
  })
}

/**
 * Initialize a data column from the Arrow data.
 *
 * @param data - The Arrow data.
 * @param columnPosition - The numeric position of the data column.
 *        Starts with 0 at the first non-index column.
 *
 * @return the column props for the data column.
 */
export function initColumnFromArrow(
  data: Quiver,
  columnPosition: number
): BaseColumnProps {
  // columnNames is a matrix of column names.
  // Multi-level headers will have more than one row of column names.
  // We need to extract the list of header names for this given index column
  // and subsequently parse it into a title and group.
  const columnHeaderNames = data.columnNames.map(
    column => column[columnPosition]
  )

  const { title, group } = parseColumnHeaderNames(columnHeaderNames)

  const arrowType = data.columnTypes[columnPosition]

  return initColumn({
    id: `_column-${title}-${columnPosition}`,
    indexNumber: columnPosition,
    name: title,
    isEditable: true,
    title,
    arrowType,
    group,
  })
}

/**
 * Initialize an empty index column.
 * This is used for DataFrames that don't have any index.
 * At least one column is required for glide.
 */
export function initEmptyIndexColumn(): BaseColumnProps {
  return initColumn({
    id: `_empty-index`,
    indexNumber: 0,
    title: "",
    name: "",
    isEditable: false,
    isIndex: true,
    isPinned: true,
    arrowType: {
      type: DataFrameCellType.INDEX,
      arrowField: new Field("", new Null(), true),
      pandasType: undefined,
    },
  })
}

/**
 * Creates the column props for all columns from the Arrow data.
 *
 * @param data - The Arrow data.
 * @return the column props for all columns.
 */
export function initAllColumnsFromArrow(data: Quiver): BaseColumnProps[] {
  const columns: BaseColumnProps[] = []

  const { dimensions } = data
  const numIndices = dimensions.numIndexColumns
  const numColumns = dimensions.numDataColumns

  if (numIndices === 0 && numColumns === 0) {
    // Tables that don't have any columns cause an exception in glide-data-grid.
    // As a workaround, we are adding an empty index column in this case.
    columns.push(initEmptyIndexColumn())
    return columns
  }

  for (let i = 0; i < numIndices; i++) {
    columns.push(initIndexFromArrow(data, i))
  }

  for (let i = 0; i < numColumns; i++) {
    columns.push(initColumnFromArrow(data, i + numIndices))
  }
  return columns
}

/**
 * Returns a glide-data-grid compatible cell object based on the
 * cell data from the Quiver (Arrow) object. Different types of data will
 * result in different cell types.
 *
 * @param column - The column of the cell.
 * @param arrowCell - The dataframe cell object from Arrow.
 * @param cssStyles - Optional css styles to apply on the cell.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function getCellFromArrow(
  column: BaseColumn,
  arrowCell: DataFrameCell,
  styledCell: StyledCell | undefined,
  cssStyles: string | undefined = undefined
): GridCell {
  // We use arrowCell.contentType instead of column.arrowType here because
  // to allow a bit more flexibility when data is loaded in chunks or added with
  // add data to still work somewhat correctly even if the column arrow type
  // (from the initial chunk) and the actual arrow type from the cell are different.
  let cellTemplate
  if (column.kind === "object" || column.kind === "json") {
    // Always use display value from Quiver for object types
    // these are special types that the dataframe only support in read-only mode.
    cellTemplate = column.getCell(
      notNullOrUndefined(arrowCell.content)
        ? removeLineBreaks(
            formatArrowCell(arrowCell.content, arrowCell.contentType)
          )
        : null
    )
  } else if (
    ["time", "date", "datetime"].includes(column.kind) &&
    notNullOrUndefined(arrowCell.content) &&
    (typeof arrowCell.content === "number" ||
      typeof arrowCell.content === "bigint")
  ) {
    // This is a special case where we want to already parse a numerical timestamp
    // to a date object based on the arrow field metadata.
    // Our implementation only supports unix timestamps in seconds, so we need to
    // do some custom conversion here.
    let parsedDate
    if (
      isTimeType(arrowCell.contentType) &&
      notNullOrUndefined(arrowCell.field?.type?.unit)
    ) {
      // Time values needs to be adjusted to seconds based on the unit
      parsedDate = convertTimeToDate(arrowCell.content, arrowCell.field)
    } else {
      // All other datetime related values are assumed to be in milliseconds
      parsedDate = moment.utc(Number(arrowCell.content)).toDate()
    }

    cellTemplate = column.getCell(parsedDate)
  } else if (isDecimalType(arrowCell.contentType)) {
    // This is a special case where we want to already prepare a decimal value
    // to a number string based on the arrow field metadata. This is required
    // because we don't have access to the required scale in the number column.
    const decimalStr = isNullOrUndefined(arrowCell.content)
      ? null
      : formatArrowCell(arrowCell.content, arrowCell.contentType)
    cellTemplate = column.getCell(decimalStr)
  } else {
    cellTemplate = column.getCell(arrowCell.content)
  }

  if (isErrorCell(cellTemplate)) {
    // Directly return error cells without any additional modification
    return cellTemplate
  }

  if (!column.isEditable) {
    // Only apply display content and css styles to non-editable cells.
    if (styledCell && notNullOrUndefined(styledCell?.displayContent)) {
      const displayData = removeLineBreaks(styledCell.displayContent)
      // If the display content is set, use that instead of the content.
      // This is only supported for text, object, date, datetime, time and number cells.
      // Non-editable datetime cells will use the text cell kind
      // so we don't need to handle date-time-cell cells extra here.
      if (cellTemplate.kind === GridCellKind.Text) {
        cellTemplate = {
          ...cellTemplate,
          displayData,
        } as TextCell
      } else if (
        cellTemplate.kind === GridCellKind.Number &&
        // Only apply styler value if format was not explicitly set by the user.
        isNullOrUndefined(
          (column.columnTypeOptions as NumberColumnParams)?.format
        )
      ) {
        cellTemplate = {
          ...cellTemplate,
          displayData,
        } as NumberCell
      } else if (
        cellTemplate.kind === GridCellKind.Uri &&
        // Only apply styler value if display text was not explicitly set by the user.
        isNullOrUndefined(
          (column.columnTypeOptions as LinkColumnParams)?.display_text
        )
      ) {
        cellTemplate = {
          ...cellTemplate,
          displayData,
        } as UriCell
      } else if (
        cellTemplate.kind === GridCellKind.Custom &&
        (cellTemplate as DatePickerType).data?.kind === "date-picker-cell" &&
        // Only apply styler value if format was not explicitly set by the user.
        isNullOrUndefined(
          (column.columnTypeOptions as DateTimeColumnParams)?.format
        )
      ) {
        cellTemplate = {
          ...cellTemplate,
          data: {
            ...(cellTemplate as DatePickerType).data,
            displayDate: displayData,
          },
        } as DatePickerType
      }
    }

    if (cssStyles && styledCell?.cssId) {
      cellTemplate = applyPandasStylerCss(
        cellTemplate,
        styledCell.cssId,
        cssStyles
      )
    }
  }
  return cellTemplate
}

/**
 * Helper function to determine if we should use container width based on the widthConfig and element's configuration.
 * This handles both the new widthConfig and legacy useContainerWidth fields.
 */
export function shouldUseContainerWidth(
  element: ArrowProto,
  widthConfig?: streamlit.IWidthConfig | null
): boolean {
  if (widthConfig) {
    return widthConfig?.useStretch ?? false
  }
  return element.useContainerWidth ?? false
}

/**
 * Helper function to get the configured width from the widthConfig and element.
 * This handles both the new widthConfig and legacy width fields.
 */
export function getConfiguredWidth(
  element: ArrowProto,
  widthConfig?: streamlit.IWidthConfig | null
): number | undefined {
  if (widthConfig) {
    if (widthConfig.pixelWidth) {
      return widthConfig.pixelWidth
    }
    return undefined
  }
  return element.width || undefined
}

/**
 * Helper function to determine if the element is configured to use content width.
 */
export function shouldUseContentWidth(
  widthConfig?: streamlit.IWidthConfig | null
): boolean {
  return widthConfig?.useContent ?? false
}

/**
 * Helper function to get the configured height from the heightConfig and element.
 * This handles both the new heightConfig and legacy height fields.
 */
export function getConfiguredHeight(
  element: ArrowProto,
  heightConfig?: streamlit.IHeightConfig | null
): number | undefined {
  if (heightConfig) {
    if (heightConfig.pixelHeight) {
      return heightConfig.pixelHeight
    }
    return undefined
  }
  return element.height || undefined
}
