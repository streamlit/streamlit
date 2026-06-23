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

interface StyledIframeProps {
  disableScrolling: boolean
  /** Override width (e.g., "200px"). Defaults to "100%". */
  width?: string
  /** Override height (e.g., "150px"). Defaults to "100%". */
  height?: string
}

export const StyledIframe = styled.iframe<StyledIframeProps>(
  ({ theme, disableScrolling, width, height }) => ({
    width: width ?? "100%",
    height: height ?? "100%",
    colorScheme: "normal",
    border: "none",
    padding: theme.spacing.none,
    margin: theme.spacing.none,
    overflow: disableScrolling ? "hidden" : undefined,
  })
)
