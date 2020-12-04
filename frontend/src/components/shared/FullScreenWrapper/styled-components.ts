import styled from "@emotion/styled"

export interface StyledFullScreenButtonProps {
  isExpanded: boolean
}

export const StyledFullScreenButton = styled.button<
  StyledFullScreenButtonProps
>(({ isExpanded, theme }) => {
  const fontSize = parseFloat(theme.fontSizes.smDefault)

  return {
    position: "absolute",
    right: isExpanded ? "1rem" : "-2.5rem",
    top: isExpanded ? "0.5rem" : "-0.375rem",
    padding: `${fontSize / 4}rem ${fontSize / 2}rem`,
    zIndex: theme.zIndices.sidebar + 1,
    opacity: 0,
    height: "2.5rem",
    width: "2.5rem",
    transition: "opacity 300ms",
    border: "none",
    backgroundColor: theme.colors.white,
    color: theme.colors.bodyText,
    borderRadius: theme.radii.xl,

    "&:active, &:focus, &:hover": {
      opacity: 0.75,
      outline: "none",
    },
  }
})

export interface StyledFullScreenFrameProps {
  isExpanded: boolean
}

export const StyledFullScreenFrame = styled.div<StyledFullScreenFrameProps>(
  ({ theme, isExpanded }) => ({
    "&:hover": {
      [StyledFullScreenButton as any]: {
        opacity: 0.75,
      },
    },

    ...(isExpanded
      ? {
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          background: theme.colors.white,
          zIndex: theme.zIndices.fullscreenWrapper,
          padding: theme.spacing.md,
          paddingTop: theme.sizes.headerHeight,
          overflow: "auto",
          display: "flex", // To avoid extra spaces that lead to scrollbars.
        }
      : {}),
  })
)
