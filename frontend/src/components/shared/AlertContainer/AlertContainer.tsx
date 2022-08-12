import React, { ReactElement, ReactNode } from "react"

import { Notification, KIND } from "baseui/notification"
import { StyledAlertContent } from "./styled-components"

export enum Kind {
  ERROR = "error",
  INFO = "info",
  SUCCESS = "success",
  WARNING = "warning",
}

function getNotificationKind(kind: Kind): KIND[keyof KIND] {
  switch (kind) {
    case Kind.ERROR:
      return KIND.negative
    case Kind.INFO:
      return KIND.info
    case Kind.SUCCESS:
      return KIND.positive
    case Kind.WARNING:
      return KIND.warning
    default:
      throw new Error(`Unexpected alert type: ${kind}`)
  }
}

export interface AlertContainerProps {
  width?: number
  kind: Kind
  children: ReactNode
}

/**
 * Provides Base Styles for any Alert Type UI. Used in the following cases:
 *   * Alert is the Streamlit specific alert component that users can use with
 *     any Markdown. Users have API access to generate these.
 *   * ExceptionElement is a special type of alert that formats an exception
 *     with a stack trace provided. Users have API access to generate these.
 *   * ErrorElement is an alert for an internal exception happening in
 *     Streamlit (likely a JS exception happening at runtime). Users do NOT
 *     have API access to generate these.
 */
export default function AlertContainer({
  kind,
  width,
  children,
}: AlertContainerProps): ReactElement {
  return (
    <Notification
      kind={getNotificationKind(kind)}
      overrides={{
        Body: {
          style: {
            marginTop: 0,
            marginBottom: 0,
            width: width ? width.toString() : undefined,
            border: 0,
          },
        },
        InnerContainer: {
          style: {
            width: "100%",
            lineHeight: "1.5",
          },
        },
      }}
    >
      <StyledAlertContent>{children}</StyledAlertContent>
    </Notification>
  )
}
