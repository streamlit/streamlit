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

import { Draft, produce } from "immer"
import { getLogger } from "loglevel"
import { Long, util } from "protobufjs"
import queryString from "query-string"
import { Signal, SignalConnection } from "typed-signals"

import {
  ChatInputValue,
  DoubleArray,
  IArrowTable,
  IChatInputValue,
  IFileUploaderState,
  SInt64Array,
  StringArray,
  StringTriggerValue,
  Button as SubmitButtonProto,
  WidgetState,
  WidgetStates,
} from "@streamlit/protobuf"

import { assertNever } from "~lib/util/assertNever"
import {
  isNullOrUndefined,
  isValidFormId,
  notNullOrUndefined,
} from "~lib/util/utils"
export interface Source {
  fromUi: boolean
}

/** Common widget protobuf fields that are used by the WidgetStateManager. */
export interface WidgetInfo {
  id: string
  formId?: string
}

/**
 * Valid widget value types for query param bindings.
 * These correspond to the WidgetState proto value field names.
 */
export type WidgetValueType =
  | "bool_value"
  | "int_value"
  | "double_value"
  | "string_value"
  | "string_array_value"
  | "int_array_value"
  | "double_array_value"

/**
 * Binding information for a widget that syncs to URL query parameters.
 */
export interface QueryParamBinding {
  paramKey: string
  valueType: WidgetValueType
  defaultValue: unknown
  // Whether the widget allows clearing to empty state.
  // When true, empty values write ?foo= to URL; when false, empty clears the param.
  clearable: boolean
  urlFormat?: "comma" | "repeated" // How to serialize arrays
  dateType?: DateType
}

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
  readonly submitButtons: Map<string, Array<SubmitButtonProto>>
}

/** Create an empty FormsData instance. */
export function createFormsData(): FormsData {
  return {
    formsWithPendingChanges: new Set(),
    formsWithUploads: new Set(),
    submitButtons: new Map(),
  }
}

const LOG = getLogger("WidgetStateManager")

// Structurally identical to MomentKind in formatMoment.ts, but kept separate:
// MomentKind is for display formatting (moment.js), DateType is for URL
// serialization (ISO strings). Coupling them would create an unrelated
// dependency between URL binding logic and the display formatting layer.
export type DateType = "date" | "time" | "datetime"

/**
 * Convert a microsecond timestamp (as used by date/time sliders) to an ISO
 * string suitable for URL query parameters. The format matches the ISO
 * conventions used by st.date_input and st.time_input.
 *
 * Python datetime microseconds → JS milliseconds → Date UTC → ISO substring.
 */
export function microsToIsoString(micros: number, dateType: DateType): string {
  // micros are UTC-based; Date constructor interprets ms as UTC.
  const iso = new Date(micros / 1000).toISOString()
  switch (dateType) {
    case "date":
      return iso.slice(0, 10) // "YYYY-MM-DD"
    case "time": {
      // Include seconds when non-zero to preserve sub-minute precision.
      const hhmmss = iso.slice(11, 19) // "HH:mm:ss"
      return hhmmss.endsWith(":00") ? hhmmss.slice(0, 5) : hhmmss
    }
    case "datetime": {
      // Include seconds when non-zero to preserve sub-minute precision.
      const secs = iso.slice(17, 19)
      return secs === "00" ? iso.slice(0, 16) : iso.slice(0, 19)
    }
  }
}

/**
 * A Dictionary that maps widgetID -> WidgetState, and provides some utility
 * functions.
 */
export class WidgetStateDict {
  private readonly widgetStates = new Map<string, WidgetState>()

  /**
   * Create a new WidgetState proto for the widget with the given ID,
   * overwriting any that currently exists.
   */
  public createState(widgetId: string): WidgetState {
    const state = new WidgetState({ id: widgetId })
    this.widgetStates.set(widgetId, state)
    return state
  }

  /** Return the WidgetState for the given widgetID if it exists. */
  public getState(widgetId: string): WidgetState | undefined {
    return this.widgetStates.get(widgetId)
  }

  /** Remove the WidgetState proto with the given id, if it exists. */
  public deleteState(widgetId: string): void {
    this.widgetStates.delete(widgetId)
  }

  /** Remove the state of widgets that are not contained in `activeIds`. */
  public removeInactive(activeIds: Set<string>): void {
    this.widgetStates.forEach((_value, key) => {
      if (!activeIds.has(key)) {
        this.widgetStates.delete(key)
      }
    })
  }

  /** Remove all widget states. */
  public clear(): void {
    this.widgetStates.clear()
  }

  public get isEmpty(): boolean {
    return this.widgetStates.size === 0
  }

  public createWidgetStatesMsg(): WidgetStates {
    const msg = new WidgetStates()
    this.widgetStates.forEach(value => msg.widgets.push(value))
    return msg
  }

  /**
   * Copy the contents of another WidgetStateDict into this one, overwriting
   * any values with duplicate keys.
   */
  public copyFrom(other: WidgetStateDict): void {
    other.widgetStates.forEach((state, widgetId) => {
      this.widgetStates.set(widgetId, state)
    })
  }

  /** Call a function for each value in the dict. */
  public forEach(callbackfn: (value: WidgetState) => void): void {
    this.widgetStates.forEach(callbackfn)
  }
}

/** Stores private data about a single form. */
class FormState {
  public readonly widgetStates = new WidgetStateDict()

  /** True if the form was created with the clear_on_submit flag. */
  public clearOnSubmit = false

  /** True if the form was created with the enter_to_submit flag. */
  public enterToSubmit = true

  /** Signal emitted when the form is cleared. */
  public readonly formCleared = new Signal()

  /** True if the form has a non-empty WidgetStateDict. */
  public get hasPendingChanges(): boolean {
    return !this.widgetStates.isEmpty
  }
}

interface Props {
  /** Callback to deliver a message to the server */
  sendRerunBackMsg: (
    widgetStates: WidgetStates,
    fragmentId: string | undefined,
    pageScriptHash: string | undefined,
    isAutoRerun: boolean | undefined
  ) => void

  /**
   * Callback invoked whenever our FormsData changed. (Because FormsData
   * is immutable, any changes to it result in a new instance being created.)
   */
  formsDataChanged: (formsData: FormsData) => void
}

/**
 * Manages widget values, and sends widget update messages back to the server.
 */
export class WidgetStateManager {
  private readonly props: Props

  // Top-level widget state dictionary.
  private readonly widgetStates = new WidgetStateDict()

  // Internal state for each form we're managing.
  private readonly forms = new Map<string, FormState>()

  // External data about all forms.
  private formsData: FormsData

  // A dictionary that maps elementId -> element state keys -> element state values.
  // This is used to store frontend-only state for elements.
  // This state is not never sent to the server.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  private readonly elementStates = new Map<string, Map<string, any>>()

  /**
   * Debouncing helpers for trigger widgets.
   *
   * Multiple calls to `setTriggerValue` that happen within the same
   * JavaScript macrotask (for example, when a single click handler invokes
   * `setTriggerValue` several times for different trigger names) should be
   * batched into a single `updateWidgets` message. Otherwise, each call would
   * schedule its own `setTimeout(…, 0)` which results in multiple
   * `updateWidgets` messages being sent in quick succession. The Streamlit
   * backend only handles the *latest* message before rerunning the script,
   * which means earlier triggers can be lost. We fix this by batching.
   */
  private readonly pendingTriggerIds = new Set<string>()

  /** Promise resolvers that should run once the pending trigger batch has
   *  been flushed to the backend. */
  private triggerFlushResolvers: Array<() => void> = []

  /** Indicates whether we already scheduled a macrotask-level flush. */
  private flushScheduled = false

  /** The fragmentId associated with the currently scheduled flush (if any). */
  private scheduledFragmentId: string | undefined

  /**
   * Tracks whether we've already logged a mixed-fragmentId warning for the
   * currently scheduled batch. This prevents spamming the console if multiple
   * conflicting calls happen in the same macrotask.
   */
  private hasFragmentIdConflict = false

  /**
   * Registry of widgets bound to URL query parameters.
   * Maps widgetId -> QueryParamBinding
   */
  private readonly boundWidgets = new Map<string, QueryParamBinding>()

  /**
   * Reverse lookup: paramKey -> widgetId
   */
  private readonly paramKeyToWidgetId = new Map<string, string>()

  /**
   * Callback to notify App.tsx when query params change.
   * This keeps App's queryParams state in sync with the URL.
   */
  private onQueryParamsChange?: (queryString: string) => void

  constructor(props: Props) {
    this.props = props
    this.formsData = createFormsData()
  }

  /**
   * Register a function that will be called when the given form is cleared.
   * Returns an object that can be used to de-register the listener.
   */
  public addFormClearedListener(
    formId: string,
    listener: () => void
  ): SignalConnection {
    return this.getOrCreateFormState(formId).formCleared.connect(listener)
  }

  /**
   * Register a Form, and assign its clearOnSubmit & enterToSubmit values.
   * The `Form` element calls this when it's first mounted.
   */
  public setFormSubmitBehaviors(
    formId: string,
    clearOnSubmit: boolean,
    enterToSubmit = true
  ): void {
    const form = this.getOrCreateFormState(formId)
    form.clearOnSubmit = clearOnSubmit
    form.enterToSubmit = enterToSubmit
  }

  /**
   * Commit pending changes for widgets that belong to the given form,
   * and send a rerunBackMsg to the server.
   */
  public submitForm(
    formId: string,
    fragmentId: string | undefined,
    actualSubmitButton?: WidgetInfo
  ): void {
    if (!isValidFormId(formId)) {
      // This should never get thrown - only FormSubmitButton calls this
      // function.
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`invalid formID '${formId}'`)
    }

    const form = this.getOrCreateFormState(formId)

    const submitButtons = this.formsData.submitButtons.get(formId)

    let selectedSubmitButton

    if (actualSubmitButton !== undefined) {
      selectedSubmitButton = actualSubmitButton
    }
    // can have an empty list of submitButtons
    else if (submitButtons !== undefined && submitButtons.length > 0) {
      // click the first submit button. We can choose any so we just choose first.
      selectedSubmitButton = submitButtons[0]
    }

    if (selectedSubmitButton) {
      this.createWidgetState(selectedSubmitButton, {
        fromUi: true,
      }).triggerValue = true
    }

    // Copy the form's values into widgetStates, delete the form's pending
    // changes, and send our widgetStates back to the server.
    this.widgetStates.copyFrom(form.widgetStates)
    form.widgetStates.clear()

    this.sendUpdateWidgetsMessage(fragmentId)
    this.syncFormsWithPendingChanges()

    if (selectedSubmitButton) {
      this.deleteWidgetState(selectedSubmitButton.id)
    }

    // If the form has the clearOnSubmit flag, we emit a signal to all widgets
    // in the form. Each widget that handles this signal will reset to their
    // default values, and submit those new default values to the WidgetStateManager
    // in their signal handlers. (Because all of these widgets are in a form,
    // none of these value submissions will trigger re-run requests.)
    if (form.clearOnSubmit) {
      form.formCleared.emit()
    }
  }

  public setChatInputValue(
    widget: WidgetInfo,
    value: IChatInputValue,
    source: Source,
    fragmentId: string | undefined
  ): void {
    // ------------------------------------------------------------------
    // ChatInput behaves like a trigger widget: its value should be sent to
    // the backend exactly once and then be cleared so that subsequent
    // reruns receive an "empty" value. With the introduction of batched
    // trigger handling, we align ChatInput with the same mechanism used by
    // `setTriggerValue` to avoid race conditions when multiple updates are
    // emitted within the same macrotask.
    // ------------------------------------------------------------------

    // 1. Store the value in a temporary WidgetState proto.
    this.createWidgetState(widget, source).chatInputValue = new ChatInputValue(
      value
    )

    // 2. Mark this widget ID so that it is cleaned-up after the pending
    //    batch flush. The `scheduleFlush` helper already takes care of
    //    deleting all IDs present in `pendingTriggerIds` once the update
    //    message has been sent.
    this.pendingTriggerIds.add(widget.id)

    // 3. Schedule (or reuse) a macrotask-level flush so that ChatInput
    //    updates are coalesced with other trigger/value updates that happen
    //    during the same event loop tick.
    this.scheduleFlush(fragmentId)
  }

  /**
   * Sets a string trigger value for a widget. String trigger values behave
   * like boolean triggers - they are sent to the backend once and then
   * auto-reset to null after each script run. Use this for trigger-based
   * widgets that need to return a string value (e.g., menu button selections).
   */
  public setStringTriggerValue(
    widget: WidgetInfo,
    value: string,
    source: Source,
    fragmentId: string | undefined
  ): void {
    this.createWidgetState(widget, source).stringTriggerValue =
      new StringTriggerValue({ data: value })

    this.pendingTriggerIds.add(widget.id)
    this.scheduleFlush(fragmentId)
  }

  /**
   * 1. Boolean trigger
   *    setTriggerValue(widgetInfo, { fromUi: true }, fragmentId)
   *
   * 2. Payload (JSON-encoded) trigger
   *    setTriggerValue(widgetInfo, { fromUi: true }, fragmentId, payload)
   *
   *    `payload` can be any JSON-serialisable value. For Bidi Component v2
   *    we always transport payloads via the protobuf `json_trigger_value`
   *    field as a JSON-stringified array of payload objects. Multiple calls
   *    within the same macrotask are batched into that array. If `payload`
   *    is omitted (or `undefined`) we fall back to the boolean
   *    `trigger_value=true` behaviour.
   */

  public setTriggerValue<T extends Record<string, unknown>>(
    widget: WidgetInfo,
    source: Source,
    fragmentId: string | undefined,
    value?: T
  ): Promise<void> {
    // If we already have a pending trigger for this widget in the current
    // macrotask, append to it instead of overwriting so multiple triggers are
    // delivered in a single backend message.
    let widgetState = this.getWidgetState(widget)
    if (widgetState === undefined) {
      widgetState = this.createWidgetState(widget, source)
    }

    if (value === undefined) {
      // Simple boolean trigger.
      widgetState.triggerValue = true
    } else {
      // Custom Components v2: always encode payloads as a JSON array.
      // To batch multiple trigger events in the same macrotask, we store
      // payloads as a JSON-stringified array. On each call, we parse
      // the existing string, append the new payload, and re-stringify.
      const nextPayloadObject = value

      try {
        if (isNullOrUndefined(widgetState.jsonTriggerValue)) {
          // First payload -> start an array.
          widgetState.jsonTriggerValue = JSON.stringify([nextPayloadObject])
        } else {
          // Subsequent payloads -> append to existing array
          const prevRaw = widgetState.jsonTriggerValue
          const prevParsed = JSON.parse(prevRaw)
          const prevArray = Array.isArray(prevParsed)
            ? prevParsed
            : [prevParsed]
          prevArray.push(nextPayloadObject)
          widgetState.jsonTriggerValue = JSON.stringify(prevArray)
        }
      } catch (error) {
        // In the unlikely event prior state was not valid JSON, fall back to a 2-item array.
        LOG.error(
          "Failed to parse or stringify widgetState.jsonTriggerValue:",
          error
        )
        widgetState.jsonTriggerValue = JSON.stringify([
          widgetState.jsonTriggerValue,
          nextPayloadObject,
        ])
      }
    }

    // --------------------------------------------------------------
    // Batch trigger updates fired during the same JavaScript macrotask.
    // --------------------------------------------------------------
    this.pendingTriggerIds.add(widget.id)

    return new Promise(resolve => {
      // Queue resolver so callers still get the same promise-based API.
      this.triggerFlushResolvers.push(resolve)

      // Schedule (or reuse) a macrotask-level flush.
      this.scheduleFlush(fragmentId)
    })
  }

  public getBoolValue(widget: WidgetInfo): boolean | undefined {
    const state = this.getWidgetState(widget)
    if (notNullOrUndefined(state) && state.value === "boolValue") {
      return state.boolValue as boolean
    }

    return undefined
  }

  public setBoolValue(
    widget: WidgetInfo,
    value: boolean,
    source: Source,
    fragmentId: string | undefined
  ): void {
    this.createWidgetState(widget, source).boolValue = value
    this.onWidgetValueChanged(widget.formId, source, fragmentId)
    this.maybeSyncValueToUrl(widget.id, source, value)
  }

  public getIntValue(widget: WidgetInfo): number | undefined {
    const state = this.getWidgetState(widget)
    if (notNullOrUndefined(state) && state.value === "intValue") {
      return requireNumberInt(state.intValue as number)
    }

    return undefined
  }

  public setIntValue(
    widget: WidgetInfo,
    value: number | null,
    source: Source,
    fragmentId: string | undefined
  ): void {
    this.createWidgetState(widget, source).intValue = value
    this.onWidgetValueChanged(widget.formId, source, fragmentId)
    this.maybeSyncValueToUrl(widget.id, source, value)
  }

  public getDoubleValue(widget: WidgetInfo): number | undefined {
    const state = this.getWidgetState(widget)
    if (notNullOrUndefined(state) && state.value === "doubleValue") {
      return state.doubleValue as number
    }

    return undefined
  }

  public setDoubleValue(
    widget: WidgetInfo,
    value: number | null,
    source: Source,
    fragmentId: string | undefined
  ): void {
    this.createWidgetState(widget, source).doubleValue = value
    this.onWidgetValueChanged(widget.formId, source, fragmentId)
    this.maybeSyncValueToUrl(widget.id, source, value)
  }

  public getStringValue(widget: WidgetInfo): string | undefined {
    const state = this.getWidgetState(widget)
    if (notNullOrUndefined(state) && state.value === "stringValue") {
      return state.stringValue as string
    }

    return undefined
  }

  public setStringValue(
    widget: WidgetInfo,
    value: string | null,
    source: Source,
    fragmentId: string | undefined
  ): void {
    this.createWidgetState(widget, source).stringValue = value
    this.onWidgetValueChanged(widget.formId, source, fragmentId)
    this.maybeSyncValueToUrl(widget.id, source, value)
  }

  public setStringArrayValue(
    widget: WidgetInfo,
    value: string[],
    source: Source,
    fragmentId: string | undefined
  ): void {
    this.createWidgetState(widget, source).stringArrayValue = new StringArray({
      data: value,
    })
    this.onWidgetValueChanged(widget.formId, source, fragmentId)
    this.maybeSyncValueToUrl(widget.id, source, value)
  }

  public getStringArrayValue(widget: WidgetInfo): string[] | undefined {
    const state = this.getWidgetState(widget)
    if (
      notNullOrUndefined(state) &&
      state.value === "stringArrayValue" &&
      notNullOrUndefined(state.stringArrayValue) &&
      notNullOrUndefined(state.stringArrayValue.data)
    ) {
      return state.stringArrayValue.data
    }

    return undefined
  }

  public getDoubleArrayValue(widget: WidgetInfo): number[] | undefined {
    const state = this.getWidgetState(widget)
    if (
      notNullOrUndefined(state) &&
      state.value === "doubleArrayValue" &&
      notNullOrUndefined(state.doubleArrayValue) &&
      notNullOrUndefined(state.doubleArrayValue.data)
    ) {
      return state.doubleArrayValue.data
    }

    return undefined
  }

  public setDoubleArrayValue(
    widget: WidgetInfo,
    value: number[],
    source: Source,
    fragmentId: string | undefined
  ): void {
    // Filter out invalid values (NaN, undefined, null) before storing.
    const validValue = value.filter(
      v => v !== undefined && v !== null && !Number.isNaN(v)
    )
    // If all values are invalid, preserve previous state and warn.
    // This can happen if user code passes NaN values (e.g., from empty DataFrame operations).
    if (validValue.length === 0) {
      LOG.warn(
        `setDoubleArrayValue: All values were invalid (NaN/null/undefined) ` +
          `for widget "${widget.id}". Preserving previous state.`
      )
      this.maybeSyncValueToUrl(widget.id, source, [])
      return
    }
    this.createWidgetState(widget, source).doubleArrayValue = new DoubleArray({
      data: validValue,
    })
    this.onWidgetValueChanged(widget.formId, source, fragmentId)
    this.maybeSyncValueToUrl(widget.id, source, validValue)
  }

  public getIntArrayValue(widget: WidgetInfo): number[] | undefined {
    const state = this.getWidgetState(widget)
    if (
      notNullOrUndefined(state) &&
      state.value === "intArrayValue" &&
      notNullOrUndefined(state.intArrayValue) &&
      notNullOrUndefined(state.intArrayValue.data)
    ) {
      return state.intArrayValue.data.map(requireNumberInt)
    }

    return undefined
  }

  public setIntArrayValue(
    widget: WidgetInfo,
    value: number[],
    source: Source,
    fragmentId: string | undefined
  ): void {
    this.createWidgetState(widget, source).intArrayValue = new SInt64Array({
      data: value,
    })
    this.onWidgetValueChanged(widget.formId, source, fragmentId)
    this.maybeSyncValueToUrl(widget.id, source, value)
  }

  public getJsonValue(widget: WidgetInfo): string | undefined {
    const state = this.getWidgetState(widget)
    if (notNullOrUndefined(state) && state.value === "jsonValue") {
      return state.jsonValue as string
    }

    return undefined
  }

  public setJsonValue(
    widget: WidgetInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    value: any,
    source: Source,
    fragmentId: string | undefined
  ): void {
    this.createWidgetState(widget, source).jsonValue = JSON.stringify(value)
    this.onWidgetValueChanged(widget.formId, source, fragmentId)
  }

  public setArrowValue(
    widget: WidgetInfo,
    value: IArrowTable,
    source: Source,
    fragmentId: string | undefined
  ): void {
    this.createWidgetState(widget, source).arrowValue = value
    this.onWidgetValueChanged(widget.formId, source, fragmentId)
  }

  public getArrowValue(widget: WidgetInfo): IArrowTable | undefined {
    const state = this.getWidgetState(widget)
    if (
      notNullOrUndefined(state) &&
      state.value === "arrowValue" &&
      notNullOrUndefined(state.arrowValue)
    ) {
      return state.arrowValue
    }

    return undefined
  }

  public setBytesValue(
    widget: WidgetInfo,
    value: Uint8Array,
    source: Source,
    fragmentId: string | undefined
  ): void {
    this.createWidgetState(widget, source).bytesValue = value
    this.onWidgetValueChanged(widget.formId, source, fragmentId)
  }

  public getBytesValue(widget: WidgetInfo): Uint8Array | undefined {
    const state = this.getWidgetState(widget)
    if (notNullOrUndefined(state) && state.value === "bytesValue") {
      return state.bytesValue as Uint8Array
    }

    return undefined
  }

  public setFileUploaderStateValue(
    widget: WidgetInfo,
    value: IFileUploaderState,
    source: Source,
    fragmentId: string | undefined
  ): void {
    this.createWidgetState(widget, source).fileUploaderStateValue = value
    this.onWidgetValueChanged(widget.formId, source, fragmentId)
  }

  public getFileUploaderStateValue(
    widget: WidgetInfo
  ): IFileUploaderState | undefined {
    const state = this.getWidgetState(widget)
    if (
      notNullOrUndefined(state) &&
      state.value === "fileUploaderStateValue"
    ) {
      return state.fileUploaderStateValue as IFileUploaderState
    }

    return undefined
  }

  /**
   * Perform housekeeping every time a widget value changes.
   * - If the widget does not belong to a form, and the value update came from
   *   a user action, send the "updateWidgets" message
   * - If the widget belongs to a form, dispatch the "pendingFormsChanged"
   *   callback if needed.
   *
   * Called by every "setValue" function.
   */
  private onWidgetValueChanged(
    formId: string | undefined,
    source: Source,
    fragmentId: string | undefined
  ): void {
    if (isValidFormId(formId)) {
      this.syncFormsWithPendingChanges()
    } else if (source.fromUi) {
      // Batch value changes that occur within the same JavaScript macrotask.
      this.scheduleFlush(fragmentId)
    }
  }

  /**
   * Update FormsData.formsWithPendingChanges with the current set of forms
   * that have pending changes. This is called after widget values are updated.
   */
  private syncFormsWithPendingChanges(): void {
    const pendingFormIds = new Set<string>()
    this.forms.forEach((form, formId) => {
      if (form.hasPendingChanges) {
        pendingFormIds.add(formId)
      }
    })

    this.updateFormsData(draft => {
      draft.formsWithPendingChanges = pendingFormIds
    })
  }

  public sendUpdateWidgetsMessage(
    fragmentId: string | undefined,
    isAutoRerun: boolean | undefined = undefined
  ): void {
    this.props.sendRerunBackMsg(
      this.widgetStates.createWidgetStatesMsg(),
      fragmentId,
      undefined,
      isAutoRerun
    )
  }

  public getActiveWidgetStates(activeIds: Set<string>): WidgetStates {
    const msg = new WidgetStates()
    this.widgetStates.forEach(widgetState => {
      if (activeIds.has(widgetState.id)) {
        msg.widgets.push(widgetState)
      }
    })
    return msg
  }

  /**
   * Remove the state of widgets that are not contained in `activeIds`.
   * This is called when a script finishes running, so that we don't retain
   * data for widgets that have been removed from the app.
   */
  public removeInactive(activeIds: Set<string>): void {
    this.widgetStates.removeInactive(activeIds)
    this.forms.forEach(form => form.widgetStates.removeInactive(activeIds))
    this.elementStates.forEach((_, elementId) => {
      if (!activeIds.has(elementId)) {
        this.deleteElementState(elementId)
      }
    })
  }

  /**
   * Create and return a new WidgetState proto for the given widget ID,
   * overwriting any that currently exists. If the widget belongs to a form,
   * the WidgetState will be created inside the form's WidgetStateDict.
   */
  private createWidgetState(widget: WidgetInfo, source: Source): WidgetState {
    const addToForm = isValidFormId(widget.formId) && source.fromUi
    const widgetStateDict = addToForm
      ? this.getOrCreateFormState(widget.formId as string).widgetStates
      : this.widgetStates

    return widgetStateDict.createState(widget.id)
  }

  /**
   * Get the WidgetState proto for the given widget ID, if it exists.
   */
  private getWidgetState(widget: WidgetInfo): WidgetState | undefined {
    // If the widget belongs to a form, try its form value first.
    if (isValidFormId(widget.formId)) {
      const formState = this.forms
        .get(widget.formId)
        ?.widgetStates.getState(widget.id)

      if (notNullOrUndefined(formState)) {
        return formState
      }
    }

    return this.widgetStates.getState(widget.id)
  }

  /**
   * Remove the WidgetState proto with the given id, if it exists
   */
  private deleteWidgetState(widgetId: string): void {
    this.widgetStates.deleteState(widgetId)
  }

  /** Return the FormState for the given form. Create it if it doesn't exist. */
  private getOrCreateFormState(formId: string): FormState {
    let form = this.forms.get(formId)
    if (notNullOrUndefined(form)) {
      return form
    }

    form = new FormState()
    this.forms.set(formId, form)
    return form
  }

  /** Store the IDs of all forms with in-progress uploads. */
  public setFormsWithUploadsInProgress(formsWithUploads: Set<string>): void {
    this.updateFormsData(draft => {
      draft.formsWithUploads = formsWithUploads
    })
  }

  /**
   * Helper function to determine whether a form allows enter to submit
   * for input elements (st.number_input, st.text_input, etc.)
   * If in form, checks form's enterToSubmit paramf first, otherwise default
   * behavior: Must have 1st submit button enabled to allow
   */
  public allowFormEnterToSubmit(formId: string): boolean {
    // Don't allow if not in form
    if (!isValidFormId(formId)) return false

    // Check if user-set enterToSubmit param is false (in FormState)
    const form = this.forms.get(formId)
    if (form && !form.enterToSubmit) return false

    // Otherwise, use default behavior
    const submitButtons = this.formsData.submitButtons.get(formId)
    const firstSubmitButton = submitButtons?.[0]

    // If no submit buttons for the formId, invalid form
    if (!firstSubmitButton) return false

    // Allow form submit on enter as long as 1st submit button is not disabled
    return !firstSubmitButton.disabled
  }

  /**
   * Called by FormSubmitButton on creation. Add the SubmitButtonProto for
   * the given form and update FormsData.
   */
  public addSubmitButton(
    formId: string,
    submitButtonProto: SubmitButtonProto
  ): void {
    const submitButtons = this.formsData.submitButtons.get(formId)
    if (submitButtons === undefined) {
      this.setSubmitButtons(formId, [submitButtonProto])
    } else {
      const copySubmitButtons = Object.assign([], submitButtons)
      copySubmitButtons.push(submitButtonProto)
      this.setSubmitButtons(formId, copySubmitButtons)
    }
  }

  /**
   * Called by FormSubmitButton on creation. Remove the SubmitButtonProto for
   * the given form, and update FormsData.
   */
  public removeSubmitButton(
    formId: string,
    submitButtonProto: SubmitButtonProto
  ): void {
    const submitButtons = this.formsData.submitButtons.get(formId)
    if (submitButtons !== undefined) {
      const copySubmitButtons = Object.assign([], submitButtons)
      const index = copySubmitButtons.indexOf(submitButtonProto, 0)
      if (index > -1) {
        copySubmitButtons.splice(index, 1)
      }
      this.setSubmitButtons(formId, copySubmitButtons)
    }
  }

  private setSubmitButtons(
    formId: string,
    submitButtons: Array<SubmitButtonProto>
  ): void {
    if (submitButtons.length < 0) {
      throw new Error(
        `Bad submitButtons length ${submitButtons.length} (must be >= 0)`
      )
    }

    this.updateFormsData(draft => {
      draft.submitButtons.set(formId, submitButtons)
    })
  }

  /**
   * Produce a new FormsData with the given recipe, and fire off the
   * formsDataChanged callback with that new data.
   */
  private updateFormsData(recipe: (draft: Draft<FormsData>) => void): void {
    const newData = produce(this.formsData, recipe)
    if (this.formsData !== newData) {
      this.formsData = newData
      this.props.formsDataChanged(this.formsData)
    }
  }

  /**
   * Get the element state value for the given element ID and key, if it exists.
   * This is a frontend-only state that is never sent to the server.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  public getElementState(elementId: string, key: string): any {
    return this.elementStates.get(elementId)?.get(key)
  }

  /**
   * Sets the state of an element identified by its ID and its key.
   * This is a frontend-only state that is never sent to the server.
   * It can be used to store element state to restore the state
   * of an element in situations where an element is removed and re-added.
   *
   * @param {string} elementId - The unique identifier of the element.
   * @param {string} key - The key to set
   * @param {any} value - The value to set for the element's state.
   * @returns {void}
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  public setElementState(elementId: string, key: string, value: any): void {
    if (!this.elementStates.has(elementId)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      this.elementStates.set(elementId, new Map<string, any>())
    }

    // It's expected here that there is always an initialized map for an elementId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    ;(this.elementStates.get(elementId) as Map<string, any>).set(key, value)
  }

  /**
   * Deletes the state associated with a specific element by ID. If a key is provided,
   * only the state corresponding to that key is removed. If no key is specified, all states
   * associated with the element ID are removed.
   */
  public deleteElementState(elementId: string, key?: string): void {
    if (notNullOrUndefined(key)) {
      this.elementStates.get(elementId)?.delete(key)
    } else {
      this.elementStates.delete(elementId)
    }
  }

  /**
   * Schedule a macrotask-level flush of pending widget updates (triggers and
   * regular value changes). Multiple calls within the same macrotask will be
   * coalesced into a single `updateWidgets` message.
   */
  private scheduleFlush(fragmentId: string | undefined): void {
    // Update the stored fragmentId if we don't have one yet. If multiple calls
    // happen and at least one of them specifies a fragmentId, we keep the
    // first non-undefined value.
    if (this.scheduledFragmentId === undefined) {
      this.scheduledFragmentId = fragmentId
    }

    // If we already have a scheduled fragmentId and a new (different) one is
    // provided in the same macrotask, log a warning and proceed with the first
    // one. This acknowledges a rare edge case where multiple components could
    // trigger updates tied to different fragments in one batch. We've decided
    // to prefer to warn rather than throw; this leaves us exposed to potential
    // bugs in very unusual setups. We can tighten this in the future if
    // real-world issues arise.
    if (
      this.scheduledFragmentId !== undefined &&
      fragmentId !== undefined &&
      fragmentId !== this.scheduledFragmentId &&
      !this.hasFragmentIdConflict
    ) {
      LOG.warn(
        "Unexpected state: Multiple different fragmentIds detected in a single batch of widget updates. Proceeding with flushing updates using fragmentId '%s' for this batch.",
        this.scheduledFragmentId
      )
      this.hasFragmentIdConflict = true
    }

    if (this.flushScheduled) {
      return
    }

    this.flushScheduled = true

    // eslint-disable-next-line no-restricted-globals -- Batching widget flushes is non-React scheduling logic.
    setTimeout(() => {
      // Send a *single* widgets update containing **all** pending updates.
      this.sendUpdateWidgetsMessage(this.scheduledFragmentId)

      // Clean-up temporary trigger widget states so they don't leak into future updates.
      this.pendingTriggerIds.forEach(id => this.deleteWidgetState(id))
      this.pendingTriggerIds.clear()

      // Resolve all promises that were waiting for this flush.
      this.triggerFlushResolvers.forEach(r => r())
      this.triggerFlushResolvers = []

      // Reset scheduling flags.
      this.flushScheduled = false
      this.scheduledFragmentId = undefined
      this.hasFragmentIdConflict = false
    }, 0)
  }

  // Query Param Binding Methods

  /**
   * Register a widget's binding to a URL query parameter.
   *
   * If another widget was previously bound to this paramKey, its binding is
   * replaced and the old widget's entry in boundWidgets is cleaned up. This
   * mirrors the backend behavior in QueryParams.bind_widget() which also
   * handles duplicate paramKey cleanup.
   *
   * @param clearable - Whether the widget allows clearing to empty state.
   *   Required - widget components must explicitly pass this based on their UI behavior.
   */
  public registerQueryParamBinding(
    widgetId: string,
    paramKey: string,
    valueType: WidgetValueType,
    defaultValue: unknown,
    clearable: boolean,
    urlFormat?: "comma" | "repeated",
    dateType?: DateType
  ): void {
    // Clean up old binding if a different widget was bound to this paramKey.
    // This keeps boundWidgets and paramKeyToWidgetId consistent.
    const existingWidgetId = this.paramKeyToWidgetId.get(paramKey)
    if (existingWidgetId && existingWidgetId !== widgetId) {
      this.boundWidgets.delete(existingWidgetId)
    }

    // For date/time sliders, convert microsecond defaults to ISO strings so
    // that shouldClearUrlParam / isDefaultArrayValue comparisons match the
    // ISO strings produced by convertToUrlValue.
    let normalizedDefault = defaultValue
    if (dateType) {
      if (Array.isArray(normalizedDefault)) {
        normalizedDefault = normalizedDefault.map(n =>
          typeof n === "number" ? microsToIsoString(n, dateType) : String(n)
        )
      } else if (typeof normalizedDefault === "number") {
        normalizedDefault = microsToIsoString(normalizedDefault, dateType)
      }
    }

    this.boundWidgets.set(widgetId, {
      paramKey,
      valueType,
      defaultValue: normalizedDefault,
      urlFormat,
      clearable,
      dateType,
    })
    this.paramKeyToWidgetId.set(paramKey, widgetId)
  }

  /**
   * Unregister a widget's query param binding (called on unmount).
   *
   * Note: This does NOT clear the URL param - that cleanup is handled by the
   * backend via remove_stale_bindings().
   */
  public unregisterQueryParamBinding(widgetId: string): void {
    const binding = this.boundWidgets.get(widgetId)
    if (binding) {
      this.paramKeyToWidgetId.delete(binding.paramKey)
      this.boundWidgets.delete(widgetId)
    }
  }

  /** Check if a widget has a query param binding. */
  public hasQueryParamBinding(widgetId: string): boolean {
    return this.boundWidgets.has(widgetId)
  }

  /**
   * Filter query params for page navigation.
   * Preserves embed params and params bound to widgets, clears all others.
   *
   * @param embedParams - The embed query params string (from preserveEmbedQueryParams)
   * @returns Filtered query string with embed + bound widget params
   */
  public filterParamsForPageChange(embedParams: string): string {
    // If no widgets are bound, just return embed params
    if (this.paramKeyToWidgetId.size === 0) {
      return embedParams
    }

    // Get current URL params for bound widgets
    const currentUrl = new URL(window.location.href)
    const boundParamsObj: Record<string, string | string[]> = {}

    this.paramKeyToWidgetId.forEach((_, paramKey) => {
      const values = currentUrl.searchParams.getAll(paramKey)
      if (values.length === 1) {
        boundParamsObj[paramKey] = values[0]
      } else if (values.length > 1) {
        boundParamsObj[paramKey] = values
      }
    })

    // Build query string using query-string library
    const boundParamsStr = queryString.stringify(boundParamsObj, {
      arrayFormat: "none",
    })

    // Combine embed params with bound widget params
    if (!boundParamsStr) {
      return embedParams
    }

    return embedParams ? `${embedParams}&${boundParamsStr}` : boundParamsStr
  }

  /** Set callback for query param changes (used by App.tsx). */
  public setQueryParamsChangeHandler(
    handler: (queryString: string) => void
  ): void {
    this.onQueryParamsChange = handler
  }

  /** Notify listener of URL query param changes. */
  private notifyQueryParamsChange(): void {
    if (this.onQueryParamsChange) {
      const url = new URL(window.location.href)
      this.onQueryParamsChange(url.searchParams.toString())
    }
  }

  /**
   * Convert widget value to URL-safe format based on binding type.
   * Returns null to indicate the param should be removed from URL.
   * Returns "" or [] to indicate an empty value that should be preserved as ?foo=
   */
  private convertToUrlValue(
    value: unknown,
    binding: QueryParamBinding
  ): string | string[] | null {
    // Null values - check if empty is valid for this widget
    if (value === null) {
      // If empty is valid, return "" to preserve ?foo= in URL
      // If empty is not valid, return null to signal removal
      return this.isEmptyValueValid(binding) ? "" : null
    }

    switch (binding.valueType) {
      case "bool_value":
        return String(value as boolean)

      case "double_value":
        return String(value as number)

      case "int_value":
        return String(value as number)

      case "string_value":
        return value as string

      case "string_array_value":
        return (value as string[]).filter(v => v !== "")

      case "int_array_value":
        return (value as number[]).map(n => String(n))

      case "double_array_value": {
        const arr = value as number[]
        if (binding.dateType) {
          const dt = binding.dateType
          return arr.map(n => microsToIsoString(n, dt))
        }
        return arr.map(n => String(n))
      }

      default:
        return assertNever(binding.valueType)
    }
  }

  /**
   * Check if empty/cleared is a valid state for this widget.
   * Used to determine whether to write ?foo= (empty value) or remove the param entirely.
   *
   * Returns binding.clearable, which is explicitly set by each widget component.
   */
  private isEmptyValueValid(binding: QueryParamBinding): boolean {
    return binding.clearable
  }

  /**
   * Check if value should clear the URL param (remove it from URL entirely).
   *
   * Returns true to indicate the param should be removed when:
   * - Empty value AND empty is not valid for this widget
   * - Empty value AND empty equals the widget's default (hide at default)
   * - Non-empty value matches the widget's default
   *
   * When empty IS valid AND differs from default (e.g., multiselect with
   * default=["Python"] cleared to []), we preserve ?foo= in the URL.
   */
  private shouldClearUrlParam(
    urlValue: string | string[] | null,
    binding: QueryParamBinding
  ): boolean {
    // Check if value is empty (null, [], or "")
    const isEmpty =
      urlValue === null ||
      (Array.isArray(urlValue) && urlValue.length === 0) ||
      urlValue === ""

    // Empty value that's not valid for this widget should always be cleared
    if (isEmpty && !this.isEmptyValueValid(binding)) {
      return true
    }

    // Check if value matches default (hide at default)
    // This applies to both empty values (when empty is valid) and non-empty values
    // Note: urlValue cannot be null here - convertToUrlValue only returns null when
    // isEmptyValueValid is false, and we already returned true for that case above.
    if (Array.isArray(urlValue)) {
      return this.isDefaultArrayValue(urlValue, binding)
    }
    return this.isDefaultValue(urlValue as string, binding)
  }

  /**
   * Update a single URL parameter using query-string library.
   * Handles both scalar and array values, respecting urlFormat setting.
   */
  private updateUrlParam(
    paramKey: string,
    value: string | string[] | null,
    urlFormat: "comma" | "repeated" | undefined
  ): void {
    // Parse current URL params - use "none" to correctly parse repeated params (?a=1&a=2)
    const currentParams = queryString.parse(window.location.search, {
      arrayFormat: "none",
    })

    if (value === null) {
      // Remove the param
      delete currentParams[paramKey]
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        // Empty array: write as empty string to produce ?key= in URL
        // (queryString.stringify omits empty arrays, so we use "" instead)
        currentParams[paramKey] = ""
      } else if (urlFormat === "comma") {
        // Comma-separated: store as single joined string
        currentParams[paramKey] = value.join(",")
      } else {
        // Repeated params: store as array
        currentParams[paramKey] = value
      }
    } else {
      // Scalar value
      currentParams[paramKey] = value
    }

    // Build new URL using query-string
    // arrayFormat: "none" produces ?key=a&key=b for arrays
    const newSearch = queryString.stringify(currentParams, {
      arrayFormat: "none",
      skipNull: true,
      skipEmptyString: false,
    })

    // Skip replaceState if the URL wouldn't actually change
    const currentSearch = window.location.search.replace(/^\?/, "")
    if (newSearch === currentSearch) {
      return
    }

    const newUrl = new URL(window.location.href)
    newUrl.search = newSearch
    window.history.replaceState({}, "", newUrl.toString())
    this.notifyQueryParamsChange()
  }

  /**
   * Sync widget value to URL if bound and change is from UI.
   * Orchestrates pure conversion and side-effect URL update.
   */
  private maybeSyncValueToUrl(
    widgetId: string,
    source: Source,
    value: unknown
  ): void {
    if (!source.fromUi) return

    const binding = this.boundWidgets.get(widgetId)
    if (!binding) return

    // Pure: Convert value to URL format
    const urlValue = this.convertToUrlValue(value, binding)

    // Pure: Check if we should clear the param
    const shouldClear = this.shouldClearUrlParam(urlValue, binding)

    // Side effect: Update URL
    this.updateUrlParam(
      binding.paramKey,
      shouldClear ? null : urlValue,
      binding.urlFormat
    )
  }

  /**
   * Convert a value to its URL-comparable string form.
   * Handles primitives (string, number, boolean) and Date objects.
   * Date is formatted as local-time ISO (YYYY-MM-DD) to match the wire
   * format used by date_input URL values.
   * @returns The string representation, or undefined for unsupported types.
   */
  private toStringPrimitive(value: unknown): string | undefined {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value)
    }
    if (value instanceof Date) {
      const y = value.getFullYear()
      const m = String(value.getMonth() + 1).padStart(2, "0")
      const d = String(value.getDate()).padStart(2, "0")
      return `${y}-${m}-${d}`
    }
    return undefined
  }

  /**
   * Check if value equals the widget's default (with type coercion).
   *
   * Note: For clearable scalar widgets, convertToUrlValue(null) returns "".
   * If such a widget has an empty array default (unusual), "" should match [].
   */
  private isDefaultValue(value: unknown, binding: QueryParamBinding): boolean {
    const defaultValue = binding.defaultValue
    if (isNullOrUndefined(defaultValue)) {
      return isNullOrUndefined(value) || value === ""
    }
    // Defensive: treat "" (cleared scalar) as matching [] (empty array default)
    // This is an edge case - scalar widgets typically don't have array defaults
    if (
      value === "" &&
      Array.isArray(defaultValue) &&
      defaultValue.length === 0
    ) {
      return true
    }
    const valueStr = this.toStringPrimitive(value)
    const defaultStr = this.toStringPrimitive(defaultValue)
    if (valueStr === undefined || defaultStr === undefined) {
      return false
    }
    return valueStr === defaultStr
  }

  /**
   * Check if array equals the widget's default array (with type coercion).
   *
   * Handles edge cases where the widget's default may be a scalar but the
   * current value is an array (e.g., slider with value=[5] and defaultValue=5).
   *
   * Note: For widgets that allow clearing (clearable=true), empty arrays that
   * differ from default are handled by shouldClearUrlParam before this is called.
   */
  private isDefaultArrayValue(
    values: string[],
    binding: QueryParamBinding
  ): boolean {
    const defaultValue = binding.defaultValue
    if (!Array.isArray(defaultValue)) {
      // Single-element array matches scalar default (e.g., slider: [5] == 5)
      if (values.length === 1 && defaultValue !== null) {
        const defaultStr = this.toStringPrimitive(defaultValue)
        return defaultStr !== undefined && values[0] === defaultStr
      }
      // Empty array or multi-element array cannot match scalar default
      return false
    }
    if (values.length !== defaultValue.length) return false
    return values.every((v, i) => {
      const defaultStr = this.toStringPrimitive(defaultValue[i])
      return defaultStr !== undefined && v === defaultStr
    })
  }
}

/**
 * Coerce a `number | Long` to a `number`.
 *
 * Our "intValue" and "intArrayValue" widget protobuf fields represent their
 * values with sint64, because sint32 is too small to represent the full range
 * of JavaScript int values. Protobufjs uses `number | Long` to represent
 * sint64. However, we're never putting Longs *into* int and intArrays -
 * because none of our widgets use Longs - so we'll never get a Long back out.
 *
 * If the given value cannot be converted to `number` without a loss of
 * precision (which should not be possible!), throw an error instead.
 */
function requireNumberInt(value: number | Long): number {
  if (typeof value === "number") {
    return value
  }

  const longNumber = util.LongBits.from(value).toNumber()
  if (Number.isSafeInteger(longNumber)) {
    return longNumber
  }

  throw new Error(
    // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- TODO: Fix this
    `value ${value} cannot be converted to number without a loss of precision!`
  )
}
