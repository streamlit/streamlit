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

// Safari doesn't support the EventTarget class, so we use a shim.
import { EventTarget } from "event-target-shim"
import { ArrowDataframeProto, ArrowTable } from "./ArrowTable"

/** Data sent in the custom Streamlit render event. */
export interface RenderData {
  args: any
  disabled: boolean
}

/** Messages from Component -> Streamlit */
enum ComponentMessageType {
  // A component sends this message when it's ready to receive messages
  // from Streamlit. Streamlit won't send any messages until it gets this.
  // Data: { apiVersion: number }
  COMPONENT_READY = "streamlit:componentReady",

  // The component has a new widget value. Send it back to Streamlit, which
  // will then re-run the app.
  // Data: { value: any }
  SET_COMPONENT_VALUE = "streamlit:setComponentValue",

  // The component has a new height for its iframe.
  // Data: { height: number }
  SET_FRAME_HEIGHT = "streamlit:setFrameHeight",
}

/**
 * Streamlit communication API.
 *
 * Components can send data to Streamlit via the functions defined here,
 * and receive data from Streamlit via the `events` property.
 */
export class Streamlit {
  /**
   * The Streamlit component API version we're targetting.
   * There's currently only 1!
   */
  public static readonly API_VERSION = 1

  public static readonly RENDER_EVENT = "streamlit:render"

  /** Dispatches events received from Streamlit. */
  public static readonly events = new EventTarget()

  private static registeredMessageListener = false
  private static lastFrameHeight?: number

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

    Streamlit.sendBackMsg(ComponentMessageType.COMPONENT_READY, {
      apiVersion: Streamlit.API_VERSION,
    })
  }

  /**
   * Report the component's height to Streamlit.
   * This should be called every time the component changes its DOM - that is,
   * when it's first loaded, and any time it updates.
   */
  public static setFrameHeight = (height?: number): void => {
    if (height === undefined) {
      // `height` is optional. If undefined, it defaults to scrollHeight,
      // which is the entire height of the element minus its border,
      // scrollbar, and margin.
      height = document.body.scrollHeight
    }

    if (height === Streamlit.lastFrameHeight) {
      // Don't bother updating if our height hasn't changed.
      return
    }

    Streamlit.lastFrameHeight = height
    Streamlit.sendBackMsg(ComponentMessageType.SET_FRAME_HEIGHT, { height })
  }

  /**
   * Set the component's value. This value will be returned to the Python
   * script, and the script will be re-run.
   *
   * For example:
   *
   * JavaScript:
   * Streamlit.setComponentValue("ahoy!")
   *
   * Python:
   * value = st.my_component(...)
   * st.write(value) # -> "ahoy!"
   *
   * The value must be serializable into JSON.
   */
  public static setComponentValue = (value: any): void => {
    Streamlit.sendBackMsg(ComponentMessageType.SET_COMPONENT_VALUE, { value })
  }

  /** Receive a ForwardMsg from the Streamlit app */
  private static onMessageEvent = (event: MessageEvent): void => {
    const type = event.data["type"]
    switch (type) {
      case Streamlit.RENDER_EVENT:
        Streamlit.onRenderMessage(event.data)
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
