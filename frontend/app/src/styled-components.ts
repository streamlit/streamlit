/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
    width: "75%",
    "@media print": {
      float: "none",
      height: theme.sizes.full,
      position: "static",
      overflow: "visible",
    },
  }
})

export const StyledDebugPanel = styled.div(({ theme }) => ({
  position: "absolute",
  padding: "10px 50px 0 50px",
  width: "25%",
  right: "0",
  top: "60px", // app Navigation bar
  backgroundColor: theme.colors.secondaryBg,
  color: theme.colors.codeTextColor,
  height: "100%",
  overflow: "scroll",

  "> *": { zIndex: 1000000000 },
}))

export const MsgLogger = styled.div(() => ({
  // maxWidth: `calc(${theme.sizes.contentMaxWidth} - 10rem)`,
  marginTop: "2rem",
}))

export const MsgBundle = styled.div({
  marginBottom: "2rem",
})

export const Msg = styled.div(({ theme }) => ({
  marginBottom: theme.spacing.sm,
  backgroundColor: theme.colors.bgColor,
  padding: theme.spacing.sm,
  // card design:
  boxShadow: "0 4px 8px 0 rgba(0,0,0,0.2)",
  borderRadius: "5px",
}))
