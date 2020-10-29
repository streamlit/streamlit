import styled, { CSSObject } from "@emotion/styled"
import { Theme } from "theme"

export const StyledTableContainer = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.smDefault,
  fontFamily: theme.fonts.mono,
  textAlign: "right",
  padding: theme.spacing.sm,
  lineHeight: theme.lineHeights.table,
  overflowX: "auto",
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
export const StyledTableCellHeader = styled.th(({ theme }) =>
  styleHeaderFunction(theme)
)

export const StyledEmptyTableCell = styled(StyledTableCell)(({ theme }) => ({
  color: theme.colors.darkGray,
  fontStyle: "italic",
  fontSize: theme.fontSizes.smDefault,
  textAlign: "center",
}))
