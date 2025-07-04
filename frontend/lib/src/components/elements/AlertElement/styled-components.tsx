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

import {
  StyledEmojiIcon,
  StyledIcon,
} from "~lib/components/shared/Icon/styled-components"
import { StyledCodeBlock } from "~lib/components/elements/CodeBlock/styled-components"
import { StyledMaterialIcon } from "~lib/components/shared/Icon/Material/styled-components"

export const StyledAlertContent = styled.div(({ theme }) => ({
  display: "flex",
  gap: theme.spacing.sm,
  width: "100%",

  [`${StyledEmojiIcon}, ${StyledIcon}, ${StyledMaterialIcon}`]: {
    position: "relative",
    top: "2px",
  },

  [`${StyledCodeBlock} code`]: {
    paddingRight: theme.spacing.lg,
  },
}))
