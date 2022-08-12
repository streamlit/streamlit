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
