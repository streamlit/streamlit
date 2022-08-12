import styled from "@emotion/styled"

interface StyledResizableContainerProps {
  width?: number
  height: number
  maxWidth: number
  minWidth: number
  minHeight: number
  maxHeight: number
}

/**
 * A resizable data grid container component.
 */
export const StyledResizableContainer = styled.div<
  StyledResizableContainerProps
>(({ theme, width, height, minHeight, maxHeight, minWidth, maxWidth }) => ({
  overflow: "auto",
  position: "relative",
  resize: "both",
  display: "inline-block",
  ...(width && { width: `${width}px` }),
  minHeight: `${minHeight}px`,
  maxHeight: `${maxHeight}px`,
  minWidth: `${minWidth}px`,
  maxWidth: `${maxWidth}px`,
  height: `${height}px`,
  border: `1px solid ${theme.colors.fadedText05}`,

  "> div": {
    height: "100%",
    minWidth: "100%",
  },

  "& .dvn-scroller": {
    scrollbarWidth: "thin",
    ["overflowX" as any]: "overlay !important",
    ["overflowY" as any]: "overlay !important",
  },

  // Hide the resize handle in the right corner. Resizing is still be possible.
  "&::-webkit-resizer": {
    display: "none",
  },
}))
