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
  IBackMsg,
  IntArray,
  FloatArray,
  StringArray,
  WidgetState,
  WidgetStates,
} from "autogen/proto"

import { Set as ImmutableSet } from "immutable"
import { Long } from "protobufjs"

export interface Source {
  fromUi: boolean
}

/**
 * Manages widget values, and sends widget update messages back to the server.
 */
export class WidgetStateManager {
  // Called to deliver a message to the server
  private readonly sendBackMsg: (msg: IBackMsg) => void
  private readonly widgetStates: Map<string, WidgetState> = new Map<
    string,
    WidgetState
  >()

  constructor(sendBackMsg: (msg: IBackMsg) => void) {
    this.sendBackMsg = sendBackMsg
  }

  /**
   * True if our widget state dict is empty. This will be the case only when the browser
   * initially connects to the server for the first time.
   */
  public get isEmpty(): boolean {
    return this.widgetStates.size === 0
  }

  /**
   * Sets the trigger value for the given widget ID to true, sends an updateWidgets message
   * to the server, and then immediately unsets the trigger value.
   */
  public setTriggerValue(widgetId: string, source: Source): void {
    this.getOrCreateWidgetStateProto(widgetId).triggerValue = true
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
    this.getOrCreateWidgetStateProto(widgetId).boolValue = value
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public getIntValue(widgetId: string): number | Long | undefined {
    const state = this.getWidgetStateProto(widgetId)
    if (state != null && state.value === "intValue") {
      return state.intValue
    }

    return undefined
  }

  public setIntValue(widgetId: string, value: number, source: Source): void {
    this.getOrCreateWidgetStateProto(widgetId).intValue = value
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public getFloatValue(widgetId: string): number | undefined {
    const state = this.getWidgetStateProto(widgetId)
    if (state != null && state.value === "floatValue") {
      return state.floatValue
    }

    return undefined
  }

  public setFloatValue(widgetId: string, value: number, source: Source): void {
    this.getOrCreateWidgetStateProto(widgetId).floatValue = value
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
    this.getOrCreateWidgetStateProto(widgetId).stringValue = value
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public setStringArrayValue(
    widgetId: string,
    value: string[],
    source: Source
  ): void {
    this.getOrCreateWidgetStateProto(
      widgetId
    ).stringArrayValue = StringArray.fromObject({ data: value })
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public getFloatArrayValue(widgetId: string): number[] | undefined {
    const state = this.getWidgetStateProto(widgetId)
    if (
      state != null &&
      state.value === "floatArrayValue" &&
      state.floatArrayValue != null &&
      state.floatArrayValue.value != null
    ) {
      return state.floatArrayValue.value
    }

    return undefined
  }

  public setFloatArrayValue(
    widgetId: string,
    value: number[],
    source: Source
  ): void {
    this.getOrCreateWidgetStateProto(
      widgetId
    ).floatArrayValue = FloatArray.fromObject({ value })
    this.maybeSendUpdateWidgetsMessage(source)
  }

  public getIntArrayValue(widgetId: string): (number | Long)[] | undefined {
    const state = this.getWidgetStateProto(widgetId)
    if (
      state != null &&
      state.value === "intArrayValue" &&
      state.intArrayValue != null &&
      state.intArrayValue.value != null
    ) {
      return state.intArrayValue.value
    }

    return undefined
  }

  public setIntArrayValue(
    widgetId: string,
    value: number[],
    source: Source
  ): void {
    this.getOrCreateWidgetStateProto(
      widgetId
    ).intArrayValue = IntArray.fromObject({ value })
    this.maybeSendUpdateWidgetsMessage(source)
  }

  private maybeSendUpdateWidgetsMessage(source: Source): void {
    if (source.fromUi) {
      this.sendUpdateWidgetsMessage()
    }
  }

  public sendUpdateWidgetsMessage(): void {
    this.sendBackMsg({ updateWidgets: this.createWigetStatesMsg() })
  }

  /**
   * Remove the state of widgets that are not contained in `active_ids`.
   */
  public clean(active_ids: ImmutableSet<string>): void {
    this.widgetStates.forEach((value, key) => {
      if (!active_ids.includes(key)) {
        this.deleteWidgetStateProto(key)
      }
    })
  }

  private createWigetStatesMsg(): WidgetStates {
    const msg = new WidgetStates()
    this.widgetStates.forEach(value => msg.widgets.push(value))
    return msg
  }

  /**
   * Returns the WidgetState proto for the widget with the given ID.
   * If no such WidgetState exists yet, one will be created.
   */
  private getOrCreateWidgetStateProto(id: string): WidgetState {
    let state = this.getWidgetStateProto(id)
    if (state == null) {
      state = new WidgetState({ id })
      this.widgetStates.set(id, state)
    }
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
