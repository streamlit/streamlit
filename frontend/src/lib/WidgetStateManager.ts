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
} from "autogen/proto"
import { Long, util } from "protobufjs"

export interface Source {
  fromUi: boolean
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
 * Manages widget values, and sends widget update messages back to the server.
 */
export class WidgetStateManager {
  // Called to deliver a message to the server
  private readonly sendRerunBackMsg: (widgetStates: WidgetStates) => void

  private readonly widgetStates: Map<string, WidgetState> = new Map<
    string,
    WidgetState
  >()

  constructor(sendRerunBackMsg: (widgetStates: WidgetStates) => void) {
    this.sendRerunBackMsg = sendRerunBackMsg
  }

  /**
   * True if our widget state dict is empty. This will be the case only when the browser
   * initially connects to the server for the first time.
   */
  public get isEmpty(): boolean {
    return this.widgetStates.size === 0
  }

  /**
   * Sets the trigger value for the given widget ID to true, sends a rerunScript message
   * to the server, and then immediately unsets the trigger value.
   */
  public setTriggerValue(widgetId: string, source: Source): void {
    this.createWidgetStateProto(widgetId).triggerValue = true
    this.maybeSendUpdateWidgetsMessage(source)
    this.deleteWidgetStateProto(widgetId)
  }

  public getBoolValue(widgetId: string): boolean | undefined {
    const state = this.getWidgetStateProto(widgetId)
    if (state != null && state.value === "boolValue") {
      return state.boolValue
    }

    return undefined
  }

  public setBoolValue(widgetId: string, value: boolean, source: Source): void {
    this.createWidgetStateProto(widgetId).boolValue = value
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public getIntValue(widgetId: string): number | undefined {
    const state = this.getWidgetStateProto(widgetId)
    if (state != null && state.value === "intValue") {
      return requireNumberInt(state.intValue)
    }

    return undefined
  }

  public setIntValue(widgetId: string, value: number, source: Source): void {
    this.createWidgetStateProto(widgetId).intValue = value
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public getDoubleValue(widgetId: string): number | undefined {
    const state = this.getWidgetStateProto(widgetId)
    if (state != null && state.value === "doubleValue") {
      return state.doubleValue
    }

    return undefined
  }

  public setDoubleValue(
    widgetId: string,
    value: number,
    source: Source
  ): void {
    this.createWidgetStateProto(widgetId).doubleValue = value
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public getStringValue(widgetId: string): string | undefined {
    const state = this.getWidgetStateProto(widgetId)
    if (state != null && state.value === "stringValue") {
      return state.stringValue
    }

    return undefined
  }

  public setStringValue(
    widgetId: string,
    value: string,
    source: Source
  ): void {
    this.createWidgetStateProto(widgetId).stringValue = value
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public setStringArrayValue(
    widgetId: string,
    value: string[],
    source: Source
  ): void {
    this.createWidgetStateProto(widgetId).stringArrayValue = new StringArray({
      data: value,
    })
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public getStringArrayValue(widgetId: string): string[] | undefined {
    const state = this.getWidgetStateProto(widgetId)
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

  public getDoubleArrayValue(widgetId: string): number[] | undefined {
    const state = this.getWidgetStateProto(widgetId)
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
    widgetId: string,
    value: number[],
    source: Source
  ): void {
    this.createWidgetStateProto(widgetId).doubleArrayValue = new DoubleArray({
      data: value,
    })
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public getIntArrayValue(widgetId: string): number[] | undefined {
    const state = this.getWidgetStateProto(widgetId)
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
    widgetId: string,
    value: number[],
    source: Source
  ): void {
    this.createWidgetStateProto(widgetId).intArrayValue = new SInt64Array({
      data: value,
    })
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public getJsonValue(widgetId: string): string | undefined {
    const state = this.getWidgetStateProto(widgetId)
    if (state != null && state.value === "jsonValue") {
      return state.jsonValue
    }

    return undefined
  }

  public setJsonValue(widgetId: string, value: any, source: Source): void {
    this.createWidgetStateProto(widgetId).jsonValue = JSON.stringify(value)
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public setArrowValue(
    widgetId: string,
    value: IArrowTable,
    source: Source
  ): void {
    this.createWidgetStateProto(widgetId).arrowValue = value
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public getArrowValue(widgetId: string): IArrowTable | undefined {
    const state = this.getWidgetStateProto(widgetId)
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
    widgetId: string,
    value: Uint8Array,
    source: Source
  ): void {
    this.createWidgetStateProto(widgetId).bytesValue = value
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public getBytesValue(widgetId: string): Uint8Array | undefined {
    const state = this.getWidgetStateProto(widgetId)
    if (state != null && state.value === "bytesValue") {
      return state.bytesValue
    }

    return undefined
  }

  private maybeSendUpdateWidgetsMessage(source: Source): void {
    if (source.fromUi) {
      this.sendUpdateWidgetsMessage()
    }
  }

  public sendUpdateWidgetsMessage(): void {
    this.sendRerunBackMsg(this.createWidgetStatesMsg())
  }

  /**
   * Remove the state of widgets that are not contained in `activeIds`.
   */
  public clean(activeIds: Set<string>): void {
    this.widgetStates.forEach((value, key) => {
      if (!activeIds.has(key)) {
        this.deleteWidgetStateProto(key)
      }
    })
  }

  private createWidgetStatesMsg(): WidgetStates {
    const msg = new WidgetStates()
    this.widgetStates.forEach(value => msg.widgets.push(value))
    return msg
  }

  /**
   * Create a new WidgetState proto for the widget with the given ID,
   * overwriting any that currently exists.
   */
  private createWidgetStateProto(id: string): WidgetState {
    const state = new WidgetState({ id })
    this.widgetStates.set(id, state)
    return state
  }

  /**
   * Removes the WidgetState proto with the given id, if it exists
   */
  private deleteWidgetStateProto(id: string): void {
    this.widgetStates.delete(id)
  }

  private getWidgetStateProto(id: string): WidgetState | undefined {
    return this.widgetStates.get(id)
  }
}
