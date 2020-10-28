import styled from "@emotion/styled"

export interface StyledDataFrameContainerProps {
  width: number
}

export const StyledDataFrameContainer = styled.div<
  StyledDataFrameContainerProps
>(({ width, theme }) => ({
  width,
  border: `1px solid ${theme.colors.lightestGray}`,
  boxSizing: "content-box",

  ".dataframe": {
    padding: theme.spacing.sm,
    fontSize: theme.fontSizes.smDefault,
    fontFamily: theme.fonts.mono,
    textAlign: "right",
    lineHeight: theme.lineHeights.none,
  },

  "& .table-top-right": {
    overflowX: "hidden",
    backgroundColor: theme.colors.lightestGray,
  },
  "& .table-bottom-left": {
    overflowY: "hidden",
    backgroundColor: theme.colors.lightestGray,
  },
  ".row-header, .col-header, .corner": {
    backgroundColor: theme.colors.lightestGray,
    color: theme.colors.darkGray,
    zIndex: 1,
  },
  ".row-header, .col-header": {
    /* Row headers are click-to-sort, so we make the text unselectable.
        Column headers are also unselectable, so that clicking to sort the
        column's row header doesn't result in the entire column being selected */
    userSelect: "none",
  },
  ".row-header, .col-header, .data": {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    lineHeight: 0.75,
  },
}))

export interface StyledFixupProps {
  verticalLocator: "top" | "bottom"
  horizontalLocator: "left" | "right"
  width: number
  height: number
}

export const StyledFixup = styled.div<StyledFixupProps>(
  ({ verticalLocator, horizontalLocator, width, height }) => ({
    position: "absolute",
    [verticalLocator]: "0px",
    [horizontalLocator]: "0px",
    width,
    height,
  })
)

export const StyledEmptyDataframe = styled.div(({ theme }) => ({
  fontFamily: theme.fonts.mono,
  color: theme.colors.darkGray,
  fontStyle: "italic",
  fontSize: theme.fontSizes.smDefault,
  textAlign: "center",
}))
