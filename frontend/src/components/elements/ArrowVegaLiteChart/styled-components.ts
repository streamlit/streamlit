import styled from "@emotion/styled"

export const StyledVegaLiteChartContainer = styled.div(({ theme }) => ({
  // These styles come from VegaLite Library
  "&.vega-embed": {
    "&:hover summary, .vega-embed:focus summary": {
      background: "transparent",
    },
    "&.has-actions": {
      paddingRight: 0,
    },
    ".vega-actions": {
      zIndex: theme.zIndices.popupMenu,
      // Customize menu UI to look like the Streamlit menu:
      backgroundColor: theme.colors.bgColor,
      boxShadow: "rgb(0 0 0 / 16%) 0px 4px 16px",
      border: `1px solid ${theme.colors.fadedText10}`,
      a: {
        fontFamily: theme.genericFonts.bodyFont,
        fontWeight: theme.fontWeights.normal,
        fontSize: theme.fontSizes.md,
        margin: 0,
        padding: `${theme.spacing.twoXS} ${theme.spacing.twoXL}`,
        color: theme.colors.bodyText,
      },
      "a:hover": {
        backgroundColor: theme.colors.secondaryBg,
        color: theme.colors.bodyText,
      },
      ":before": {
        content: "none",
      },
      ":after": {
        content: "none",
      },
    },
    summary: {
      opacity: 0,
      // Fix weird floating button height issue in Vega Lite.
      height: "auto",
      // Fix floating button appearing above pop-ups.
      zIndex: theme.zIndices.menuButton,
      border: "none",
      boxShadow: "none",
      borderRadius: theme.radii.md,
      color: theme.colors.fadedText10,
      backgroundColor: "transparent",
      transition: "opacity 300ms 150ms,transform 300ms 150ms",
      "&:active, &:focus-visible, &:hover": {
        border: "none",
        boxShadow: "none",
        color: theme.colors.bodyText,
        opacity: "1 !important",
        background: theme.colors.darkenedBgMix25,
      },
    },
  },
}))
