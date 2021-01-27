/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import styled from "@emotion/styled"

export const StyledReportViewContainer = styled.div(({ theme }) => ({
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

export interface StyledReportViewMainProps {
  isEmbedded: boolean
}

export const StyledReportViewMain = styled.section<StyledReportViewMainProps>(
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
  })
)

export interface StyledReportViewBlockContainerProps {
  isWideMode: boolean
}

export const StyledReportViewBlockContainer = styled.div<
  StyledReportViewBlockContainerProps
>(({ isWideMode, theme }) => {
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
    paddingTop: theme.inSidebar ? theme.spacing.none : "5rem",
    paddingBottom: theme.inSidebar ? theme.spacing.none : "10rem",
    minWidth: isWideMode ? "auto" : undefined,
    maxWidth: isWideMode ? "initial" : theme.sizes.contentMaxWidth,
  }
})

export const StyledReportViewFooterLink = styled.a(({ theme }) => ({
  color: theme.colors.gray50,
  transition: "color 300ms",
  "&:hover": {
    textDecoration: "underline",
  },
}))

export interface StyledReportViewFooterProps {
  isEmbedded: boolean
}
export const StyledReportViewFooter = styled.footer<
  StyledReportViewFooterProps
>(({ isEmbedded, theme }) => ({
  display: isEmbedded ? "none" : "block",
  color: theme.colors.gray50,
  flex: 0,
  fontSize: theme.fontSizes.smDefault,
  maxWidth: theme.sizes.contentMaxWidth,
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
  width: theme.sizes.full,
  a: {
    color: theme.colors.gray50,
    transition: "color 300ms",
  },
  "&:hover": {
    color: theme.colors.gray,
    [StyledReportViewFooterLink as any]: {
      color: theme.colors.darkGray,
    },
  },
}))
