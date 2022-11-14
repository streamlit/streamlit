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

import produce, { Draft } from "immer"
import { Long, util } from "protobufjs"

import {
  DoubleArray,
  IArrowTable,
  IFileUploaderState,
  SInt64Array,
  StringArray,
  WidgetState,
  WidgetStates,
} from "src/autogen/proto"
import { Signal, SignalConnection } from "typed-signals"
import { isValidFormId } from "./utils"

export interface Source {
  fromUi: boolean
}

/** Common widget protobuf fields that are used by the WidgetStateManager. */
export interface WidgetInfo {
  id: string
  formId: string
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
  readonly submitButtonCount: Map<string, number>
}

/** Create an empty FormsData instance. */
export function createFormsData(): FormsData {
  return {
    formsWithPendingChanges: new Set(),
    formsWithUploads: new Set(),
    submitButtonCount: new Map(),
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
    this.widgetStates.forEach((value, key) => {
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

  /** Signal emitted when the form is cleared. */
  public readonly formCleared = new Signal()

  /** True if the form has a non-empty WidgetStateDict. */
  public get hasPendingChanges(): boolean {
    return !this.widgetStates.isEmpty
  }
}

interface Props {
  /** Callback to deliver a message to the server */
  sendRerunBackMsg: (widgetStates: WidgetStates) => void

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
   * Register a Form, and assign its clearOnSubmit value.
   * The `Form` element calls this when it's first mounted.
   */
  public setFormClearOnSubmit(formId: string, clearOnSubmit: boolean): void {
    this.getOrCreateFormState(formId).clearOnSubmit = clearOnSubmit
  }

  /**
   * Commit pending changes for widgets that belong to the given form,
   * and send a rerunBackMsg to the server.
   */
  public submitForm(submitButton: WidgetInfo): void {
    const { formId } = submitButton

    if (!isValidFormId(formId)) {
      // This should never get thrown - only FormSubmitButton calls this
      // function.
      throw new Error(`invalid formID '${formId}'`)
    }

    const form = this.getOrCreateFormState(formId)

    // Create the button's triggerValue. Just like with a regular button,
    // `st.form_submit_button()` returns True during a rerun after
    // it's clicked.
    this.createWidgetState(submitButton, { fromUi: true }).triggerValue = true

    // Copy the form's values into widgetStates, delete the form's pending
    // changes, and send our widgetStates back to the server.
    this.widgetStates.copyFrom(form.widgetStates)
    form.widgetStates.clear()

    this.sendUpdateWidgetsMessage()
    this.syncFormsWithPendingChanges()

    // Reset the button's triggerValue.
    this.deleteWidgetState(submitButton.id)

    // If the form has the clearOnSubmit flag, we emit a signal to all widgets
    // in the form. Each widget that handles this signal will reset to their
    // default values, and submit those new default values to the WidgetStateManager
    // in their signal handlers. (Because all of these widgets are in a form,
    // none of these value submissions will trigger re-run requests.)
    if (form.clearOnSubmit) {
      form.formCleared.emit()
    }
  }

  /**
   * Sets the trigger value for the given widget ID to true, sends a rerunScript message
   * to the server, and then immediately unsets the trigger value.
   */
  public setTriggerValue(widget: WidgetInfo, source: Source): void {
    this.createWidgetState(widget, source).triggerValue = true
    this.onWidgetValueChanged(widget.formId, source)
    this.deleteWidgetState(widget.id)
  }

  public getBoolValue(widget: WidgetInfo): boolean | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "boolValue") {
      return state.boolValue as boolean
    }

    return undefined
  }

  public setBoolValue(
    widget: WidgetInfo,
    value: boolean,
    source: Source
  ): void {
    this.createWidgetState(widget, source).boolValue = value
    this.onWidgetValueChanged(widget.formId, source)
  }

  public getIntValue(widget: WidgetInfo): number | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "intValue") {
      return requireNumberInt(state.intValue as number)
    }

    return undefined
  }

  public setIntValue(widget: WidgetInfo, value: number, source: Source): void {
    this.createWidgetState(widget, source).intValue = value
    this.onWidgetValueChanged(widget.formId, source)
  }

  public getDoubleValue(widget: WidgetInfo): number | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "doubleValue") {
      return state.doubleValue as number
    }

    return undefined
  }

  public setDoubleValue(
    widget: WidgetInfo,
    value: number,
    source: Source
  ): void {
    this.createWidgetState(widget, source).doubleValue = value
    this.onWidgetValueChanged(widget.formId, source)
  }

  public getStringValue(widget: WidgetInfo): string | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "stringValue") {
      return state.stringValue as string
    }

    return undefined
  }

  public setStringValue(
    widget: WidgetInfo,
    value: string,
    source: Source
  ): void {
    this.createWidgetState(widget, source).stringValue = value
    this.onWidgetValueChanged(widget.formId, source)
  }

  public setStringArrayValue(
    widget: WidgetInfo,
    value: string[],
    source: Source
  ): void {
    this.createWidgetState(widget, source).stringArrayValue = new StringArray({
      data: value,
    })
    this.onWidgetValueChanged(widget.formId, source)
  }

  public getStringArrayValue(widget: WidgetInfo): string[] | undefined {
    const state = this.getWidgetState(widget)
    if (
      state != null &&
      state.value === "stringArrayValue" &&
      state.stringArrayValue != null &&
      state.stringArrayValue.data != null
    ) {
      return state.stringArrayValue.data
    }

    return undefined
  }

  public getDoubleArrayValue(widget: WidgetInfo): number[] | undefined {
    const state = this.getWidgetState(widget)
    if (
      state != null &&
      state.value === "doubleArrayValue" &&
      state.doubleArrayValue != null &&
      state.doubleArrayValue.data != null
    ) {
      return state.doubleArrayValue.data
    }

    return undefined
  }

  public setDoubleArrayValue(
    widget: WidgetInfo,
    value: number[],
    source: Source
  ): void {
    this.createWidgetState(widget, source).doubleArrayValue = new DoubleArray({
      data: value,
    })
    this.onWidgetValueChanged(widget.formId, source)
  }

  public getIntArrayValue(widget: WidgetInfo): number[] | undefined {
    const state = this.getWidgetState(widget)
    if (
      state != null &&
      state.value === "intArrayValue" &&
      state.intArrayValue != null &&
      state.intArrayValue.data != null
    ) {
      return state.intArrayValue.data.map(requireNumberInt)
    }

    return undefined
  }

  public setIntArrayValue(
    widget: WidgetInfo,
    value: number[],
    source: Source
  ): void {
    this.createWidgetState(widget, source).intArrayValue = new SInt64Array({
      data: value,
    })
    this.onWidgetValueChanged(widget.formId, source)
  }

  public getJsonValue(widget: WidgetInfo): string | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "jsonValue") {
      return state.jsonValue as string
    }

    return undefined
  }

  public setJsonValue(widget: WidgetInfo, value: any, source: Source): void {
    this.createWidgetState(widget, source).jsonValue =
      typeof value === "string" ? value : JSON.stringify(value)
    this.onWidgetValueChanged(widget.formId, source)
  }

  public setArrowValue(
    widget: WidgetInfo,
    value: IArrowTable,
    source: Source
  ): void {
    this.createWidgetState(widget, source).arrowValue = value
    this.onWidgetValueChanged(widget.formId, source)
  }

  public getArrowValue(widget: WidgetInfo): IArrowTable | undefined {
    const state = this.getWidgetState(widget)
    if (
      state != null &&
      state.value === "arrowValue" &&
      state.arrowValue != null
    ) {
      return state.arrowValue
    }

    return undefined
  }

  public setBytesValue(
    widget: WidgetInfo,
    value: Uint8Array,
    source: Source
  ): void {
    this.createWidgetState(widget, source).bytesValue = value
    this.onWidgetValueChanged(widget.formId, source)
  }

  public getBytesValue(widget: WidgetInfo): Uint8Array | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "bytesValue") {
      return state.bytesValue as Uint8Array
    }

    return undefined
  }

  public setFileUploaderStateValue(
    widget: WidgetInfo,
    value: IFileUploaderState,
    source: Source
  ): void {
    this.createWidgetState(widget, source).fileUploaderStateValue = value
    this.onWidgetValueChanged(widget.formId, source)
  }

  public getFileUploaderStateValue(
    widget: WidgetInfo
  ): IFileUploaderState | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "fileUploaderStateValue") {
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
    source: Source
  ): void {
    if (isValidFormId(formId)) {
      this.syncFormsWithPendingChanges()
    } else if (source.fromUi) {
      this.sendUpdateWidgetsMessage()
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

  public sendUpdateWidgetsMessage(): void {
    this.props.sendRerunBackMsg(this.widgetStates.createWidgetStatesMsg())
  }

  /**
   * Remove the state of widgets that are not contained in `activeIds`.
   * This is called when a script finishes running, so that we don't retain
   * data for widgets that have been removed from the app.
   */
  public removeInactive(activeIds: Set<string>): void {
    this.widgetStates.removeInactive(activeIds)
    this.forms.forEach(form => form.widgetStates.removeInactive(activeIds))
  }

  /**
   * Create and return a new WidgetState proto for the given widget ID,
   * overwriting any that currently exists. If the widget belongs to a form,
   * the WidgetState will be created inside the form's WidgetStateDict.
   */
  private createWidgetState(widget: WidgetInfo, source: Source): WidgetState {
    const addToForm = isValidFormId(widget.formId) && source.fromUi
    const widgetStateDict = addToForm
      ? this.getOrCreateFormState(widget.formId).widgetStates
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

      if (formState != null) {
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
    if (form != null) {
      return form
    }

    form = new FormState()
    this.forms.set(formId, form)
    return form
  }

  /** Store the IDs of all forms with in-progress uploads. */
  public setFormsWithUploads(formsWithUploads: Set<string>): void {
    this.updateFormsData(draft => {
      draft.formsWithUploads = formsWithUploads
    })
  }

  /**
   * Called by FormSubmitButton on creation. Increment submitButtonCount for
   * the given form, and update FormsData.
   */
  public incrementSubmitButtonCount(formId: string): void {
    this.setSubmitButtonCount(
      formId,
      WidgetStateManager.getSubmitButtonCount(this.formsData, formId) + 1
    )
  }

  /**
   * Called by FormSubmitButton on creation. Decrement submitButtonCount for
   * the given form, and update FormsData.
   */
  public decrementSubmitButtonCount(formId: string): void {
    this.setSubmitButtonCount(
      formId,
      WidgetStateManager.getSubmitButtonCount(this.formsData, formId) - 1
    )
  }

  private setSubmitButtonCount(formId: string, count: number): void {
    if (count < 0) {
      throw new Error(`Bad submitButtonCount value ${count} (must be >= 0)`)
    }

    this.updateFormsData(draft => {
      draft.submitButtonCount.set(formId, count)
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

  private static getSubmitButtonCount(
    data: FormsData,
    formId: string
  ): number {
    const count = data.submitButtonCount.get(formId)
    return count !== undefined ? count : 0
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
    `value ${value} cannot be converted to number without a loss of precision!`
  )
}
