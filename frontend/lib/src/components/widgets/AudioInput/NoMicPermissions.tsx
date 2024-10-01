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

import React, { ReactElement } from "react"

import { ENABLE_PERIPHERALS_DOCS_URL } from "@streamlit/lib/src/urls"

import {
  StyledErrorContainerDiv,
  StyledErrorTextSpan,
  StyledNoMicInputLearnMoreLink,
} from "./styled-components"

const NoMicPermissions = (): ReactElement => {
  return (
    <StyledErrorContainerDiv>
      <StyledErrorTextSpan>
        This app would like to use your microphone.
      </StyledErrorTextSpan>{" "}
      <StyledNoMicInputLearnMoreLink href={ENABLE_PERIPHERALS_DOCS_URL}>
        Learn how to allow access.
      </StyledNoMicInputLearnMoreLink>
    </StyledErrorContainerDiv>
  )
}

export default NoMicPermissions
