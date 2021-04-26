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

export interface StyledFormProps {
  width: number
}

export const StyledFormSubmitContent = styled.div(() => ({
  display: "flex",
}))

export const StyledForm = styled.div<StyledFormProps>(({ width, theme }) => ({
  border: `1px solid ${theme.colors.fadedText10}`,
  borderRadius: theme.radii.md,
  padding: "calc(1em - 1px)", // 1px to account for border.
  width,
  // Same margin as StyledElementContainer.
  marginTop: 0,
  marginRight: 0,
  marginBottom: theme.spacing.lg,
  marginLeft: 0,
}))

export const StyledErrorContainer = styled.div(({ theme }) => ({
  marginTop: theme.spacing.lg,
}))
