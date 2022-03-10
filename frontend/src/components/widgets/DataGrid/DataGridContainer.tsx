/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import styled from "styled-components"
import { Theme } from "src/theme"

interface DataGridContainerProps {
  width: number
  height: number
  theme: Theme
}

// We need to use the styled-components library here instead of emotion
// The reason is that glide-data-grid requires a styled-component to pass down the theme.
// TODO(lukasmasuch): Move into styled-components file? However, this might be misleading
//                    since it will not be a styled component based on emotion.
const DataGridContainer = styled.div<DataGridContainerProps>`
  overflow: hidden;
  position: relative;
  resize: vertical;
  min-height: 105px;
  width: ${p => p.width}px;
  height: ${p => p.height}px;
  border: 1px solid ${p => p.theme.colors.fadedText05};

  > :first-child {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
  }
`

export default DataGridContainer
