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

export const StyledDocModule = styled.span(({ theme }) => ({
  color: theme.colors.docStringModuleText,
}))

export const StyledDocName = styled.span(({ theme }) => ({
  fontWeight: theme.fontWeights.bold,
}))

export interface StyledDocContainerProps {
  width: number
}

export const StyledDocContainer = styled.span<StyledDocContainerProps>(
  ({ theme, width }) => ({
    backgroundColor: theme.colors.docStringContainerBackground,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes.sm,
    overflowX: "auto",
    width,
  })
)

export const StyledDocHeader = styled.div(({ theme }) => ({
  paddingBottom: theme.spacing.sm,
  marginBottom: theme.spacing.sm,
  borderBottom: `1px solid ${theme.colors.fadedText10}`,
}))

export const StyledDocString = styled.div({
  whiteSpace: "pre",
})
