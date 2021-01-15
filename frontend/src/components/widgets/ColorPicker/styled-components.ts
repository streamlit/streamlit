import styled from "@emotion/styled"

export const StyledColorPicker = styled.div(({ theme }) => ({
  fontFamily: theme.fonts.sansSerif,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
}))

export const StyledColorPreview = styled.div(({ theme }) => ({
  color: theme.colors.white,
  height: "1.8rem",
  width: "1.8rem",
  borderRadius: theme.radii.md,
  padding: "2px 0.8rem",
  cursor: "pointer",
  boxShadow:
    "rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.1) 0px 0px 4px inset",
  lineHeight: theme.lineHeights.base,
  "&:focus": {
    outline: "none",
  },
}))
