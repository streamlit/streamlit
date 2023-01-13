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

/**
 * A resizable data grid container component.
 */
export const StyledResizableContainer = styled.div(({ theme }) => ({
  position: "relative",
  display: "inline-block",

  "& .glideDataEditor": {
    height: "100%",
    minWidth: "100%",
    borderRadius: theme.radii.md,
  },

  "& .dvn-scroller": {
    scrollbarWidth: "thin",
    ["overflowX" as any]: "overlay !important",
    ["overflowY" as any]: "overlay !important",
  },
}))

export interface StyledDataframeToolbarProps {
  disabled?: boolean | null
}

export const StyledDataframeToolbar = styled.div<StyledDataframeToolbarProps>(
  ({ theme, disabled }) => ({
    color: disabled ? theme.colors.fadedText40 : theme.colors.fadedText60,
    top: theme.spacing.threeXS,
    right: theme.spacing.twoXS,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
    justifyContent: "flex-end",
  })
)
