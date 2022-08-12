import styled from "@emotion/styled"

export const StyledGraphVizChart = styled.div(({ theme }) => ({
  "& *": {
    fontFamily: theme.genericFonts.bodyFont,
    // Font sizes inside the SVG element are getting huge for some reason.
    // Hacking together a number by eyeballing it:
    // 12px in the SVG looks like 1rem outside, so 9.6px ~= 0.8rem.
    fontSize: "9.6px",
  },
  "& svg": {
    maxWidth: "100%",
  },
}))
