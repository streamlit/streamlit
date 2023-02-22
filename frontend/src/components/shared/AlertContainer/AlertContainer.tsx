/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement, ReactNode } from "react"

import { Notification, KIND } from "baseui/notification"
import { StyledAlertContent } from "./styled-components"
import { Theme } from "src/theme/index"
import { useTheme } from "@emotion/react"

export enum Kind {
  ERROR = "error",
  INFO = "info",
  SUCCESS = "success",
  WARNING = "warning",
}

function getNotificationKind(
  kind: Kind
):
  | typeof KIND.negative
  | typeof KIND.info
  | typeof KIND.positive
  | typeof KIND.warning {
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
  inModal?: boolean | null
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
  inModal,
}: AlertContainerProps): ReactElement {
  const { spacing }: Theme = useTheme()
  return (
    <Notification
      kind={getNotificationKind(kind)}
      overrides={{
        Body: {
          style: {
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            paddingBottom: inModal ? spacing.threeXL : "16px",
            paddingRight: inModal ? spacing.fourXL : "16px",
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
