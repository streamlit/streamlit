/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

export const StyledScreenCastWarningDialog = styled.div(() => ({
  display: "flex",
}))

export const StyledUnsupportedScreenCastIcon = styled.div(() => ({
  display: "flex",
  alignItems: "center",
  justifyItems: "center",
  marginRight: "26px",
  marginLeft: "10px",
  fontSize: "50px",
}))

export const StyledUnsupportedScreenCastExplanation = styled.p(
  ({ theme }) => ({
    margin: theme.spacing.none,
  })
)
