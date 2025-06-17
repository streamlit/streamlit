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
}

export const StyledReactPdfContainer =
  styled.div<StyledReactPdfContainerProps>(({ theme, widthConfig }) => ({
    width: widthConfig?.useStretch
      ? "100%"
      : widthConfig?.pixelWidth
        ? `${widthConfig.pixelWidth}px`
        : "100%",
    height: "100%", // Let the layout system control height
    // For stretch mode, use viewport height to ensure it actually stretches
    // The layout system will set height to 100%, but we need a fallback
    minHeight: "80vh", // Use viewport height for better stretch behavior
    border: `1px solid ${theme.colors.borderColor}`,
    borderRadius: theme.radii.default,
    padding: theme.spacing.none,
    margin: theme.spacing.none,
    overflow: "auto",
    backgroundColor: theme.colors.bgColor,

    // Style the react-pdf Document component
    "& .react-pdf__Document": {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
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
  }))

export const StyledReactPdfPage = styled.div(({ theme }) => ({
  position: "relative",
  marginBottom: theme.spacing.sm,

  "&:last-child": {
    marginBottom: 0,
  },
}))
