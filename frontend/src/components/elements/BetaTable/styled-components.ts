/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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
import { Theme } from "src/theme"

export const StyledTableContainer = styled.div(({ theme }) => ({
  fontFamily: theme.fonts.mono,
  fontSize: theme.fontSizes.smDefault,
  lineHeight: theme.lineHeights.table,
  padding: theme.spacing.sm,
  textAlign: "right",
}))

export const StyledTable = styled.table(({ theme }) => ({
  borderCollapse: "collapse",
  color: theme.colors.bodyText,
  marginBottom: theme.spacing.lg,
  width: theme.sizes.full,
}))

const styleHeaderFunction = (theme: Theme): CSSObject => ({
  borderBottom: `1px solid ${theme.colors.tableGray}`,
  borderTop: `1px solid ${theme.colors.tableGray}`,
  padding: theme.spacing.md,
  verticalAlign: "middle",
})

export const StyledTableCell = styled.td(({ theme }) =>
  styleHeaderFunction(theme)
)

export const StyledTableCellHeader = styled.th(({ theme }) => ({
  ...styleHeaderFunction(theme),
  "@media print": {
    // Firefox prints a double blurred table header.
    // Normal font weight fixes it.
    "@-moz-document url-prefix()": {
      fontWeight: "normal",
    },
  },
}))

export const StyledEmptyTableCell = styled(StyledTableCell)(({ theme }) => ({
  color: theme.colors.darkGray,
  fontSize: theme.fontSizes.smDefault,
  fontStyle: "italic",
  textAlign: "center",
}))
