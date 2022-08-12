import React, { ReactElement } from "react"
import { Text as TextProto } from "src/autogen/proto"
import { StyledText } from "./styled-components"

export interface TextProps {
  width: number
  element: TextProto
}

/**
 * Functional element representing preformatted (plain) text.
 */
export default function Text({ width, element }: TextProps): ReactElement {
  const styleProp = { width }

  return (
    <StyledText data-testid="stText" style={styleProp}>
      {element.body}
    </StyledText>
  )
}
