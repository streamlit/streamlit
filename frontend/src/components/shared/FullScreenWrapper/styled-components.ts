import styled from "@emotion/styled"

export interface StyledFullScreenButtonProps {
  isExpanded: boolean
}

export const StyledFullScreenButton = styled.button<
  StyledFullScreenButtonProps
>(({ isExpanded, theme }) => {
  const variableProps = isExpanded
    ? {
        right: "0.4rem",
        top: "0.5rem",
        backgroundColor: "transparent",
      }
    : {
        right: "-3.0rem",
        top: "-0.375rem",
        opacity: 0,
        transform: "scale(0)",
        backgroundColor: theme.colors.lightenedBg05,
      }

  return {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    zIndex: theme.zIndices.sidebar + 1,
    height: "2.5rem",
    width: "2.5rem",
    transition: "opacity 300ms 150ms, transform 300ms 150ms",
    border: "none",
    color: theme.colors.fadedText60,
    borderRadius: "50%",

    ...variableProps,

    "&:focus": {
      outline: "none",
    },

    "&:active, &:focus-visible, &:hover": {
      opacity: 1,
      outline: "none",
      transform: "scale(1)",
      color: theme.colors.bodyText,
      transition: "none",
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
        opacity: 1,
        transform: "scale(1)",
        transition: "none",
      },
    },

    ...(isExpanded
      ? {
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          background: theme.colors.bgColor,
          zIndex: theme.zIndices.fullscreenWrapper,
          padding: theme.spacing.md,
          paddingTop: theme.sizes.headerHeight,
          overflow: ["auto", "overlay"],
          display: "flex", // To avoid extra spaces that lead to scrollbars.
          alignItems: "center",
          justifyContent: "center",
        }
      : {}),
  })
)
