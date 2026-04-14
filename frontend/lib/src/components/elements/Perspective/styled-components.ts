/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

interface StyledPerspectiveContainerProps {
  height?: number
  useContainerWidth?: boolean
  useContainerHeight?: boolean
}

export const StyledPerspectiveContainer =
  styled.div<StyledPerspectiveContainerProps>(
    ({ theme, height, useContainerWidth, useContainerHeight }) => ({
      display: "flex",
      flexDirection: "column",
      width: useContainerWidth ? "100%" : undefined,
      height: useContainerHeight ? "100%" : height,
      minHeight: height,
      position: "relative",

      // Ensure the perspective-viewer takes full size
      "& perspective-viewer": {
        width: "100%",
        height: "100%",
        minHeight: height,
        border: `${theme.sizes.borderWidth} solid ${theme.colors.fadedText10}`,
        borderRadius: theme.radii.default,
        overflow: "hidden",
      },
    })
  )
