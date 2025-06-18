/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import styled from "@emotion/styled"

import { streamlit } from "@streamlit/protobuf"

interface StyledReactPdfContainerProps {
  widthConfig?: streamlit.IWidthConfig
  isFullScreen?: boolean
}

interface StyledPdfWithToolbarProps {
  isFullScreen?: boolean
}

export const StyledPdfWithToolbar = styled.div<StyledPdfWithToolbarProps>(
  ({ theme, isFullScreen }) => ({
    position: "relative",
    width: "100%",
    height: isFullScreen ? "100%" : "auto",
    // Add some padding on the right to accommodate the button
    paddingRight: isFullScreen ? "0px" : "50px",

    // Keep toolbar outside PDF container, positioned properly
    "& .stElementToolbar": {
      position: "absolute",
      top: "0px",
      right: isFullScreen ? "8px" : "8px", // Some margin from edge
      zIndex: theme.zIndices.sidebar + 2,
      opacity: 1,
      visibility: "visible",

      // Make toolbar more visible
      "& [data-testid='stElementToolbarButtonContainer']": {
        backgroundColor: theme.colors.bgColor,
        border: `1px solid ${theme.colors.borderColor}`,
        boxShadow: `0 2px 8px ${theme.colors.borderColor}`,
      },
    },
  })
)

export const StyledReactPdfContainer =
  styled.div<StyledReactPdfContainerProps>(
    ({ theme, widthConfig, isFullScreen }) => ({
      width: isFullScreen
        ? "100%"
        : widthConfig?.useStretch
          ? "100%"
          : widthConfig?.pixelWidth
            ? `${widthConfig.pixelWidth}px`
            : "100%",
      height: isFullScreen ? "100%" : "auto",
      // For non-fullscreen mode, set a reasonable min-height
      minHeight: isFullScreen ? "100%" : "500px",
      // Remove border in fullscreen, keep it in normal mode
      border: isFullScreen ? "none" : `1px solid ${theme.colors.borderColor}`,
      borderRadius: isFullScreen ? "0" : theme.radii.default,
      padding: theme.spacing.none,
      margin: theme.spacing.none,
      overflow: "auto",
      backgroundColor: theme.colors.bgColor,
      position: "relative",

      // Style the react-pdf Document component
      "& .react-pdf__Document": {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: theme.spacing.sm,
      },

      // Style individual pages
      "& .react-pdf__Page": {
        marginBottom: theme.spacing.sm,
        boxShadow: `0 2px 8px ${theme.colors.borderColor}`,
      },

      // Style page canvas
      "& .react-pdf__Page__canvas": {
        display: "block",
        maxWidth: "100%",
        height: "auto",
      },

      // Style text layer
      "& .react-pdf__Page__textContent": {
        "& .textLayer": {
          left: "0",
          top: "0",
          right: "0",
          bottom: "0",
          overflow: "hidden",
          opacity: "0.2",
          lineHeight: "1.0",

          "& > span": {
            color: "transparent",
            position: "absolute",
            whiteSpace: "pre",
            cursor: "text",
            transformOrigin: "0% 0%",
          },
        },
      },

      // Style annotation layer
      "& .react-pdf__Page__annotations": {
        "& .annotationLayer": {
          position: "absolute",
          left: "0",
          top: "0",
          right: "0",
          bottom: "0",
          overflow: "hidden",

          "& .linkAnnotation > a": {
            position: "absolute",
            fontSize: "1em",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            color: "transparent",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
          },
        },
      },
    })
  )

export const StyledReactPdfPage = styled.div(({ theme }) => ({
  position: "relative",
  marginBottom: theme.spacing.sm,

  "&:last-child": {
    marginBottom: 0,
  },
}))
