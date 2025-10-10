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

import { Arrow as ArrowProto, streamlit } from "@streamlit/protobuf"

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
 * Helper function to determine if the element is configured to use stretch height.
 * Stretch height is not enabled when the element is in the root container. Without a
 * fixed height enclosing container, there is nothing to stretch and the dataframe ends
 * up collapsed to minimum height to so we use auto height mode instead.
 */
export function shouldUseStretchHeight(
  heightConfig?: streamlit.IHeightConfig | null,
  isInRoot?: boolean
): boolean {
  if (isInRoot) {
    return false
  }
  return heightConfig?.useStretch ?? false
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

/**
 * Calculate the total height of a table based on the number of rows and styling.
 *
 * @param numRows - Number of data rows
 * @param rowHeight - Height of each row in pixels
 * @param theme - Grid theme containing header height and border width
 * @param numHeaderRows - Number of header rows (1 for normal, 2 for grouped)
 * @returns Total calculated height in pixels
 */
export function calculateTableHeight({
  numRows,
  rowHeight,
  theme,
  numHeaderRows = 1,
}: {
  numRows: number
  rowHeight: number
  theme: {
    defaultHeaderHeight: number
    tableBorderWidth: number
  }
  numHeaderRows?: number
}): number {
  return (
    numRows * rowHeight +
    numHeaderRows * theme.defaultHeaderHeight +
    2 * theme.tableBorderWidth
  )
}
