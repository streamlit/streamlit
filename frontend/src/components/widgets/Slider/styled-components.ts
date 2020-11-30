import styled from "@emotion/styled"

export interface StyledThumbValueProps {
  isDisabled: boolean
}

export const StyledThumbValue = styled.div<StyledThumbValueProps>(
  ({ isDisabled, theme }) => ({
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSizes.smDefault,
    paddingBottom: theme.fontSizes.twoThirdSmDefault,
    color: isDisabled ? theme.colors.gray : theme.colors.primary,
    top: "-22px",
    position: "absolute",
    whiteSpace: "nowrap",
    backgroundColor: theme.colors.transparent,
    lineHeight: theme.lineHeights.base,
    fontWeight: "normal",
  })
)

export const StyledTickBar = styled.div(({ theme }) => ({
  paddingBottom: theme.spacing.none,
  paddingLeft: theme.spacing.none,
  paddingRight: theme.spacing.none,
  paddingTop: theme.fontSizes.twoThirdSmDefault,
  justifyContent: "space-between",
  alignItems: "center",
  display: "flex",
}))

export const StyledTickBarItem = styled.div(({ theme }) => ({
  lineHeight: theme.lineHeights.base,
  fontWeight: "normal",
  fontSize: theme.fontSizes.smDefault,
  fontFamily: theme.fonts.mono,
}))
