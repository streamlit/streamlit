/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useTheme } from "emotion-theming"
import React, { ReactElement, useState } from "react"
import { ThemeProvider } from "styled-components"
import {
  DataEditor as GlideDataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  DataEditorProps,
} from "@glideapps/glide-data-grid"
import { transparentize } from "color2k"

import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver } from "src/lib/Quiver"
import { Theme } from "src/theme"
import { logWarning } from "src/lib/log"

import DataGridContainer, { ROW_HEIGHT } from "./DataGridContainer"

type GridColumnWithCellTemplate = GridColumn & {
  // The cell template to use for the given column specific to the data type.
  getTemplate(): GridCell
}

function getColumns(element: Quiver): GridColumnWithCellTemplate[] {
  const columns: GridColumnWithCellTemplate[] = []

  if (element.columns.length === 0 && element.columns[0].length > 0) {
    /** Check if table has columns, if not return empty list.
    Not sure if it is possible to not have any columns. */
    return columns
  }

  for (let i = 0; i < element.columns[0].length; i++) {
    const columnTitle = element.columns[0][i]

    // TODO(lukasmasuch): Support other cell types based on the data type in later PR.
    const emptyCellTemplate = {
      kind: GridCellKind.Text,
      data: "",
      displayData: "",
      allowOverlay: true,
      readonly: true,
    }

    columns.push({
      title: columnTitle,
      hasMenu: false,
      getTemplate: () => {
        return emptyCellTemplate
      },
    } as GridColumnWithCellTemplate)
  }
  return columns
}

type DataLoaderReturn = { numRows: number } & Pick<
  DataEditorProps,
  "columns" | "getCellContent"
>

function useDataLoader(element: Quiver): DataLoaderReturn {
  // The columns with the corresponding empty template for every type:
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [columns, setColumns] = useState(() => getColumns(element))

  // Number of rows of the table minus 1 for the header row:
  const numRows = element.dimensions.rows - 1

  // TODO(lukasmasuch): Add sorting, column resizing and eventually selection functionality here.

  const getCellContent = React.useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      let tableCell = columns[col].getTemplate()
      try {
        // Quiver has the index in 1 column and the header in first row
        const quiverCell = element.getCell(row + 1, col + 1)

        // TODO(lukasmasuch): Support different types here in a later PR.

        if (tableCell.kind === GridCellKind.Text) {
          const formattedContents =
            quiverCell.displayContent ||
            Quiver.format(quiverCell.content, quiverCell.contentType)
          tableCell = {
            ...tableCell,
            data:
              typeof quiverCell.content === "string"
                ? quiverCell.content
                : formattedContents,
            displayData: formattedContents,
          }
        } else {
          logWarning("Unknown data type: ", tableCell)
        }
        return tableCell
      } catch (exception_var) {
        // This should not happen in read-only table.
        return tableCell
      }
    },
    [columns]
  )

  return {
    numRows,
    columns,
    getCellContent,
  }
}
export interface DataGridProps {
  element: Quiver
  height?: number
  width: number
}

function DataGrid({
  element,
  height: propHeight,
  width,
}: DataGridProps): ReactElement {
  const theme: Theme = useTheme()

  const { numRows, columns, getCellContent } = useDataLoader(element)

  // Automatic height calculation: numRows +1 because of header, and +2 to total because of border?
  const height = propHeight || Math.min((numRows + 1) * ROW_HEIGHT + 2, 400)

  const dataGridTheme = {
    // Explanations: https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md#theme
    accentColor: theme.colors.primary,
    accentFg: theme.colors.white, // TODO(lukasmasuch): Do we need a different color here?
    accentLight: transparentize(theme.colors.primary, 0.9),
    borderColor: theme.colors.fadedText05,
    fontFamily: theme.fonts.sansSerif,
    bgSearchResult: transparentize(theme.colors.primary, 0.9),
    // Header styling:
    bgIconHeader: theme.colors.fadedText60,
    fgIconHeader: theme.colors.white,
    bgHeader: theme.colors.bgMix,
    bgHeaderHasFocus: theme.colors.secondaryBg,
    bgHeaderHovered: theme.colors.bgMix, // no hovering color change
    textHeader: theme.colors.fadedText60,
    textHeaderSelected: theme.colors.white,
    headerFontStyle: `bold ${theme.fontSizes.sm}`,
    // Cell styling
    baseFontStyle: theme.fontSizes.sm,
    editorFontSize: theme.fontSizes.sm,
    textDark: theme.colors.bodyText,
    textMedium: theme.colors.fadedText60,
    textLight: theme.colors.fadedText40,
    textBubble: theme.colors.fadedText60,
    bgCell: theme.colors.bgColor,
    bgCellMedium: theme.colors.bgColor, // TODO(lukasmasuch): Do we need a different color here?
    cellHorizontalPadding: 8,
    cellVerticalPadding: 3,
    // Special cells:
    bgBubble: theme.colors.secondaryBg,
    bgBubbleSelected: theme.colors.secondaryBg,
    linkColor: theme.colors.linkText,
    drilldownBorder: "rgba(0, 0, 0, 0)", // TODO(lukasmasuch): Do we need a different color here?
  }

  return (
    // This is a styled-components theme provider (not emotion!).
    // It is required by glide-data-grid to customize the theming.
    <ThemeProvider theme={dataGridTheme}>
      <DataGridContainer
        className="stDataGrid"
        width={width}
        height={height}
        theme={theme}
      >
        <GlideDataEditor
          // Callback to get the content of a given cell location:
          getCellContent={getCellContent}
          // List with column configurations:
          columns={columns}
          // Number of rows:
          rows={numRows}
          // The height in pixel of a row:
          rowHeight={ROW_HEIGHT}
          // The height in pixels of the column headers:
          headerHeight={ROW_HEIGHT}
          // Deactivate row markers and numbers:
          rowMarkers={"none"}
          // Always activate smooth mode for horizontal scrolling:
          smoothScrollX={true}
          // Only activate smooth mode for vertical scrolling for large tables:
          smoothScrollY={numRows < 100000}
          // Show borders between cells:
          verticalBorder={true}
        />
      </DataGridContainer>
    </ThemeProvider>
  )
}

export default withFullScreenWrapper(DataGrid)
