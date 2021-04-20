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

import {
  DoubleArray,
  IArrowTable,
  SInt64Array,
  StringArray,
  WidgetState,
  WidgetStates,
} from "src/autogen/proto"
import _ from "lodash"
import { Long, util } from "protobufjs"
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

  /**
   * Remove the state of widgets that are not contained in `activeIds`.
   */
  public clean(activeIds: Set<string>): void {
    this.widgetStates.forEach((value, key) => {
      if (!activeIds.has(key)) {
        this.widgetStates.delete(key)
      }
    })
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
}

interface Props {
  /** Callback to delivers a message to the server */
  sendRerunBackMsg: (widgetStates: WidgetStates) => void

  /** Callback invoked when the set of "forms with pending changes" changes */
  pendingFormsChanged: (pendingFormIds: Set<string>) => void
}

/**
 * Manages widget values, and sends widget update messages back to the server.
 */
export class WidgetStateManager {
  private readonly props: Props

  // Top-level widget state dictionary.
  private readonly widgetStates = new WidgetStateDict()

  // Forms store pending widget states separately. When the form is submitted,
  // we copy its WidgetStateDict into the main widgetStates object.
  private readonly pendingForms = new Map<string, WidgetStateDict>()

  // The last set of pendingFormIds we delivered to the
  // pendingFormsChanged function. We track this so that we can avoid
  // calling the `pendingFormsChanged` callback superfluously.
  private lastPendingFormIds = new Set<string>()

  constructor(props: Props) {
    this.props = props
  }

  /**
   * Commit pending changes for widgets that belong to the given form,
   * and send a rerunBackMsg to the server.
   */
  public submitForm(submitButton: WidgetInfo): void {
    if (!isValidFormId(submitButton.formId)) {
      // This should never get thrown - only FormSubmitButton calls this
      // function.
      throw new Error(`invalid formID '${submitButton.formId}'`)
    }

    // Create the button's triggerValue. Just like with a regular button,
    // `st.form_submit_button()` returns True during a rerun after
    // it's clicked.
    this.createWidgetState(submitButton, { fromUi: true }).triggerValue = true

    const form = this.pendingForms.get(submitButton.formId)
    if (form == null) {
      // Sanity check. This should never be possible: the call to
      // `createWidgetState` will have created our form.
      throw new Error(`submitForm: FormData is unexpectedly null`)
    }

    // Copy the form's values into widgetStates, delete the form's pending
    // changes, and send our widgetStates back to the server.
    this.widgetStates.copyFrom(form)
    this.pendingForms.delete(submitButton.formId)
    this.sendUpdateWidgetsMessage()
    this.maybeCallPendingFormsChanged()

    // Reset the button's triggerValue.
    this.deleteWidgetState(submitButton.id)
  }

  /**
   * Sets the trigger value for the given widget ID to true, sends a rerunScript message
   * to the server, and then immediately unsets the trigger value.
   */
  public setTriggerValue(widget: WidgetInfo, source: Source): void {
    this.createWidgetState(widget, source).triggerValue = true
    this.onValueChanged(widget.formId, source)
    this.deleteWidgetState(widget.id)
  }

  public getBoolValue(widget: WidgetInfo): boolean | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "boolValue") {
      return state.boolValue
    }

    return undefined
  }

  public setBoolValue(
    widget: WidgetInfo,
    value: boolean,
    source: Source
  ): void {
    this.createWidgetState(widget, source).boolValue = value
    this.onValueChanged(widget.formId, source)
  }

  public getIntValue(widget: WidgetInfo): number | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "intValue") {
      return requireNumberInt(state.intValue)
    }

    return undefined
  }

  public setIntValue(widget: WidgetInfo, value: number, source: Source): void {
    this.createWidgetState(widget, source).intValue = value
    this.onValueChanged(widget.formId, source)
  }

  public getDoubleValue(widget: WidgetInfo): number | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "doubleValue") {
      return state.doubleValue
    }

    return undefined
  }

  public setDoubleValue(
    widget: WidgetInfo,
    value: number,
    source: Source
  ): void {
    this.createWidgetState(widget, source).doubleValue = value
    this.onValueChanged(widget.formId, source)
  }

  public getStringValue(widget: WidgetInfo): string | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "stringValue") {
      return state.stringValue
    }

    return undefined
  }

  public setStringValue(
    widget: WidgetInfo,
    value: string,
    source: Source
  ): void {
    this.createWidgetState(widget, source).stringValue = value
    this.onValueChanged(widget.formId, source)
  }

  public setStringArrayValue(
    widget: WidgetInfo,
    value: string[],
    source: Source
  ): void {
    this.createWidgetState(widget, source).stringArrayValue = new StringArray({
      data: value,
    })
    this.onValueChanged(widget.formId, source)
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
    this.onValueChanged(widget.formId, source)
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
    this.onValueChanged(widget.formId, source)
  }

  public getJsonValue(widget: WidgetInfo): string | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "jsonValue") {
      return state.jsonValue
    }

    return undefined
  }

  public setJsonValue(widget: WidgetInfo, value: any, source: Source): void {
    this.createWidgetState(widget, source).jsonValue = JSON.stringify(value)
    this.onValueChanged(widget.formId, source)
  }

  public setArrowValue(
    widget: WidgetInfo,
    value: IArrowTable,
    source: Source
  ): void {
    this.createWidgetState(widget, source).arrowValue = value
    this.onValueChanged(widget.formId, source)
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
    this.onValueChanged(widget.formId, source)
  }

  public getBytesValue(widget: WidgetInfo): Uint8Array | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "bytesValue") {
      return state.bytesValue
    }

    return undefined
  }

  /**
   * Perform housekeeping every time a widget value changes.
   * - If the widget does not belong to a form, and the value update came from
   *   a user action, send the "updateWidgets" message
   * - If the widget belong to a form, dispatch the "pendingFormsChanged"
   *   callback if needed.
   *
   * Called by every "setValue" function.
   */
  private onValueChanged(formId: string | undefined, source: Source): void {
    if (isValidFormId(formId)) {
      this.maybeCallPendingFormsChanged()
    } else if (source.fromUi) {
      this.sendUpdateWidgetsMessage()
    }
  }

  /**
   * Call the `pendingFormsChanged` callback if our pendingFormIds has changed
   * since it was last called.
   */
  private maybeCallPendingFormsChanged(): void {
    const pendingFormIds = this.getPendingFormIds()
    if (_.isEqual(pendingFormIds, this.lastPendingFormIds)) {
      return
    }

    this.lastPendingFormIds = pendingFormIds
    this.props.pendingFormsChanged(new Set<string>(pendingFormIds))
  }

  /** Return the IDs of all forms that have pending changes. */
  private getPendingFormIds(): Set<string> {
    const ids = new Set<string>()
    this.pendingForms.forEach((form, formId) => {
      if (!form.isEmpty) {
        ids.add(formId)
      }
    })
    return ids
  }

  public sendUpdateWidgetsMessage(): void {
    this.props.sendRerunBackMsg(this.widgetStates.createWidgetStatesMsg())
  }

  /**
   * Remove the state of widgets that are not contained in `activeIds`.
   */
  public clean(activeIds: Set<string>): void {
    this.widgetStates.clean(activeIds)
    this.pendingForms.forEach(form => form.clean(activeIds))
  }

  /**
   * Create and return a new WidgetState proto for the given widget ID,
   * overwriting any that currently exists. If the widget belongs to a form,
   * the WidgetState will be created inside the form's WidgetStateDict.
   */
  private createWidgetState(widget: WidgetInfo, source: Source): WidgetState {
    const addToForm = isValidFormId(widget.formId) && source.fromUi
    const widgetStateDict = addToForm
      ? this.getOrCreateForm(widget.formId)
      : this.widgetStates

    return widgetStateDict.createState(widget.id)
  }

  /**
   * Get the WidgetState proto for the given widget ID, if it exists.
   */
  private getWidgetState(widget: WidgetInfo): WidgetState | undefined {
    // If the widget belongs to a form, try its form value first.
    if (isValidFormId(widget.formId)) {
      const formState = this.pendingForms
        .get(widget.formId)
        ?.getState(widget.id)

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

  private getOrCreateForm(formId: string): WidgetStateDict {
    let form = this.pendingForms.get(formId)
    if (form != null) {
      return form
    }

    form = new WidgetStateDict()
    this.pendingForms.set(formId, form)
    return form
  }
}
