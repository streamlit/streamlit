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

export interface StyledFullScreenFrameProps {
  isExpanded: boolean
}

export const StyledFullScreenFrame = styled.div<StyledFullScreenFrameProps>(
  ({ theme, isExpanded }) => ({
    width: "100%",
    ...(isExpanded
      ? {
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          background: theme.colors.bgColor,
          zIndex: theme.zIndices.fullscreenWrapper,
          padding: theme.spacing.md,
          paddingTop: theme.sizes.fullScreenHeaderHeight,
          overflow: "auto",
          display: "flex", // To avoid extra spaces that lead to scrollbars.
          alignItems: "center",
          justifyContent: "center",
        }
      : {}),
  })
)
