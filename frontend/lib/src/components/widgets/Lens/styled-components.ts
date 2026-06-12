/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"

const spinAnimation = keyframes({
  to: { transform: "rotate(360deg)" },
})

export const StyledLensContainer = styled.div<{ isMinimized?: boolean }>(
  ({ theme, isMinimized }) => ({
    position: "fixed",
    zIndex: theme.zIndices?.popup ?? 1000060,
    background: "transparent",
    borderRadius: theme.radii?.xl ?? "12px",
    boxShadow:
      theme.shadows?.popover ??
      "0 16px 40px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1)",
    backdropFilter: isMinimized ? "none" : "blur(20px) saturate(160%)",
    WebkitBackdropFilter: isMinimized ? "none" : "blur(20px) saturate(160%)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    cursor: "default",
    fontFamily: theme.fonts?.sansSerif ?? "sans-serif",
    fontSize: theme.fontSizes?.md ?? "14px",
    "&::-webkit-scrollbar": {
      width: theme.spacing?.xs ?? "6px",
    },
    "&::-webkit-scrollbar-thumb": {
      background: theme.colors?.fadedText20 ?? "rgba(255, 255, 255, 0.2)",
      borderRadius: theme.radii?.default ?? "8px",
    },
  })
)

export const StyledLensHeader = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing?.sm ?? "8px",
  padding: theme.spacing?.sm ?? "8px 12px",
  background: "transparent",
  borderBottom: `1px solid ${theme.colors?.fadedText20 ?? "rgba(255, 255, 255, 0.1)"}`,
  cursor: "grab",
  userSelect: "none",
  fontSize: theme.fontSizes?.sm ?? "13px",
  fontWeight: theme.fontWeights?.semiBold ?? 600,
  color: theme.colors?.bodyText ?? "#31333f",
}))

export const StyledDragHandle = styled.span({
  display: "inline-flex",
  flexShrink: 0,
  cursor: "grab",
  color: "inherit",
  opacity: 0.4,
  fontSize: "14px",
  lineHeight: 1,
  letterSpacing: "2px",
})

export const StyledHeaderLabel = styled.span({
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
})

export const StyledHeaderButton = styled.button(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "22px",
  height: "22px",
  padding: 0,
  border: "none",
  borderRadius: theme.radii?.sm ?? "4px",
  background: "transparent",
  color: theme.colors?.fadedText60 ?? "rgba(0,0,0,0.4)",
  cursor: "pointer",
  fontSize: "14px",
  lineHeight: 1,
  "&:hover": {
    background: theme.colors?.fadedText20 ?? "rgba(0,0,0,0.08)",
    color: theme.colors?.bodyText ?? "#31333f",
  },
}))

export const StyledCloseButton = styled.button(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "22px",
  height: "22px",
  padding: 0,
  border: "none",
  borderRadius: theme.radii?.sm ?? "4px",
  background: "transparent",
  color: theme.colors?.fadedText60 ?? "rgba(0,0,0,0.4)",
  cursor: "pointer",
  fontSize: "14px",
  lineHeight: 1,
  "&:hover": {
    background: theme.colors?.redBackgroundColor ?? "rgba(255, 59, 48, 0.12)",
    color: theme.colors?.redColor ?? "#ff3b30",
  },
}))

export const StyledBoltButton = styled.button<{ isActive?: boolean }>(
  ({ theme, isActive }) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "22px",
    height: "22px",
    padding: 0,
    border: "none",
    borderRadius: theme.radii?.sm ?? "4px",
    background: isActive
      ? (theme.colors?.successBackground ?? "rgba(52, 199, 89, 0.15)")
      : "transparent",
    color: isActive
      ? (theme.colors?.successColor ?? "#34c759")
      : (theme.colors?.fadedText60 ?? "rgba(0,0,0,0.4)"),
    cursor: "pointer",
    fontSize: "14px",
    lineHeight: 1,
    transition: "background 0.15s, color 0.15s",
    "&:hover": {
      background: isActive
        ? (theme.colors?.successBackground ?? "rgba(52, 199, 89, 0.25)")
        : (theme.colors?.fadedText20 ?? "rgba(0,0,0,0.08)"),
      color: isActive
        ? (theme.colors?.successColor ?? "#34c759")
        : (theme.colors?.bodyText ?? "#31333f"),
    },
  })
)

export const StyledLensBody = styled.div({
  flex: 1,
  padding: "12px",
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

export const StyledLensInput = styled.input(({ theme }) => ({
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${theme.colors?.borderColor ?? "rgba(0,0,0,0.2)"}`,
  borderRadius: theme.radii?.default ?? "8px",
  fontSize: theme.fontSizes?.sm ?? "13px",
  fontFamily: theme.fonts?.sansSerif ?? "sans-serif",
  backgroundColor: theme.colors?.bgColor ?? "#ffffff",
  color: theme.colors?.bodyText ?? "#31333f",
  outline: "none",
  boxSizing: "border-box",
  "&:focus": {
    borderColor: theme.colors?.primary ?? "#0068c9",
    boxShadow: `0 0 0 2px ${theme.colors?.primary}33`,
  },
}))

export const StyledLensButton = styled.button(({ theme }) => ({
  padding: "6px 14px",
  background: theme.colors?.primary ?? "#0068c9",
  color: "#ffffff",
  border: "none",
  borderRadius: theme.radii?.default ?? "6px",
  fontSize: theme.fontSizes?.sm ?? "13px",
  fontWeight: theme.fontWeights?.semiBold ?? 600,
  cursor: "pointer",
  fontFamily: theme.fonts?.sansSerif ?? "sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  "&:hover": {
    opacity: 0.9,
  },
  "&:disabled": {
    opacity: 0.5,
    cursor: "not-allowed",
  },
}))

export const StyledSpinner = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "16px 0",
  fontSize: "13px",
  color: "inherit",
  opacity: 0.7,
})

export const StyledSpinnerIcon = styled.span({
  display: "inline-block",
  width: "14px",
  height: "14px",
  border: "2px solid currentColor",
  borderTopColor: "transparent",
  borderRadius: "50%",
  animation: `${spinAnimation} 0.6s linear infinite`,
})

export const StyledLensResult = styled.div(({ theme }) => ({
  padding: "10px 12px",
  background: theme.colors?.secondaryBg ?? "#f0f2f6",
  borderRadius: theme.radii?.default ?? "8px",
  border: `1px solid ${theme.colors?.fadedText20 ?? "rgba(255, 255, 255, 0.1)"}`,
  fontSize: theme.fontSizes?.sm ?? "13px",
  lineHeight: "1.6",
  color: theme.colors?.bodyText ?? "#31333f",
  overflow: "auto",
  "& p": {
    margin: "0 0 0.5em 0",
    "&:last-child": { marginBottom: 0 },
  },
  "& pre": {
    padding: "8px 10px",
    borderRadius: theme.radii?.default ?? "6px",
    background: theme.colors?.bgColor ?? "#ffffff",
    border: `1px solid ${theme.colors?.fadedText10 ?? "rgba(0,0,0,0.06)"}`,
    overflow: "auto",
    fontSize: "12px",
    margin: "0.5em 0",
  },
  "& code": {
    fontSize: "0.9em",
    padding: "1px 4px",
    borderRadius: "3px",
    background: theme.colors?.bgColor ?? "#ffffff",
  },
  "& pre code": {
    padding: 0,
    background: "transparent",
  },
  "& table": {
    borderCollapse: "collapse",
    width: "100%",
    fontSize: "12px",
    margin: "0.5em 0",
  },
  "& th, & td": {
    padding: "4px 8px",
    border: `1px solid ${theme.colors?.fadedText20 ?? "rgba(0,0,0,0.1)"}`,
    textAlign: "left",
  },
  "& th": {
    fontWeight: 600,
    background: theme.colors?.bgColor ?? "#ffffff",
  },
  "& ul, & ol": {
    paddingLeft: "1.4em",
    margin: "0.3em 0",
  },
  "& h1, & h2, & h3, & h4, & h5, & h6": {
    margin: "0.6em 0 0.3em 0",
    lineHeight: "1.3",
  },
  "& blockquote": {
    margin: "0.5em 0",
    paddingLeft: "10px",
    borderLeft: `3px solid ${theme.colors?.fadedText20 ?? "rgba(0,0,0,0.1)"}`,
    color: theme.colors?.fadedText60 ?? "rgba(0,0,0,0.5)",
  },
}))

export const StyledLensResultFooter = styled.div({
  display: "flex",
  justifyContent: "flex-end",
  gap: "4px",
})

export const StyledIconButton = styled.button(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "26px",
  height: "26px",
  padding: 0,
  border: `1px solid ${theme.colors?.borderColor ?? "rgba(0,0,0,0.15)"}`,
  borderRadius: theme.radii?.sm ?? "4px",
  background: theme.colors?.bgColor ?? "#ffffff",
  color: theme.colors?.fadedText60 ?? "rgba(0,0,0,0.4)",
  cursor: "pointer",
  fontSize: "13px",
  lineHeight: 1,
  "&:hover": {
    background: theme.colors?.secondaryBg ?? "#f0f2f6",
    color: theme.colors?.bodyText ?? "#31333f",
  },
}))

export const StyledResizeHandle = styled.div(({ theme }) => ({
  position: "absolute",
  bottom: 0,
  right: 0,
  width: "12px",
  height: "12px",
  cursor: "nwse-resize",
  "&::after": {
    content: '""',
    position: "absolute",
    bottom: "2px",
    right: "2px",
    width: "8px",
    height: "8px",
    borderRight: `2px solid ${theme.colors?.fadedText40 ?? "rgba(0,0,0,0.3)"}`,
    borderBottom: `2px solid ${theme.colors?.fadedText40 ?? "rgba(0,0,0,0.3)"}`,
  },
}))
