import React, { ReactElement } from "react"
import FormSubmitButton, { Props } from "./FormSubmitButton"
import { StyledFormSubmitContent } from "./styled-components"

export default function FormSubmitContent(props: Props): ReactElement {
  const { width, element } = props
  const { label } = element
  const textProps = { label }
  const style = { width }

  return (
    <StyledFormSubmitContent className="row-widget" style={style}>
      <FormSubmitButton {...props} />
    </StyledFormSubmitContent>
  )
}
