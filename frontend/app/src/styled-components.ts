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

import { hasLightBackgroundColor } from "@streamlit/lib"

export const StyledApp = styled.div(({ theme }) => {
  const lightBackground = hasLightBackgroundColor(theme)

  return {
    position: "absolute",
    background: theme.colors.bgColor,
    color: theme.colors.bodyText,
    top: theme.spacing.none,
    left: theme.spacing.none,
    right: theme.spacing.none,
    bottom: theme.spacing.none,
    colorScheme: lightBackground ? "light" : "dark",
    overflow: "hidden",
    "@media print": {
      float: "none",
      height: theme.sizes.full,
      position: "static",
      overflow: "visible",
    },
  }
})
