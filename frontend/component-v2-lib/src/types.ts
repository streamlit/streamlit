/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
 * own type by providing it as the first generic parameter to
 * `FrontendRendererArgs`.
 *
 * @see BidiComponentState in lib/streamlit/components/v2/bidi_component.py
 */

/* Re-export Apache Arrow types so that component authors can use them. This
also allows us to keep our versions in sync. */
export type { Table } from "apache-arrow"

/**
 * The base interface for defining a Streamlit custom component's state shape.
 *
 * @import { FrontendState } from '@streamlit/component-v2-lib';
 *
 * Component state is a persistent key-value store of state and trigger values.
 * You can extend this type or define your own interface to add type-safe state
 * and trigger key-value pairs. Each key corresponds to an `on_<key>_change`
 * callback parameter in Python.
 */
export type FrontendState = Record<string, unknown>

/**
 * Type for Arrow-serialized data from Python.
 *
 * @import { ArrowData } from '@streamlit/component-v2-lib';
 *
 * Use this when defining interfaces for data that will be serialized using
 * Apache Arrow.
 */
export type ArrowData = Uint8Array<ArrayBufferLike> | null

/**
 * When Python hears about a shared channel value.
 *
 * - `"none"`: the value stays in the browser.
 * - `"defer"`: Python reads the value on the next rerun, without causing one.
 * - `"rerun"`: Python reads the value on a rerun that this change starts.
 */
export type SharedChannelSync = "none" | "defer" | "rerun"

/** Options for writing to a shared channel. */
export type SharedChannelSetOptions = {
  /**
   * When Python hears about the change. Python reads synced values from the
   * channel's `st.components.v2.shared_state` element. Defaults to `"none"`.
   */
  python?: SharedChannelSync
}

/** Called with the keys that changed, after the channel has been updated. */
export type SharedChannelListener = (changedKeys: string[]) => void

/**
 * Browser state shared by every component on the page that joins the channel
 * by name, whatever bundle the component comes from.
 *
 * Values live for the lifetime of the page and survive reruns. Python can
 * seed values with `st.components.v2.shared_state(name, data=...)`, and reads
 * back the values that components set with `python: "defer"` or `"rerun"`.
 */
export interface SharedChannel {
  /** The channel's name. */
  readonly name: string
  /** The current value of a key. */
  get<T = unknown>(key: string): T | undefined
  /** The keys that have a value. */
  keys(): string[]
  /** Set one key and notify subscribers. */
  set(key: string, value: unknown, options?: SharedChannelSetOptions): void
  /** Set several keys and notify subscribers once. */
  update(
    values: Record<string, unknown>,
    options?: SharedChannelSetOptions
  ): void
  /**
   * Listen for changes. Returns a function that stops listening. Listening
   * also stops when the component instance unmounts.
   */
  subscribe(listener: SharedChannelListener): () => void
}

/** Options for `setStateValue`. */
export type SetStateValueOptions = {
  /**
   * Whether this change reruns the script. When `false`, the value is kept in
   * the browser and Python reads it on the next rerun, as with widgets that
   * use `on_change="ignore"`. Defaults to `true`.
   */
  rerun?: boolean
}

/**
 * The arguments passed to a Streamlit custom component's top-level
 * `export default` function.
 *
 * @import { FrontendRendererArgs } from '@streamlit/component-v2-lib';
 *
 * This type provides the interface between your TypeScript component and
 * Streamlit's runtime, including the data payload from Python, utilities for
 * managing component state, and the DOM container for mounting your UI.
 *
 * Component authors typically destructure these arguments for easier access.
 *
 * @template TState - The shape of your component's state object.
 *   Define an interface with the state keys your component will use. Each key
 *   corresponds to a callback parameter in Python (e.g., `on_<key>_change`).
 *   Defaults to `FrontendState` (a generic record).
 *
 * @template TData - The expected shape of the `data` parameter passed
 *   from Python. Define an interface matching the structure of data you'll
 *   send from your Python component calls. Defaults to `unknown`, providing
 *   no type safety for the data payload.
 *
 * @example
 *   Defining strict typing is not required. However, to follow typing best
 *   practices, you can declare your component's data and state shapes, then
 *   provide them as generic parameters to `FrontendRendererArgs`. The following
 *   TypeScript code must be compiled to JavaScript before being passed to the
 *   component's `js` parameter in `st.components.v2.component`.
 *
 *   ```typescript
 *   import { FrontendRenderer, FrontendState } from '@streamlit/component-v2-lib';
 *
 *   interface MyComponentState extends FrontendState {
 *     selected_item: string | null
 *     button_clicked: boolean
 *   }
 *
 *   interface MyComponentData {
 *     label: string
 *     options: string[]
 *   }
 *
 *   const MyComponent: FrontendRenderer<MyComponentState, MyComponentData> = (component) => {
 *     // Destructure the component args for easier access
 *     const { data, setStateValue, setTriggerValue, parentElement } = component
 *
 *     // Set up event handlers with type-safe state management
 *     const dropdown = parentElement.querySelector('#dropdown') as HTMLSelectElement
 *     const button = parentElement.querySelector('#submit') as HTMLButtonElement
 *
 *     dropdown.onchange = () => {
 *       setStateValue('selected_item', dropdown.value)
 *     }
 *
 *     button.onclick = () => {
 *       setTriggerValue('button_clicked', true)
 *     }
 *   }
 *
 *   export default MyComponent;
 *   ```
 */
export type FrontendRendererArgs<
  TState extends FrontendState = FrontendState,
  TData = unknown,
> = {
  /**
   * The data payload sent from Python through the component's mounting command.
   * This is the primary input for your component, typed by the component
   * author via the `TData` generic.
   */
  data: TData
  /**
   * A stable identifier for this component instance generated by Streamlit.
   *
   * This key is independent from the `key` parameter passed to the component's
   * mounting command in Python. This frontend key is automatically generated
   * to be unique among all instances of all components and to avoid collisions
   * with classes and IDs in the app's DOM.
   *
   * > **Important:** If a component is mounted without a `key` parameter in
   * > Python, and one of the parameters in the mounting command changes, then
   * > this frontend key may change between app runs.
   */
  key: string
  /**
   * The component's name, as registered by Streamlit on the Python side. This
   * is the same as the `name` parameter passed to `st.components.v2.component`.
   */
  name: string
  /**
   * The host element for your component. Your HTML, JavaScript, and CSS are
   * mounted inside this container. This is a `ShadowRoot` if `isolate_styles`
   * is set to `true` in the component definition, otherwise it's an
   * `HTMLElement`.
   *
   * Avoid directly setting the inner HTML of this element, as it may
   * overwrite the HTML, CSS, and JavaScript from the component definition.
   * Instead, update its children or append new elements to it.
   */
  parentElement: HTMLElement | ShadowRoot
  /**
   * Set a state value by key. This state persists across app reruns.
   *
   * State values are accessible in Python through the component's result. Use
   * this for values that should maintain their state when the user interacts
   * with other parts of the Streamlit app.
   *
   * @param name The state key to set. If you are using TypeScript, this
   *   should be a key from `TState`.
   *
   *   To assign a value to a state key, in the component's mounting command
   *   in Python, an `on_<key>_change` callback isn't required. However, the
   *   presence of a callback will ensure that the state key is always present
   *   in the result.
   *
   * @param value The value to associate with the key. Type must match the
   *   corresponding property type in your `TState` interface.
   *
   * @param options Pass `{ rerun: false }` to update the value without
   *   rerunning the script.
   */
  setStateValue: (
    name: keyof TState,
    value: TState[keyof TState],
    options?: SetStateValueOptions
  ) => void
  /**
   * Set a trigger value by key. This trigger persists for a only single app
   * rerun.
   *
   * Trigger values are one-time events that are consumed during the resulting
   * rerun and reset to `null` afterward. They're accessible in Python through
   * the component's result. Use this for actions like button clicks, form
   * submissions, or other event-based interactions.
   *
   * @param name The trigger key to set. If you are using TypeScript, this
   *   should be a key from `TState`.
   *
   *   To assign a value to a trigger key, in the component's mounting command
   *   in Python, an `on_<key>_change` callback isn't required. However, the
   *   presence of a callback will ensure that the trigger key is always present
   *   in the result.
   *
   * @param value The value for this trigger. If you are using TypeScript, this
   *   should match the corresponding property type in your `TState`
   *   interface.
   */
  setTriggerValue: (name: keyof TState, value: TState[keyof TState]) => void
  /**
   * Rerun the script, sending every state value set with `{ rerun: false }`
   * since the last rerun. Inside a fragment, only the fragment reruns. Calls
   * in the same task are coalesced into one rerun.
   */
  requestRerun: () => void
  /**
   * Join the page's shared channel with this name. Every component that joins
   * a channel of the same name sees the same values.
   */
  shared: (name: string) => SharedChannel
}

/**
 * The cleanup function returned by a Streamlit v2 component frontend renderer.
 *
 * This type represents the cleanup function that your component can return
 * from its top-level `export default` function. If provided, Streamlit will
 * call this function when your component is unmounted from the app, allowing
 * you to perform any necessary cleanup tasks, such as removing event listeners
 * or canceling network requests.
 */
export type CleanupFunction = () => void

/**
 * The Streamlit v2 component frontend renderer signature.
 *
 * @import { FrontendRenderer } from '@streamlit/component-v2-lib';
 *
 * This type represents the function signature for the default export from your
 * component's JavaScript or TypeScript code. This function gets called by
 * Streamlit when your component is mounted in the frontend, and it receives
 * all the necessary arguments to build and manage your component's UI and
 * state.
 *
 * @template TState - The shape of your component's state object.
 *   Defaults to `FrontendState` (a generic record).
 *
 * @template TData - The expected shape of the `data` parameter passed
 *   from Python. Defaults to `unknown`.
 *
 * @returns CleanupFunction | void - An optional cleanup function that Streamlit
 *   will call when the component is unmounted.
 */
export type FrontendRenderer<
  TState extends FrontendState = FrontendState,
  TData = unknown,
> = (
  /**
   * The inputs and utilities provided by Streamlit to your component.
   */
  componentArgs: FrontendRendererArgs<TState, TData>
) => CleanupFunction | void

/**
 * Deprecated aliases
 * ------------------
 * These types are kept for backwards compatibility with early CCv2 examples and
 * existing component code. Prefer the `Frontend*` names for new code.
 */

/**
 * @deprecated Use `FrontendState`.
 */
export type ComponentState = FrontendState

/**
 * @deprecated Use `FrontendRendererArgs`.
 */
export type ComponentArgs<
  TState extends FrontendState = FrontendState,
  TData = unknown,
> = FrontendRendererArgs<TState, TData>

/**
 * @deprecated Use `CleanupFunction | void` for return types, or just
 * `CleanupFunction` for the function type itself.
 */
export type OptionalComponentCleanupFunction = CleanupFunction | void

/**
 * @deprecated Use `FrontendRenderer`.
 */
export type Component<
  TState extends FrontendState = FrontendState,
  TData = unknown,
> = FrontendRenderer<TState, TData>
