import styled from "@emotion/styled"

export const StyledHorizontalBlock = styled.div(({ theme }) => ({
  display: "flex",
  gap: theme.spacing.sm,
  flexWrap: "wrap",
}))

export interface StyledElementContainerProps {
  isStale: boolean
  isHidden: boolean
}

export const StyledElementContainer = styled.div<StyledElementContainerProps>(
  ({ theme, isStale, isHidden }) => ({
    display: "flex",
    flexDirection: "column",
    // Allows to have absolutely-positioned nodes inside report elements, like
    // floating buttons.
    position: "relative",
    marginTop: 0,
    marginRight: 0,
    marginBottom: isHidden ? 0 : theme.spacing.lg,
    marginLeft: 0,
    "@media print": {
      "@-moz-document url-prefix()": {
        display: "block",
      },
      overflow: "visible",
    },

    ...(isStale
      ? {
          opacity: 0.33,
          transition: "opacity 1s ease-in 0.5s",
        }
      : {}),
  })
)

export interface StyledColumnProps {
  weight: number
  width: number
  withLeftPadding: boolean
}
export const StyledColumn = styled.div<StyledColumnProps>(
  ({ weight, width, withLeftPadding, theme }) => {
    // The minimal viewport width used to determine the minimal
    // fixed column width while accounting for column proportions.
    // Randomly selected based on visual experimentation.

    // When working with columns, width is driven by what percentage of space
    // the column takes in relation to the total number of columns
    const columnPercentage = weight / width

    return {
      // Flex determines how much space is allocated to this column.
      flex: weight,
      width,
      paddingLeft: withLeftPadding ? theme.spacing.sm : theme.spacing.none,
      [`@media (max-width: ${theme.breakpoints.columns})`]: {
        minWidth: `${columnPercentage > 0.5 ? "min" : "max"}(
          ${columnPercentage * 100}% - ${theme.spacing.twoXL},
          ${columnPercentage * parseInt(theme.breakpoints.columns, 10)}px)`,
      },
    }
  }
)

export interface StyledFormProps {
  width: number
}

export const StyledForm = styled.div<StyledFormProps>(({ width }) => ({
  outline: "1px solid",
  padding: "1em",
  width,
}))
