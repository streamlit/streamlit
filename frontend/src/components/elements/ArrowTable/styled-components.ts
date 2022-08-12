import styled, { CSSObject } from "@emotion/styled"
import { Theme } from "src/theme"

export const StyledTableContainer = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.md,
  fontFamily: theme.fonts.sansSerif,
  padding: `${theme.spacing.twoXS} ${theme.spacing.xs}`,
  lineHeight: theme.lineHeights.table,
  overflow: ["auto", "overlay"],
}))

export const StyledTable = styled.table(({ theme }) => ({
  width: theme.sizes.full,
  marginBottom: theme.spacing.lg,
  color: theme.colors.bodyText,
  borderCollapse: "collapse",
  border: `1px solid ${theme.colors.fadedText05}`,
}))

const styleCellFunction = (theme: Theme): CSSObject => ({
  borderBottom: `1px solid ${theme.colors.fadedText05}`,
  borderRight: `1px solid ${theme.colors.fadedText05}`,
  verticalAlign: "middle",
  padding: `${theme.spacing.twoXS} ${theme.spacing.xs}`,
  fontWeight: theme.fontWeights.normal,
})

export const StyledTableCell = styled.td(({ theme }) =>
  styleCellFunction(theme)
)
export const StyledTableCellHeader = styled.th(({ theme }) => ({
  ...styleCellFunction(theme),

  color: theme.colors.fadedText60,

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
  fontSize: theme.fontSizes.md,
  textAlign: "center",
}))
