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

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  type Button as SubmitButtonProto,
  type Element as ElementProto,
  ForwardMsg,
} from "../../../proto"
import { type MessageQueue } from "../lib/MessageQueue"
import { WidgetStateManager } from "../../../WidgetStateManager"
import { type ConnectionManager } from "../lib/ConnectionManager"
import { ConnectionState } from "../stores/ConnectionContext"
import { type AppRoot } from "../../../AppNode"
import { type StreamlitInstallation } from "../stores/StreamlitInstallationContext"
import { type WidgetStateManagerContextValue } from "../stores/WidgetStateManagerContext"

/**
 * Immutable structure that exposes public data about all the forms in the app.
 * WidgetStateManager produces new instances of this type when forms data
 * changes.
 */
export interface FormsData {
  /** Forms that have unsubmitted changes. */
  readonly formsWithPendingChanges: Set<string>

  /** Forms that have in-progress file uploads. */
  readonly formsWithUploads: Set<string>

  /**
   * Mapping of formID:numberOfSubmitButtons. (Most forms will have only one,
   * but it's not an error to have multiple.)
   */
  readonly submitButtons: Map<string, SubmitButtonProto[]>
}

function createFormsData(): FormsData {
  return {
    formsWithPendingChanges: new Set(),
    formsWithUploads: new Set(),
    submitButtons: new Map(),
  }
}

/**
 * Coerces a possibly-null value into a non-null value, throwing an error
 * if the value is null or undefined.
 */
export function requireNonNull<T>(obj: T | null | undefined): T {
  if (obj === null || obj === undefined) {
    throw new Error("value is null")
  }
  return obj
}

/** Return an Element's widget ID if it's a widget, and undefined otherwise. */
export function getElementWidgetID(element: ElementProto): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access -- We know this will be something
  return element[requireNonNull(element.type)]?.id
}

/**
 * A type predicate that is true if the given value is not undefined.
 */
export function notUndefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

export function useWidgetStateManagerState(
  connectionManager: ConnectionManager,
  messageQueue: MessageQueue,
  streamlitInstallation: StreamlitInstallation | null,
  currentPageScriptHash: string,
  elements: AppRoot
): WidgetStateManagerContextValue {
  const [formsData, setFormsData] = useState<FormsData>(createFormsData())
  const widgetManager = useMemo<WidgetStateManager>(
    () =>
      new WidgetStateManager({
        sendRerunBackMsg: () => {},
        formsDataChanged: fd => {
          setFormsData(fd)
        },
      }),
    []
  )

  const handleConnectionChanged = useCallback(
    (state: ConnectionState) => {
      if (state === ConnectionState.CONNECTED) {
        widgetManager.sendUpdateWidgetsMessage()
      }
    },
    [widgetManager]
  )

  const handleScriptFinished = useCallback(
    (status: ForwardMsg.ScriptFinishedStatus) => {
      if (status === ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY) {
        // Tell the WidgetManager which widgets still exist. It will remove
        // widget state for widgets that have been removed.
        const activeWidgetIds = new Set(
          Array.from(elements.getElements() as Set<ElementProto>)
            .map(element => getElementWidgetID(element))
            .filter(notUndefined)
        )
        widgetManager.removeInactive(activeWidgetIds)
      }
    },
    [elements, widgetManager]
  )

  useEffect(() => {
    return connectionManager.on(
      "connectionStateChanged",
      handleConnectionChanged
    )
  }, [connectionManager, handleConnectionChanged])

  useEffect(() => {
    return messageQueue.on<ForwardMsg.ScriptFinishedStatus>(
      "scriptFinished",
      handleScriptFinished
    )
  }, [messageQueue, handleScriptFinished])

  // Reset all elements when we detect a change on appHash or pageScriptHash.
  // aka Streamlit is running a new script so the old elements are now invalid.
  useEffect(() => {
    widgetManager.removeInactive(new Set([]))
  }, [widgetManager, streamlitInstallation?.appHash, currentPageScriptHash])

  return { formsData, widgetManager }
}
