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

import styled from "@emotion/styled"

export interface StyledResizableContainerProps {
  hasCustomizedScrollbars: boolean
}

/**
 * A resizable data grid container component.
 */
export const StyledResizableContainer =
  styled.div<StyledResizableContainerProps>(
    ({ hasCustomizedScrollbars, theme }) => ({
      position: "relative",
      display: "inline-block",

      "& .glideDataEditor": {
        height: "100%",
        minWidth: "100%",
        borderRadius: theme.radii.lg,
      },

      "& .dvn-scroller": {
        // We only want to configure scrollbar aspects for browsers that
        // don't support custom scrollbars (e.g. Firefox). Also, applying this
        // in Chrome causes the scrollbar to change to the default scrollbar style.
        ...(!hasCustomizedScrollbars && { scrollbarWidth: "thin" }),
        ["overflowX" as any]: "auto !important",
        ["overflowY" as any]: "auto !important",
      },
    })
  )
