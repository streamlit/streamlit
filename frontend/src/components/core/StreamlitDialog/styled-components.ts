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
import { ChevronLeft } from "react-feather"
import { Small } from "src/components/shared/TextElements"

export const StyledUploadFirstLine = styled.div(({ theme }) => ({
  marginBottom: theme.spacing.sm,
}))

export const StyledRerunHeader = styled.div(({ theme }) => ({
  marginBottom: theme.spacing.sm,
}))

export const StyledCommandLine = styled.textarea(({ theme }) => ({
  width: theme.sizes.full,
  fontFamily: theme.genericFonts.codeFont,
  fontSize: theme.fontSizes.sm,
  height: "6rem",
}))

export const StyledUploadUrl = styled.pre(({ theme }) => ({
  fontFamily: theme.genericFonts.codeFont,
  fontSize: theme.fontSizes.sm,
  whiteSpace: "normal",
  wordWrap: "break-word",
}))

export const StyledShortcutLabel = styled.span(({ theme }) => ({
  "&::first-letter": {
    textDecoration: "underline",
  },
}))

export const StyledBackButton = styled(ChevronLeft)(({ theme }) => ({
  cursor: "pointer",
  marginRight: theme.spacing.lg,
}))

export const StyledDialogBody = styled.div(({ theme }) => ({
  display: "grid",
  gap: theme.spacing.xl,
  gridTemplateColumns: "1fr 1fr",
  margin: 0,
  padding: 0,
}))

export const StyledFullRow = styled.div(({ theme }) => ({
  gridColumnStart: 1,
  gridColumnEnd: -1,
  display: "grid",
  gap: theme.spacing.sm,
}))

export const StyledHeader = styled.h2(({ theme }) => ({
  paddingBottom: 0,
  paddingTop: 0,
  marginBottom: 0,
  marginTop: "0",
  fontWeight: theme.fontWeights.normal,
  fontSize: theme.fontSizes.sm,
  lineHeight: theme.lineHeights.tight,
  textTransform: "uppercase",
  color: theme.colors.fadedText60,
  display: "grid",
  gridAutoFlow: "row",
  gap: theme.spacing.sm,

  // Override the default global style for a h2:first-of-type
  "&:first-of-type": {
    marginTop: 0,
  },
}))

export const StyledLabel = styled.label(({ theme }) => ({
  paddingBottom: 0,
  paddingTop: 0,
  marginBottom: 0,
  marginTop: 0,
  lineHeight: 1.25,
}))

export const StyledSmall = styled(Small)(({ theme }) => ({
  display: "block",
  paddingBottom: 0,
  paddingTop: 0,
  marginBottom: 0,
  marginTop: 0,
  lineHeight: 1.5,
}))

export const StyledHr = styled.hr(({ theme }) => ({
  padding: 0,
  marginBottom: 0,
  marginLeft: `-${theme.spacing.xl}`,
  marginRight: `-${theme.spacing.xl}`,
  marginTop: 0,
}))

export const StyledCheckbox = styled.input(({ theme }) => ({
  marginRight: theme.spacing.xs,
  appearance: "none",
  border: `1px solid ${theme.colors.fadedText10}`,
  width: theme.fontSizes.md,
  height: theme.fontSizes.md,
  borderRadius: theme.radii.sm,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  verticalAlign: "middle",
  overflow: "hidden",

  "&:focus-visible": {
    outline: `2px solid ${theme.colors.primary}`,
  },

  "&:checked": {
    backgroundColor: theme.colors.primary,

    "&:after": {
      content: '"✓"',
      fontFamily: theme.fonts.monospace,
      fontSize: theme.fontSizes.md,
      color: theme.colors.white,
      lineHeight: 1,
    },
  },

  "&:disabled": {
    backgroundColor: theme.colors.secondaryBg,
  },
}))

export const StyledDeployErrorContent = styled.div(({ theme }) => ({
  "& > ul": {
    paddingLeft: "1.4rem",
  },
}))

export const StyledAboutInfo = styled.div(() => ({
  padding: "0 0 1rem 0",
  overflowY: "scroll",
}))
