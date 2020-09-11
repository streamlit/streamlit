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

import React, { PureComponent, ComponentType, ReactNode } from "react"
import hoistNonReactStatics from "hoist-non-react-statics"

import {
  IMenuItem,
  IHostToGuestMessage,
  IGuestToHostMessage,
  VersionedMessage,
} from "./types"

interface State {
  queryParams: string
  items: IMenuItem[]
}

export interface S4ACommunicationHOC {
  currentState: State
  connect: () => void
  sendMessage: (message: IGuestToHostMessage) => void
}

function withS4ACommunication(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  class ComponentWithS4ACommunication extends PureComponent<any, State> {
    static readonly displayName = `withS4ACommunication(${WrappedComponent.displayName ||
      WrappedComponent.name})`

    readonly S4A_COMM_VERSION = 1

    state = {
      items: [],
      queryParams: "",
    }

    componentDidMount() {
      window.addEventListener("message", this.receiveMessage)
    }

    componentWillUnmount() {
      window.removeEventListener("message", this.receiveMessage)
    }

    sendMessage = (message: IGuestToHostMessage): void => {
      console.log("== sending versioned message to s4a", {
        stCommVersion: this.S4A_COMM_VERSION,
        ...message,
      } as VersionedMessage<IGuestToHostMessage>)
      window.parent.postMessage(
        {
          stCommVersion: this.S4A_COMM_VERSION,
          ...message,
        } as VersionedMessage<IGuestToHostMessage>,
        "*"
      )
    }

    receiveMessage = (event: MessageEvent): void => {
      const message: VersionedMessage<IHostToGuestMessage> = event.data

      if (
        event.origin !== window.location.origin ||
        message.stCommVersion !== this.S4A_COMM_VERSION
      )
        return

      console.log("== receiving message within core", message)

      if (message.type === "SET_MENU_ITEMS") {
        this.setState({
          items: message.items,
        })
      }

      if (message.type === "UPDATE_FROM_QUERY_PARAMS") {
        console.log("== setting query params state", message)
        this.setState({
          queryParams: message.queryParams,
        })
      }
    }

    connect = () => {
      this.sendMessage({
        type: "GUEST_READY",
      })
    }

    getS4ACommunicationProps = (): S4ACommunicationHOC => ({
      currentState: {
        ...this.state,
      },
      connect: this.connect,
      sendMessage: this.sendMessage,
    })

    render(): ReactNode {
      return (
        <WrappedComponent
          s4aCommunication={this.getS4ACommunicationProps()}
          {...this.props}
        />
      )
    }
  }

  // Static methods must be copied over
  // https://en.reactjs.org/docs/higher-order-components.html#static-methods-must-be-copied-over
  return hoistNonReactStatics(ComponentWithS4ACommunication, WrappedComponent)
}

export default withS4ACommunication
