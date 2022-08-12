import React, { ReactElement } from "react"
import { DocString as DocStringProto } from "src/autogen/proto"
import {
  StyledDocContainer,
  StyledDocHeader,
  StyledDocModule,
  StyledDocName,
  StyledDocString,
} from "./styled-components"

export interface DocStringProps {
  width: number
  element: DocStringProto
}

/**
 * Functional element representing formatted text.
 */
export default function DocString({
  width,
  element,
}: DocStringProps): ReactElement {
  const { name, module, docString, type, signature } = element

  const moduleHtml = <StyledDocModule key="module">{module}.</StyledDocModule>
  const nameHtml = <StyledDocName key="name">{name}</StyledDocName>
  const signatureHtml = (
    <span className="doc-signature" key="signature">
      {signature}
    </span>
  )
  const typeHtml = (
    <span key="type" className="doc-type">
      {type}
    </span>
  )

  // Put it all together into a nice little html view.
  return (
    <StyledDocContainer width={width} data-testid="stDocstring">
      <StyledDocHeader>
        {name
          ? [
              module ? moduleHtml : "",
              nameHtml,
              signature ? signatureHtml : "",
            ]
          : [typeHtml]}
      </StyledDocHeader>
      <StyledDocString>{docString}</StyledDocString>
    </StyledDocContainer>
  )
}
