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

export const SelectedLanguageRoot = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.fourXL,
  right: theme.spacing.sm,
  zIndex: theme.zIndices.popupMenu - 1,
  "& > div > button": {
    margin: theme.spacing.sm,
  },
}))

export const SelectedLanguagePrefix = styled.span(({ theme }) => ({
  marginRight: theme.spacing.threeXS,
  [`@media (max-width: 768px)`]: {
    display: "none",
  },
}))
