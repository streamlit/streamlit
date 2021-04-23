import React, { ReactElement } from "react"
import { FormSubmitButton, Props } from "./FormSubmitButton"
import { StyledFormSubmitContent } from "./styled-components"

export function FormSubmitContent(props: Props): ReactElement {
  const { width } = props
  const style = { width }

  return (
    <StyledFormSubmitContent className="row-widget" style={style}>
      <FormSubmitButton {...props} />
    </StyledFormSubmitContent>
  )
}
