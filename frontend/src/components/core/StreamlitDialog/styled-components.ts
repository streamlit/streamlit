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

export const StyledUploadFirstLine = styled.div(({ theme }) => ({
  marginBottom: theme.spacing.sm,
}))

export const StyledRerunHeader = styled.div(({ theme }) => ({
  marginBottom: theme.spacing.sm,
}))

export const StyledCommandLine = styled.textarea(({ theme }) => ({
  width: theme.sizes.full,
  fontFamily: theme.fonts.mono,
  fontSize: theme.fontSizes.smDefault,
  height: "6rem",
}))

export const StyledUploadUrl = styled.pre(({ theme }) => ({
  fontFamily: theme.fonts.mono,
  fontSize: theme.fontSizes.smDefault,
  whiteSpace: "normal",
  wordWrap: "break-word",
}))

export const StyledShortcutLabel = styled.span(({ theme }) => ({
  "&::first-letter": {
    textDecoration: "underline",
  },
}))
