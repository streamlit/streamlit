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

export const StyledStackTraceRow = styled.div(({ theme }) => ({
  marginTop: theme.spacing.sm,
  "&:first-of-type": {
    marginTop: 0,
  },
}))

export const StyledMessageType = styled.span(({ theme }) => ({
  fontWeight: theme.fontWeights.bold,
}))

export const StyledStackTraceTitle = styled.div(({ theme }) => ({
  // Need to add xl to top margin because markdown has negative xl margin bottom.
  marginTop: `calc(${theme.spacing.sm} + ${theme.spacing.xl})`,
  marginBottom: theme.spacing.sm,
}))

export const StyledStackTrace = styled.pre(({ theme }) => ({
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
  color: "inherit",
  fontSize: theme.fontSizes.sm,
  backgroundColor: theme.colors.transparent,

  code: {
    color: "inherit",
  },
}))
