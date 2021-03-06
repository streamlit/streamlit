/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import React, { ComponentType, useState, useEffect, ReactElement } from "react"
import hoistNonReactStatics from "hoist-non-react-statics"

import { CLOUD_COMM_WHITELIST } from "urls"

import {
  IMenuItem,
  StreamlitShareMetadata,
  IHostToGuestMessage,
  IGuestToHostMessage,
  VersionedMessage,
} from "./types"

interface State {
  queryParams: string
  items: IMenuItem[]
  streamlitShareMetadata: StreamlitShareMetadata
}

export interface S4ACommunicationHOC {
  currentState: State
  connect: () => void
  sendMessage: (message: IGuestToHostMessage) => void
}

const S4A_COMM_VERSION = 1

export function sendS4AMessage(message: IGuestToHostMessage): void {
  window.parent.postMessage(
    {
      stCommVersion: S4A_COMM_VERSION,
      ...message,
    } as VersionedMessage<IGuestToHostMessage>,
    "*"
  )
}

function withS4ACommunication(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  function ComponentWithS4ACommunication(props: any): ReactElement {
    const [items, setItems] = useState<IMenuItem[]>([])
    const [queryParams, setQueryParams] = useState("")
    const [streamlitShareMetadata, setStreamlitShareMetadata] = useState({})

    useEffect(() => {
      function receiveMessage(event: MessageEvent): void {
        let origin
        const message: VersionedMessage<IHostToGuestMessage> | any = event.data

        try {
          const url = new URL(event.origin)

          origin = url.hostname
        } catch (e) {
          origin = event.origin
        }

        if (
          !origin ||
          message.stCommVersion !== S4A_COMM_VERSION ||
          !CLOUD_COMM_WHITELIST.includes(origin)
        ) {
          return
        }

        if (message.type === "SET_MENU_ITEMS") {
          setItems(message.items)
        }

        if (message.type === "UPDATE_FROM_QUERY_PARAMS") {
          setQueryParams(message.queryParams)
        }
        if (message.type === "SET_METADATA") {
          setStreamlitShareMetadata(message.metadata)
        }
      }

      window.addEventListener("message", receiveMessage)

      return () => {
        window.removeEventListener("message", receiveMessage)
      }
    }, [])

    return (
      <WrappedComponent
        s4aCommunication={
          {
            currentState: {
              items,
              queryParams,
              streamlitShareMetadata,
            },
            connect: () => {
              sendS4AMessage({
                type: "GUEST_READY",
              })
            },
            sendMessage: sendS4AMessage,
          } as S4ACommunicationHOC
        }
        {...props}
      />
    )
  }

  ComponentWithS4ACommunication.displayName = `withS4ACommunication(${WrappedComponent.displayName ||
    WrappedComponent.name})`

  // Static methods must be copied over
  // https://en.reactjs.org/docs/higher-order-components.html#static-methods-must-be-copied-over
  return hoistNonReactStatics(ComponentWithS4ACommunication, WrappedComponent)
}

export default withS4ACommunication
