import styled from "@emotion/styled"

const CONTROLS_WIDTH = 45 // px

export const StyledInputContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  flexWrap: "nowrap",
  alignItems: "center",
  input: {
    MozAppearance: "textfield",
    "&::-webkit-inner-spin-button, &::-webkit-outer-spin-button": {
      WebkitAppearance: "none",
      margin: theme.spacing.none,
    },
  },
}))

export const StyledInputControls = styled.div({
  height: "49px",
  display: "flex",
  flexDirection: "row",
})

export const StyledInputControl = styled.button(({ theme }) => ({
  margin: theme.spacing.none,
  border: "none",
  height: theme.sizes.full,
  display: "flex",
  cursor: "pointer",
  alignItems: "center",
  width: `${CONTROLS_WIDTH}px`,
  justifyContent: "center",
  transition: "color 300ms, backgroundColor 300ms",
  backgroundColor: theme.colors.lightGray,
  "&:hover, &:focus": {
    color: theme.colors.white,
    backgroundColor: theme.colors.primary,
    transition: "none",
    outline: "none",
  },
  "&:active": {
    outline: "none",
    border: "none",
  },
  "&:last-of-type": {
    borderTopRightRadius: theme.radii.md,
    borderBottomRightRadius: theme.radii.md,
  },
}))

export const StyledInstructionsContainer = styled.div(({ theme }) => ({
  marginRight: theme.spacing.xs,
  right: `${CONTROLS_WIDTH * 2}px`,
}))
