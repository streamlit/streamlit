/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import AlertContainer, { Kind } from "src/components/shared/AlertContainer"
import { StyledPreError } from "./styled-components"

export interface ErrorElementProps {
  name: string
  message: string | ReactElement
  stack?: string
  width?: number
}

/**
 * A component that draws an error on the screen. This is for internal use
 * only. That is, this should not be an element that a user purposefully places
 * in a Streamlit app. For that, see st.exception / Exception.tsx or
 * st.error / Text.tsx.
 */
function ErrorElement(props: ErrorElementProps): ReactElement {
  const { name, message, stack, width } = props

  // Remove first line from stack (because it's just the error message) and
  // trim indentation.
  const stackArray = stack ? stack.split("\n") : []
  stackArray.shift()
  const cleanedStack = stackArray.map(s => s.trim()).join("\n")

  return (
    <AlertContainer kind={Kind.ERROR} width={width}>
      <strong>{name}: </strong>
      {message}
      {stack ? (
        <StyledPreError>
          <code>{cleanedStack}</code>
        </StyledPreError>
      ) : null}
    </AlertContainer>
  )
}

export default ErrorElement
