/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement, ReactNode } from "react"

import { SCSS_VARS } from "autogen/scssVariables"
import { Notification, KIND } from "baseui/notification"

import "assets/css/write.scss"

export enum Kind {
  ERROR = "error",
  INFO = "info",
  SUCCESS = "success",
  WARNING = "warning",
}

function getAlertBorder(kind: Kind): string {
  const borderStyle = "1px solid "

  switch (kind) {
    case Kind.ERROR:
      return borderStyle + SCSS_VARS["$alert-error-border-color"]
    case Kind.INFO:
      return borderStyle + SCSS_VARS["$alert-info-border-color"]
    case Kind.SUCCESS:
      return borderStyle + SCSS_VARS["$alert-success-border-color"]
    case Kind.WARNING:
      return borderStyle + SCSS_VARS["$alert-warning-border-color"]
    default:
      throw new Error(`Unexpected alert type: ${kind}`)
  }
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
            width,
            border: getAlertBorder(kind),
          },
        },
        InnerContainer: {
          style: {
            width: "100%",
          },
        },
      }}
    >
      {children}
    </Notification>
  )
}
