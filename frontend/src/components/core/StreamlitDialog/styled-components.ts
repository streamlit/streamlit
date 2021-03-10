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
import { Small } from "components/shared/TextElements"

export const StyledUploadFirstLine = styled.div(({ theme }) => ({
  marginBottom: theme.spacing.sm,
}))

export const StyledUploadUrl = styled.pre(({ theme }) => ({
  fontFamily: theme.genericFonts.codeFont,
  fontSize: theme.fontSizes.smDefault,
  whiteSpace: "normal",
  wordWrap: "break-word",
}))

export const StyledShortcutLabel = styled.span(({ theme }) => ({
  "&::first-letter": {
    textDecoration: "underline",
  },
}))

export const StyledThemeCreatorButtonWrapper = styled.div(({ theme }) => ({
  marginTop: theme.spacing.md,
}))

export const StyledBackButton = styled(ChevronLeft)(({ theme }) => ({
  cursor: "pointer",
  marginLeft: theme.spacing.md,
  marginTop: theme.spacing.md,
}))

export const StyledThemeCreator = styled.div(({ theme }) => ({
  display: "grid",
  gridGap: theme.spacing.md,
  gridTemplateColumns: "1fr",
  marginBottom: theme.spacing.xl,
}))

export const StyledThemeCreatorColors = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  gridGap: theme.spacing.md,
  marginTop: theme.spacing.md,
  marginBottom: theme.spacing.md,
}))

export const StyledThemeCreatorColumn = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
}))

export const StyledButtonContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginTop: theme.spacing.md,
}))

export const StyledHeader = styled.h4(({ theme }) => ({
  marginBottom: theme.spacing.sm,
}))

export const StyledLabel = styled.label(({ theme }) => ({
  marginTop: theme.spacing.md,

  "+ small": {
    marginTop: theme.spacing.none,
  },
}))

export const StyledSmall = styled(Small)(({ theme }) => ({
  marginBottom: theme.spacing.sm,
  marginTop: theme.spacing.sm,
  display: "block",
}))

export const StyledHr = styled.hr(({ theme }) => ({
  padding: 0,
  marginBottom: theme.spacing.lg,
  marginLeft: `-${theme.spacing.xl}`,
  marginRight: `-${theme.spacing.xl}`,
  marginTop: theme.spacing.xl,
}))

export const StyledHr = styled.hr(({ theme }) => ({
  padding: 0,
  marginBottom: theme.spacing.lg,
  marginLeft: `-${theme.spacing.xl}`,
  marginRight: `-${theme.spacing.xl}`,
  marginTop: theme.spacing.xl,
}))
