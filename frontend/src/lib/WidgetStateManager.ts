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

import {
  DoubleArray,
  IArrowTable,
  SInt64Array,
  StringArray,
  WidgetState,
  WidgetStates,
} from "autogen/proto"
import { Long, util } from "protobufjs"

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

/** True if the given form ID is non-null and non-empty. */
function isValidFormId(formId?: string): formId is string {
  return formId != null && formId.length > 0
}

/**
 * A Dictionary that maps widgetID -> WidgetState, and provides some utility
 * functions.
 */
class WidgetStateDict {
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

/**
 * Manages widget values, and sends widget update messages back to the server.
 */
export class WidgetStateManager {
  // Called to deliver a message to the server
  private readonly sendRerunBackMsg: (widgetStates: WidgetStates) => void

  // Top-level widget state dictionary.
  private readonly widgetStates = new WidgetStateDict()

  // Forms store pending widget states separately. When the form is submitted,
  // we copy its WidgetStateDict into the main widgetStates object.
  private readonly pendingForms = new Map<string, WidgetStateDict>()

  constructor(sendRerunBackMsg: (widgetStates: WidgetStates) => void) {
    this.sendRerunBackMsg = sendRerunBackMsg
  }

  /**
   * Commit pending changes for widgets that belong to the given form,
   * and send a rerunBackMsg to the server.
   *
   * If the given form has no pending changes, this is a no-op.
   */
  public submitForm(formId: string): void {
    if (!isValidFormId(formId)) {
      return
    }

    const form = this.pendingForms.get(formId)
    if (form == null || form.isEmpty) {
      return
    }

    // Copy the form's values into widgetStates, delete the form's pending
    // changes, and send our widgetStates back to the server.
    this.widgetStates.copyFrom(form)
    this.pendingForms.delete(formId)
    this.sendUpdateWidgetsMessage()
  }

  /**
   * Sets the trigger value for the given widget ID to true, sends a rerunScript message
   * to the server, and then immediately unsets the trigger value.
   */
  public setTriggerValue(widget: WidgetInfo, source: Source): void {
    this.createWidgetState(widget).triggerValue = true
    this.maybeSendUpdateWidgetsMessage(widget.formId, source)
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
    this.createWidgetState(widget).boolValue = value
    this.maybeSendUpdateWidgetsMessage(widget.formId, source)
  }

  public getIntValue(widget: WidgetInfo): number | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "intValue") {
      return requireNumberInt(state.intValue)
    }

    return undefined
  }

  public setIntValue(widget: WidgetInfo, value: number, source: Source): void {
    this.createWidgetState(widget).intValue = value
    this.maybeSendUpdateWidgetsMessage(widget.formId, source)
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
    this.createWidgetState(widget).doubleValue = value
    this.maybeSendUpdateWidgetsMessage(widget.formId, source)
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
    this.createWidgetState(widget).stringValue = value
    this.maybeSendUpdateWidgetsMessage(widget.formId, source)
  }

  public setStringArrayValue(
    widget: WidgetInfo,
    value: string[],
    source: Source
  ): void {
    this.createWidgetState(widget).stringArrayValue = new StringArray({
      data: value,
    })
    this.maybeSendUpdateWidgetsMessage(widget.formId, source)
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
    this.createWidgetState(widget).doubleArrayValue = new DoubleArray({
      data: value,
    })
    this.maybeSendUpdateWidgetsMessage(widget.formId, source)
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
    this.createWidgetState(widget).intArrayValue = new SInt64Array({
      data: value,
    })
    this.maybeSendUpdateWidgetsMessage(widget.formId, source)
  }

  public getJsonValue(widget: WidgetInfo): string | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "jsonValue") {
      return state.jsonValue
    }

    return undefined
  }

  public setJsonValue(widget: WidgetInfo, value: any, source: Source): void {
    this.createWidgetState(widget).jsonValue = JSON.stringify(value)
    this.maybeSendUpdateWidgetsMessage(widget.formId, source)
  }

  public setArrowValue(
    widget: WidgetInfo,
    value: IArrowTable,
    source: Source
  ): void {
    this.createWidgetState(widget).arrowValue = value
    this.maybeSendUpdateWidgetsMessage(widget.formId, source)
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
    this.createWidgetState(widget).bytesValue = value
    this.maybeSendUpdateWidgetsMessage(widget.formId, source)
  }

  public getBytesValue(widget: WidgetInfo): Uint8Array | undefined {
    const state = this.getWidgetState(widget)
    if (state != null && state.value === "bytesValue") {
      return state.bytesValue
    }

    return undefined
  }

  /**
   * Send the updateWidgets message - but only if the widget does not belong to
   * a form, and the value update came from a user action.
   *
   * Called by every "setValue" function.
   */
  private maybeSendUpdateWidgetsMessage(
    formId: string | undefined,
    source: Source
  ): void {
    if (!isValidFormId(formId) && source.fromUi) {
      this.sendUpdateWidgetsMessage()
    }
  }

  public sendUpdateWidgetsMessage(): void {
    this.sendRerunBackMsg(this.widgetStates.createWidgetStatesMsg())
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
  private createWidgetState(widget: WidgetInfo): WidgetState {
    const widgetStateDict = isValidFormId(widget.formId)
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
