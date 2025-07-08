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

export const StyledFormSubmitContent = styled.div({
  display: "flex",
})

export interface StyledFormProps {
  border: boolean
  overflow: React.CSSProperties["overflow"]
}

export const StyledForm = styled.div<StyledFormProps>(
  ({ theme, border, overflow }) => ({
    ...(border && {
      border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
      borderRadius: theme.radii.default,
      padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
    }),
    width: "100%",
    height: "100%",
    overflow: overflow,
  })
)

export const StyledErrorContainer = styled.div(({ theme }) => ({
  marginTop: theme.spacing.lg,
}))
