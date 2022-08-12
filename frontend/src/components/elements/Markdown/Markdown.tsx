import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"
import React, { ReactElement } from "react"
import { Markdown as MarkdownProto } from "src/autogen/proto"

export interface MarkdownProps {
  width: number
  element: MarkdownProto
}

/**
 * Functional element representing Markdown formatted text.
 */
export default function Markdown({
  width,
  element,
}: MarkdownProps): ReactElement {
  const styleProp = { width }
  return (
    <div className="stMarkdown" style={styleProp}>
      <StreamlitMarkdown
        isCaption={element.isCaption}
        source={element.body}
        allowHTML={element.allowHtml}
      />
    </div>
  )
}
