import React, { ReactElement } from "react"
import FormSubmitButton, { Props } from "./FormSubmitButton"
import FormStatusText from "./FormStatusText"
import { StyledFormSubmitContent } from "./styled-components"

export default function FormSubmitContent(props: Props): ReactElement {
  const { hasPendingChanges, width, element } = props
  const { label } = element
  const textProps = { label, hasPendingChanges }
  const style = { width }

  return (
    <StyledFormSubmitContent className="row-widget" style={style}>
      <FormSubmitButton {...props} />
      <FormStatusText {...textProps} />
    </StyledFormSubmitContent>
  )
}
