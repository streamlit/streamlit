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

import { StreamlitThemeCssProperties } from "@streamlit/component-v2-lib"

type StyledThemeCssProviderProps = {
  cssCustomProperties: StreamlitThemeCssProperties
}

export const StyledThemeCssProvider = styled.div(
  ({ cssCustomProperties }: StyledThemeCssProviderProps) => ({
    ...cssCustomProperties,
    /**
     * Since this div is only used for applying CSS custom properties to the
     * children, we don't want to add any additional styling or unnecessary DOM
     * elements to the layout tree.
     */
    display: "contents",
  })
)

/**
 * Used to propagate the width and height of the StyledElementContainer to the
 * custom component instance.
 */
export const StyledBidiComponentWrapper = styled.div({
  width: "100%",
  height: "100%",
})
