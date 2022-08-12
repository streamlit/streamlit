import styled from "@emotion/styled"
import { transparentize } from "color2k"

export interface StyledSliderProps {
  disabled: boolean
}

export const StyledThumb = styled.div<StyledSliderProps>(
  ({ disabled, theme }) => ({
    alignItems: "center",
    backgroundColor: disabled ? theme.colors.gray : theme.colors.primary,
    borderTopLeftRadius: "100%",
    borderTopRightRadius: "100%",
    borderBottomLeftRadius: "100%",
    borderBottomRightRadius: "100%",
    borderTopStyle: "none",
    borderBottomStyle: "none",
    borderRightStyle: "none",
    borderLeftStyle: "none",
    boxShadow: "none",
    display: "flex",
    height: theme.radii.xl,
    justifyContent: "center",
    width: theme.radii.xl,
    ":focus": {
      boxShadow: `0 0 0 0.2rem ${transparentize(theme.colors.primary, 0.5)}`,
      outline: "none",
    },
  })
)

export const StyledThumbValue = styled.div<StyledSliderProps>(
  ({ disabled, theme }) => ({
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes.sm,
    paddingBottom: theme.spacing.twoThirdsSmFont,
    color: disabled ? theme.colors.gray : theme.colors.primary,
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
  paddingTop: theme.spacing.twoThirdsSmFont,
  justifyContent: "space-between",
  alignItems: "center",
  display: "flex",
}))

export const StyledTickBarItem = styled.div<StyledSliderProps>(
  ({ disabled, theme }) => ({
    lineHeight: theme.lineHeights.base,
    fontWeight: "normal",
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.monospace,
    color: disabled ? theme.colors.fadedText40 : "inherit",
  })
)
