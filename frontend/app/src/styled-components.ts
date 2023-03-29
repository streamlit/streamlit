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
// adding ts-expect errors for now because typing is confusing me as I have tried labeling it as Theme but then it breaks more things.
export const StyledApp = styled.div(({ theme }) => ({
  position: "absolute",
  // @ts-expect-error
  background: theme.colors.bgColor,
  // @ts-expect-error
  color: theme.colors.bodyText,
  // @ts-expect-error
  top: theme.spacing.none,
  // @ts-expect-error
  left: theme.spacing.none,
  // @ts-expect-error
  right: theme.spacing.none,
  // @ts-expect-error
  bottom: theme.spacing.none,
  overflow: "hidden",
  "@media print": {
    float: "none",
    // @ts-expect-error
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
  // @ts-expect-error
  zIndex: theme.zIndices.tablePortal,
  lineHeight: "100%",
}))
