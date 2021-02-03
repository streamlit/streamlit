/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import styled, { CSSObject } from "@emotion/styled"
import { Theme } from "theme"

export const StyledTableContainer = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.smDefault,
  fontFamily: theme.fonts.mono,
  textAlign: "right",
  padding: theme.spacing.sm,
  lineHeight: theme.lineHeights.table,
}))

export const StyledTable = styled.table(({ theme }) => ({
  width: theme.sizes.full,
  marginBottom: theme.spacing.lg,
  color: theme.colors.bodyText,
  borderCollapse: "collapse",
}))

const styleHeaderFunction = (theme: Theme): CSSObject => ({
  borderTop: `1px solid ${theme.colors.tableGray}`,
  borderBottom: `1px solid ${theme.colors.tableGray}`,
  verticalAlign: "middle",
  padding: theme.spacing.md,
})

export const StyledTableCell = styled.td(({ theme }) =>
  styleHeaderFunction(theme)
)
export const StyledTableCellHeader = styled.th(({ theme }) => ({
  ...styleHeaderFunction(theme),
  "@media print": {
    // Firefox prints a double blurred table header. Normal font weight fixes it
    "@-moz-document url-prefix()": {
      fontWeight: "normal",
    },
  },
}))

export const StyledEmptyTableCell = styled(StyledTableCell)(({ theme }) => ({
  color: theme.colors.darkGray,
  fontStyle: "italic",
  fontSize: theme.fontSizes.smDefault,
  textAlign: "center",
}))
