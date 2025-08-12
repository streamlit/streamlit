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

import React from "react"

import { Arrow, Arrow as ArrowProto, streamlit } from "@streamlit/protobuf"

import { Quiver } from "~lib/dataframes/Quiver"

import DataFrame from "./DataFrame"

interface ReadOnlyGridProps {
  data: Quiver
  height?: number
  customToolbarActions?: React.ReactNode[]
}

/**
 * A lightweight wrapper around the dataframe component that allows to reuse the
 * component as a ready-only data grid for arrow data for other cases
 * (e.g. to show underlying data of a chart).
 *
 * The width is always set to stretch, but the height can be configured.
 *
 * @param data - The arrow data to display in the grid.
 * @param height - The height of the grid.
 * @param customToolbarActions - Custom toolbar actions to display in the grid toolbar.
 *
 * @returns A React element that displays the data in a read-only grid.
 */
export const ReadOnlyGrid = ({
  data,
  height,
  customToolbarActions,
}: ReadOnlyGridProps): React.ReactElement => {
  return (
    <DataFrame
      element={
        new ArrowProto({
          // Use container width is deprecated, the
          // more relevant attribute is the width config below:
          useContainerWidth: true,
          // Enforces read-only mode:
          editingMode: Arrow.EditingMode.READ_ONLY,
          disabled: true,
          // Data is provided via the data property below:
          data: undefined,
          styler: null,
          width: undefined,
          height: height ?? null,
          id: "",
          columns: "",
          formId: "",
          columnOrder: [],
          selectionMode: [],
        })
      }
      data={data}
      widgetMgr={undefined}
      disabled={true}
      fragmentId={undefined}
      disableFullscreenMode={true}
      customToolbarActions={customToolbarActions}
      widthConfig={new streamlit.WidthConfig({ useStretch: true })}
      heightConfig={
        height
          ? new streamlit.HeightConfig({ pixelHeight: height })
          : undefined
      }
    />
  )
}
