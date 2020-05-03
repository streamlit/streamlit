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

import { ArrowDataframeProto, ArrowTable } from "./ArrowTable"

/** Data sent in the custom Streamlit render event. */
export interface RenderData {
  args: any
  disabled: boolean
}

/**
 * Streamlit communication API.
 *
 * Components can send data to Streamlit via the functions defined here,
 * and receive data from Streamlit via the `events` property.
 */
export class Streamlit {
  public static readonly RENDER_EVENT = "render"

  /** Dispatches events received from Streamlit. */
  public static readonly events = new EventTarget()

  private static registeredMessageListener = false

  /**
   * Tell Streamlit that the component is ready to start receiving data.
   * Streamlit will defer emitting RENDER events until it receives the
   * COMPONENT_READY message.
   */
  public static setComponentReady = (): void => {
    if (!Streamlit.registeredMessageListener) {
      // Register for message events if we haven't already
      window.addEventListener("message", Streamlit.onMessageEvent)
      Streamlit.registeredMessageListener = true
    }

    Streamlit.sendBackMsg("componentReady")
  }

  /**
   * Report the component's height to Streamlit.
   * This should be called every time the component changes its DOM - that is,
   * when it's first loaded, and any time it updates.
   */
  public static setFrameHeight = (height?: number): void => {
    if (height === undefined) {
      // height is optional. If undefined, it defaults to scrollHeight,
      // which is the entire height of the element minus its border,
      // scrollbar, and margin.
      height = document.body.scrollHeight
    }

    Streamlit.sendBackMsg("setFrameHeight", { height })
  }

  /**
   * Send the component's "widget value" to Streamlit.
   * This value will be returned to the Python script.
   */
  public static setWidgetValue = (value: any): void => {
    Streamlit.sendBackMsg("setWidgetValue", { value })
  }

  /** Receive a ForwardMsg from the Streamlit app */
  private static onMessageEvent = (event: MessageEvent): void => {
    // We only listen for Streamlit messages.
    if (!event.data.hasOwnProperty("isStreamlitMessage")) {
      return
    }

    const type = event.data["type"]
    switch (type) {
      case "render":
        Streamlit.onRenderMessage(event.data)
        break

      default:
        console.warn(`Unrecognized Streamlit message '${type}`)
        break
    }
  }

  /**
   * Handle an untyped Streamlit render event and redispatch it as a
   * StreamlitRenderEvent.
   */
  private static onRenderMessage = (data: any): void => {
    let args = data["args"]
    if (args == null) {
      console.error(
        `Got null args in onRenderMessage. This should never happen`
      )
      args = {}
    }

    // Parse our dataframe arguments with arrow, and merge them into our args dict
    const dataframeArgs =
      data["dfs"] && data["dfs"].length > 0
        ? Streamlit.argsDataframeToObject(data["dfs"])
        : {}

    args = {
      ...args,
      ...dataframeArgs,
    }

    const disabled = Boolean(data["disabled"])

    // Dispatch a render event!
    const eventData = { disabled, args }
    const event = new CustomEvent<RenderData>(Streamlit.RENDER_EVENT, {
      detail: eventData,
    })
    Streamlit.events.dispatchEvent(event)
  }

  private static argsDataframeToObject = (
    argsDataframe: ArgsDataframe[]
  ): object => {
    const argsDataframeArrow = argsDataframe.map(
      ({ key, value }: ArgsDataframe) => [key, Streamlit.toArrowTable(value)]
    )
    return Object.fromEntries(argsDataframeArrow)
  }

  private static toArrowTable = (df: ArrowDataframeProto): ArrowTable => {
    const { data, index, columns } = df.data
    return new ArrowTable(data, index, columns)
  }

  /** Post a message to the Streamlit app. */
  private static sendBackMsg = (type: string, data?: any): void => {
    window.parent.postMessage(
      {
        // TODO? StreamlitMessageVersion: some string
        isStreamlitMessage: true,
        type: type,
        ...data,
      },
      "*"
    )
  }
}

interface ArgsDataframe {
  key: string
  value: ArrowDataframeProto
}
