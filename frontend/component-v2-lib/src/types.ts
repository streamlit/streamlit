/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

/**
 * The base type of the returned state from a Streamlit v2 Component. Authors
 * can extend this type to add their own state key/value pairs, or utilize their
 * own type by providing it as the first generic parameter to `ComponentArgs`.
 *
 * @see BidiComponentState in lib/streamlit/components/v2/bidi_component.py
 */

/* Re-export Apache Arrow types so that component authors can use them. This
also allows us to keep our versions in sync. */
export type { Table } from "apache-arrow"

export type ComponentState = Record<string, unknown>

export type ArrowData = Uint8Array<ArrayBufferLike> | null

/**
 * The arguments passed to a Streamlit v2 Component's top-level
 * `export default` function.
 */
export type ComponentArgs<
  TComponentState extends ComponentState = ComponentState,
  /**
   * The shape of the data passed to the component.
   * Component authors should provide this type for type safety.
   *
   * @see st.bidi_component in lib/streamlit/components/v2/__init__.py
   */
  TDataShape = unknown,
> = {
  /**
   * The data payload sent from Python via `st.components.v2.component`. This is
   * the primary input for your component, typed by the author via the
   * `TDataShape` generic.
   */
  data: TDataShape
  /**
   * A stable identifier for this component instance given by Streamlit.
   */
  key: string
  /**
   * The component's name, as registered by Streamlit on the Python side.
   */
  name: string
  /**
   * The host element for your component. Mount your UI inside this container.
   * This will be a `ShadowRoot` if `isolate_styles` is set to `true` in the
   * component definition, otherwise it will be a `HTMLElement`.
   */
  parentElement: HTMLElement | ShadowRoot
  /**
   * Set a state value by key. This state survives Streamlit re-runs.
   *
   * @param name The state key to set
   * @param value The value to associate with the key
   */
  setStateValue: (
    name: keyof TComponentState,
    value: TComponentState[keyof TComponentState]
  ) => void
  /**
   * Set a trigger value by key. This trigger persists for a single Streamlit
   * re-run.
   *
   * @param name The trigger key to set
   * @param value The value for this trigger
   */
  setTriggerValue: (
    name: keyof TComponentState,
    value: TComponentState[keyof TComponentState]
  ) => void
}

/**
 * A function that is called by Streamlit to clean up resources created by the
 * component (event listeners, timers, DOM nodes, etc.).
 */
type ComponentCleanupFunction = () => void

/**
 * The component's return type. Can be a cleanup function or `void`.
 */
export type OptionalComponentCleanupFunction = ComponentCleanupFunction | void

/**
 * The Streamlit v2 Component signature.
 */
export type Component<
  TComponentState extends ComponentState = ComponentState,
  TDataShape = unknown,
> = (
  /**
   * The inputs and utilities provided by Streamlit to your component.
   */
  componentArgs: ComponentArgs<TComponentState, TDataShape>
) => OptionalComponentCleanupFunction
