import React, { ReactElement } from "react"
import { StyledFormStatusText } from "./styled-components"

export interface TextProps {
  hasPendingChanges: boolean
}

export default function FormStatusText(props: TextProps): ReactElement {
  const { hasPendingChanges } = props
  const submitInfoText = hasPendingChanges
    ? "← Press to apply changes" // XXX Why not remove this too?
    : null // XXX Removed
  return <StyledFormStatusText>{submitInfoText}</StyledFormStatusText>
}
