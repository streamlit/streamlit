import styled from "@emotion/styled"

export const StyledAppViewContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-start",
  alignItems: "stretch",
  alignContent: "flex-start",
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: "hidden",
  "@media print": {
    display: "block",
    float: "none",
    height: theme.sizes.full,
    position: "static",
    overflow: "visible",
  },
}))

export interface StyledAppViewMainProps {
  isEmbedded: boolean
}

export const StyledAppViewMain = styled.section<StyledAppViewMainProps>(
  ({ isEmbedded, theme }) => ({
    display: "flex",
    flexDirection: "column",
    width: theme.sizes.full,
    overflow: isEmbedded ? "hidden" : "auto",
    alignItems: "center",
    "&:focus": {
      outline: "none",
    },
    "@media print": {
      "@-moz-document url-prefix()": {
        display: "block",
      },
      overflow: "visible",
    },

    // Added so sidebar overlays main app content on
    // smaller screen sizes
    [`@media (max-width: ${theme.breakpoints.md})`]: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
  })
)

export interface StyledAppViewBlockContainerProps {
  isWideMode: boolean
  isEmbedded: boolean
}

export const StyledAppViewBlockContainer = styled.div<
  StyledAppViewBlockContainerProps
>(({ isWideMode, isEmbedded, theme }) => {
  const topEmbedPadding = isEmbedded ? "1rem" : "6rem"
  const bottomEmbedPadding = isEmbedded ? "1rem" : "10rem"
  const wideSidePadding = isWideMode ? "5rem" : theme.spacing.lg
  return {
    flex: 1,
    width: theme.sizes.full,
    paddingLeft: theme.inSidebar ? theme.spacing.none : theme.spacing.lg,
    paddingRight: theme.inSidebar ? theme.spacing.none : theme.spacing.lg,
    // Increase side padding, if layout = wide and we're not on mobile
    "@media (min-width: 576px)": {
      paddingLeft: theme.inSidebar ? theme.spacing.none : wideSidePadding,
      paddingRight: theme.inSidebar ? theme.spacing.none : wideSidePadding,
    },
    paddingTop: theme.inSidebar ? theme.spacing.none : topEmbedPadding,
    paddingBottom: theme.inSidebar ? theme.spacing.none : bottomEmbedPadding,
    minWidth: isWideMode ? "auto" : undefined,
    maxWidth: isWideMode ? "initial" : theme.sizes.contentMaxWidth,
  }
})

export const StyledAppViewFooterLink = styled.a(({ theme }) => ({
  color: theme.colors.fadedText60,
  // We do not want to change the font for this based on theme.
  fontFamily: theme.fonts.sansSerif,
  textDecoration: "none",
  transition: "color 300ms",
  "&:hover": {
    color: theme.colors.bodyText,
    textDecoration: "underline",
  },
}))

export interface StyledAppViewFooterProps {
  isEmbedded: boolean
  isWideMode: boolean
}

export const StyledAppViewFooter = styled.footer<StyledAppViewFooterProps>(
  ({ isEmbedded, isWideMode, theme }) => {
    const wideSidePadding = isWideMode ? "5rem" : theme.spacing.lg
    return {
      display: isEmbedded ? "none" : "block",
      color: theme.colors.fadedText40,
      flex: 0,
      fontSize: theme.fontSizes.sm,
      minWidth: isWideMode ? "auto" : undefined,
      maxWidth: isWideMode ? "initial" : theme.sizes.contentMaxWidth,
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      // Increase side padding, if layout = wide and we're not on mobile
      "@media (min-width: 576px)": {
        paddingLeft: wideSidePadding,
        paddingRight: wideSidePadding,
      },
      width: theme.sizes.full,
      a: {
        color: theme.colors.fadedText60,
      },
    }
  }
)
