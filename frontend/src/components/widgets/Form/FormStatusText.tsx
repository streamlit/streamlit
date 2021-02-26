import React, { ReactElement } from "react"
import { StyledFormStatusText } from "./styled-components"

export interface TextProps {
  hasPendingChanges: boolean
  label: string
}

export default function FormStatusText(props: TextProps): ReactElement {
  const { hasPendingChanges, label } = props
  const submitInfoText = hasPendingChanges
    ? `Widget inputs have changed. Press ${label} to update app.`
    : "No change in Widget inputs"
  return <StyledFormStatusText>{submitInfoText}</StyledFormStatusText>
}
