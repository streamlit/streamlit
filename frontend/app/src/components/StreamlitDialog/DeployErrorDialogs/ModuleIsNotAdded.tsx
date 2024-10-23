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

import React from "react"

import { StyledInlineCode } from "@streamlit/lib/src/components/elements/CodeBlock/styled-components"

import { IDeployErrorDialog } from "./types"
import { StyledParagraph } from "./styled-components"

function ModuleIsNotAdded(module: string): IDeployErrorDialog {
  return {
    title: "Unable to deploy",
    body: (
      <StyledParagraph>
        The app’s main file <StyledInlineCode>{module}</StyledInlineCode> has
        not been pushed to GitHub. Please add it to continue.
      </StyledParagraph>
    ),
  }
}

export default ModuleIsNotAdded
