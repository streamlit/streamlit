import styled from "@emotion/styled"

export const StyledVegaLiteChartContainer = styled.div(({ theme }) => ({
  // These styles come from VegaLite Library
  "&.vega-embed": {
    ".vega-actions": {
      zIndex: theme.zIndices.popupMenu,
    },
    summary: {
      // Fix weird floating button height issue in Vega Lite.
      height: "auto",
      // Fix floating button appearing above pop-ups.
      zIndex: theme.zIndices.menuButton,
    },
  },
}))
