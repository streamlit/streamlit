/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { logWarning } from "@streamlit/lib/src/util/log"
import {
  ArrowDataframe,
  ComponentInstance as ComponentInstanceProto,
  ISpecialArg,
  SpecialArg as SpecialArgProto,
} from "@streamlit/lib/src/proto"
import { EmotionTheme, toExportedTheme } from "@streamlit/lib/src/theme"
import {
  Source,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"

import { ComponentMessageType, StreamlitMessageType } from "./enums"

// The custom component's value posted from the iFrame has one of the three types as defined
// in component-lib/
export type ValueType = "bytes" | "dataframe" | "json"

// Define types for messages being sent from the custom component
// The types are also defined in the component-lib/ module, and we can
// replace these here when we have a shared module. Until then,
// the typing is hopefully at least a little bit helpful for devs.
type ReadyMessage = {
  apiVersion: number
}
type ComponentValueMessage = {
  /* the value sent from the custom component can be anything */
  value: any
  dataType: ValueType
}
type FrameHeightMessage = {
  height: number
}
export type IframeMessage =
  | ReadyMessage
  | ComponentValueMessage
  | FrameHeightMessage

export interface IframeMessageHandlerProps {
  isReady: () => boolean
  element: ComponentInstanceProto
  widgetMgr: WidgetStateManager
  setComponentError: (error: Error) => void
  componentReadyCallback: () => void
  frameHeightCallback: (height: number | undefined) => void
  fragmentId?: string
}

export interface Args {
  [name: string]: any
}
export interface DataframeArg {
  key: string
  value: any
}

/**
 * The current custom component API version. If our API changes,
 * this value must be incremented. ComponentInstances send their API
 * version in the COMPONENT_READY call.
 */
export const CUSTOM_COMPONENT_API_VERSION = 1

/**
 * Create a callback to be passed to  {@link ComponentRegistry#registerListener}.
 * The passed callbacks RefObject is used in the returned function to access
 * the current fields of the reference when the callback is executed by the ComponentRegistry.
 * This ref-approach allows us to register the listener callback in a functional component only once
 * instead of keeping registering / unregistering multiple times.
 *
 * @param callbacks a ref object containing actual callbacks
 * @returns the callback function to be passed to {@link ComponentRegistry#registerListener}
 */
export function createIframeMessageHandler(
  callbacks: React.RefObject<IframeMessageHandlerProps | undefined>
): (type: string, data: IframeMessage) => void {
  return (type: string, data: IframeMessage): void => {
    if (!callbacks.current) {
      return undefined
    }

    // we receive the callbacks as a reference, so that we can use the
    //  newest version whenever the callback is called without the need
    //  to register the callback to the outside
    const {
      isReady: readyCheck,
      element,
      widgetMgr,
      setComponentError,
      componentReadyCallback,
      frameHeightCallback,
      fragmentId,
    } = callbacks.current
    const isReady = readyCheck()

    switch (type) {
      case ComponentMessageType.COMPONENT_READY: {
        // Our component is ready to begin receiving messages. Send off its
        // first render message! It is *not* an error to get multiple
        // COMPONENT_READY messages. This can happen if a component is being
        // served from the webpack dev server, and gets reloaded. We
        // always respond to this message with the most recent render
        // arguments.
        const { apiVersion } = data as ReadyMessage
        if (apiVersion !== CUSTOM_COMPONENT_API_VERSION) {
          // In the future, we may end up with multiple API versions we
          // need to support. For now, we just have the one.
          setComponentError(
            new Error(`Unrecognized component API version: '${apiVersion}'`)
          )
        } else {
          componentReadyCallback()
        }
        break
      }

      case ComponentMessageType.SET_COMPONENT_VALUE:
        if (!isReady) {
          logWarning(
            `Got ${type} before ${ComponentMessageType.COMPONENT_READY}!`
          )
        } else {
          handleSetComponentValue(
            tryGetValue(data, "value"),
            (data as ComponentValueMessage).dataType,
            { fromUi: true },
            element,
            widgetMgr,
            fragmentId
          )
        }
        break

      case ComponentMessageType.SET_FRAME_HEIGHT:
        if (!isReady) {
          logWarning(
            `Got ${type} before ${ComponentMessageType.COMPONENT_READY}!`
          )
        } else {
          frameHeightCallback(
            tryGetValue(data as FrameHeightMessage, "height")
          )
        }
        break

      default:
        logWarning(`Unrecognized ComponentBackMsgType: ${type}`)
    }
  }
}

/**
 * Parse incoming arguments and bring them into a new form.
 *
 * The `jsonArgs` are parsed to a JSON object.
 * The `specialArgs` are transformed:
 * - `specialArgs[{ key, value: 'arrowdataframe', arrowDataFrame }]` to `dataFrameArgs[{ key, value: arrowDataFrame }]`
 * - `specialArgs[{ key, value: 'bytes', bytes }]` to `newArgs{key: bytes}`
 *
 * This means that byte-values from `specialArgs` override entries in `jsonArgs` when having the same key
 *
 * @param jsonArgs JSON-string
 * @param specialArgs array of objects that hold special-typed values
 * @throws Error when `specialArgs` contains unrecognized type
 * @returns
 */
export function parseArgs(
  jsonArgs: string,
  specialArgs: ISpecialArg[]
): [newArgs: Args, dataframeArgs: DataframeArg[]] {
  // Parse arguments. Our JSON arguments are just stored in a JSON string.
  const newArgs: Args = JSON.parse(jsonArgs)

  // Some notes re: data marshalling:
  //
  // Non-JSON arguments are sent from Python in the "specialArgs"
  // protobuf list. We get DataFrames and Bytes from this list (and
  // any further non-JSON datatypes we add support for down the road will
  // also go into it).
  //
  // We don't forward raw protobuf objects onto the iframe, however.
  // Instead, JSON args and Bytes args are shipped to the iframe together
  // in a plain old JS Object called `args`.
  //
  // But! Because dataframes are delivered as instances of our custom
  // "ArrowTable" class, they can't be sent to the iframe in this same
  // `args` object. Instead, raw DataFrame data is delivered to the iframe
  // in a separate Array. The iframe then constructs the required
  // ArrowTable instances and inserts them into the `args` array itself.
  const dataframeArgs: DataframeArg[] = []
  for (const specialArg of specialArgs as SpecialArgProto[]) {
    const { key } = specialArg
    switch (specialArg.value?.toLowerCase()) {
      case "arrowdataframe":
        dataframeArgs.push({
          key,
          value: ArrowDataframe.toObject(
            specialArg.arrowDataframe as ArrowDataframe
          ),
        })
        break

      case "bytes":
        newArgs[key] = specialArg.bytes
        break

      default:
        throw new Error(`Unrecognized SpecialArg type: ${specialArg.value}`)
    }
  }

  return [newArgs, dataframeArgs]
}

/**
 * Send a RENDER message to the component with the most recent arguments
 * received from Python.
 */
export function sendRenderMessage(
  currentArgs: Args,
  currentDataframeArgs: DataframeArg[],
  disabled: boolean,
  theme: EmotionTheme,
  iframe?: HTMLIFrameElement
): void {
  if (!iframe) {
    // This should never happen!
    logWarning("Can't send ForwardMsg; missing our iframe!")
    return
  }

  if (iframe.contentWindow == null) {
    // Nor should this!
    logWarning("Can't send ForwardMsg; iframe has no contentWindow!")
    return
  }

  // NB: if you change or remove any of the arguments here, you'll break
  // existing components. You can *add* more arguments safely, but any
  // other modifications require a CUSTOM_COMPONENT_API_VERSION bump.
  iframe.contentWindow.postMessage(
    {
      type: StreamlitMessageType.RENDER,
      args: currentArgs,
      dfs: currentDataframeArgs,
      disabled: disabled,
      theme: toExportedTheme(theme),
    },
    "*"
  )
}

/**
 * Set the component's value in the widgetManager to be passed to the backend
 * @param value posted by the custom component. Can be anything
 * @param dataType of the passed value. Determines the proto field type. See {@link ValueType}
 * @param source specifies from where the value is coming
 * @param element the element to which the value belongs
 * @param widgetMgr the widget manager to report the value to
 * @returns undefined
 */
function handleSetComponentValue(
  value: any, // we do not know what data the custom component is sending us, so we use 'any' here
  dataType: ValueType,
  source: Source,
  element: ComponentInstanceProto,
  widgetMgr: WidgetStateManager,
  fragmentId?: string
): void {
  if (value === undefined) {
    logWarning(`handleSetComponentValue: missing 'value' prop`)
    return
  }

  switch (dataType) {
    case "dataframe":
      widgetMgr.setArrowValue(element, value, source, fragmentId)
      break
    case "bytes":
      widgetMgr.setBytesValue(element, value, source, fragmentId)
      break
    default:
      widgetMgr.setJsonValue(element, value, source, fragmentId)
  }
}

/** Return the property with the given name, if it exists. */
function tryGetValue(
  obj: any,
  name: string,
  defaultValue: any = undefined
): any {
  return obj.hasOwnProperty(name) ? obj[name] : defaultValue
}
