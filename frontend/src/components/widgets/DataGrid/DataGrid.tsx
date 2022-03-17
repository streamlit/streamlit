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
import React, { ReactElement } from "react"
import { ThemeProvider } from "styled-components"
import {
  DataEditor as GlideDataEditor,
  GridCell,
  GridCellKind,
} from "@glideapps/glide-data-grid"

import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver } from "src/lib/Quiver"
import { Theme } from "src/theme"

import DataGridContainer from "./DataGridContainer"

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

  // TODO(lukasmasuch): Apply automatic height calculation instead of the default value in later PRs
  const height = propHeight || 300

  return (
    // This is a styled-components theme provider (not emotion!).
    // It is required by glide-data-grid to customize the theming.
    <ThemeProvider
      theme={
        {
          /* TODO(lukasmasuch): Theme will be added in a later PR */
        }
      }
    >
      <DataGridContainer
        className="stDataGrid"
        width={width}
        height={height}
        theme={theme}
      >
        <GlideDataEditor
          // TODO(lukasmasuch): This is currently only mock implementations.
          // The actual implementations will be added in a later PR.
          getCellContent={([col, row]: readonly [
            number,
            number
          ]): GridCell => ({
            kind: GridCellKind.Text,
            data: "",
            displayData: "",
            allowOverlay: true,
          })}
          columns={[]}
          rows={0}
        />
      </DataGridContainer>
    </ThemeProvider>
  )
}

export default withFullScreenWrapper(DataGrid)
