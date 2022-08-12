import React, { ReactElement } from "react"

import { Alert as AlertProto } from "src/autogen/proto"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"
import { EmojiIcon } from "src/components/shared/Icon"
import AlertContainer, { Kind } from "src/components/shared/AlertContainer"

export function getAlertKind(format: AlertProto.Format): Kind {
  switch (format) {
    case AlertProto.Format.ERROR:
      return Kind.ERROR
    case AlertProto.Format.INFO:
      return Kind.INFO
    case AlertProto.Format.SUCCESS:
      return Kind.SUCCESS
    case AlertProto.Format.WARNING:
      return Kind.WARNING
    default:
      throw new Error(`Unexpected alert type: ${format}`)
  }
}

export interface AlertProps {
  body: string
  icon?: string
  kind: Kind
  width: number
}

/**
 * Display an (error|warning|info|success) box with a Markdown-formatted body.
 */
export default function Alert({
  icon,
  body,
  kind,
  width,
}: AlertProps): ReactElement {
  return (
    <div className="stAlert">
      <AlertContainer width={width} kind={kind}>
        {icon && <EmojiIcon size="lg">{icon}</EmojiIcon>}
        <StreamlitMarkdown source={body} allowHTML={false} />
      </AlertContainer>
    </div>
  )
}
