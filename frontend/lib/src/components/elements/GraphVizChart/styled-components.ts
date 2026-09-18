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

interface StyledGraphVizChartProps {
  shouldUseFullWidth: boolean
  shouldUseFullHeight: boolean
}

export const StyledGraphVizChart = styled.div<StyledGraphVizChartProps>(
  ({ theme, shouldUseFullWidth, shouldUseFullHeight }) => ({
    // Graphviz WASM sizes nodes with its own font metrics. A CSS font override
    // after layout cannot resize those nodes and leaves trailing space that
    // grows with label length (https://github.com/streamlit/streamlit/issues/7397).

    // Ensure SVG is allowed the full width/height in full screen mode
    "& svg": {
      maxWidth: "100%",
      width: shouldUseFullWidth ? "100%" : "auto",
      height: shouldUseFullHeight ? "100%" : "auto",
      borderRadius: theme.radii.default,
    },
    width: shouldUseFullWidth ? "100%" : "auto",
    height: shouldUseFullHeight ? "100%" : "auto",
  })
)
