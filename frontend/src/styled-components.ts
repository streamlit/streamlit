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

import styled from "@emotion/styled"

export const StyledApp = styled.div(({ theme }) => ({
  position: "absolute",
  background: theme.colors.bgColor,
  color: theme.colors.bodyText,
  top: theme.spacing.none,
  left: theme.spacing.none,
  right: theme.spacing.none,
  bottom: theme.spacing.none,
  overflow: "hidden",
  "@media print": {
    float: "none",
    height: theme.sizes.full,
    position: "static",
    overflow: "visible",
  },
}))

/**
 * The glide-data-grid requires one root level portal element for rendering the cell overlays:
 * https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md#htmlcss-prerequisites
 * This is added to the body in ThemedApp.
 */
export const StyledDataFrameOverlay = styled.div(({ theme }) => ({
  position: "fixed",
  top: 0,
  left: 0,
  zIndex: theme.zIndices.tablePortal,
  lineHeight: "100%",
}))
