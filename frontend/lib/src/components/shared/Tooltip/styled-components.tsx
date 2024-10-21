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

export const StyledWrapper = styled.div({
  display: "table",
  tableLayout: "fixed",
  width: "100%",
})

export const StyledEllipsizedDiv = styled.div({
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  display: "table-cell",
})

export const StyledTooltipContentWrapper = styled.div(({ theme }) => ({
  boxSizing: "border-box",
  fontSize: `${theme.fontSizes.sm}`,
  maxWidth: `calc(${theme.sizes.contentMaxWidth} - 2 * ${theme.spacing.threeXL})`,
  maxHeight: theme.sizes.maxTooltipHeight,
  overflow: ["auto", "overlay"],
  padding: `${theme.spacing.xs} ${theme.spacing.md}`,

  [`@media (max-width: ${theme.breakpoints.sm})`]: {
    maxWidth: `calc(100% - ${theme.spacing.threeXL})`,
  },
  img: {
    maxWidth: "100%",
  },
  "*": {
    fontSize: `${theme.fontSizes.sm} !important`,
  },
}))
