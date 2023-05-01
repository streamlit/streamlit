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

import { isValidFormId } from "src/lib/util/utils"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import { SignalConnection } from "typed-signals"

export class FormClearHelper {
  private formClearListener?: SignalConnection

  private lastWidgetMgr?: WidgetStateManager

  private lastFormId?: string

  /**
   * Register the listener that will be called when the widget's form is cleared.
   * This should be called in the `render` function of every class-based widget
   * element - it mimics the behavior of a `useEffect` hook, and ensures that
   * subscription and unsubscription happen correctly.
   *
   * Hooks-based widgets can just use `useEffect` and call
   * `widgetMgr.addFormClearedListener` directly.
   */
  public manageFormClearListener(
    widgetMgr: WidgetStateManager,
    formId: string,
    listener: () => void
  ): void {
    // If we're already subscribed and our params haven't changed, early-out.
    if (
      this.formClearListener != null &&
      this.lastWidgetMgr === widgetMgr &&
      this.lastFormId === formId
    ) {
      return
    }

    // Close our previous subscription, if we had one.
    this.disconnect()

    // If we're not part of a form, there's nothing to do.
    if (!isValidFormId(formId)) {
      return
    }

    // Make the new subscription.
    this.formClearListener = widgetMgr.addFormClearedListener(formId, listener)
    this.lastWidgetMgr = widgetMgr
    this.lastFormId = formId
  }

  /**
   * Disconnect from the form-clear signal, if we're connected.
   * This should be called from the `componentWillUnmount` function of every
   * element that uses it.
   */
  public disconnect(): void {
    this.formClearListener?.disconnect()
    this.formClearListener = undefined
    this.lastWidgetMgr = undefined
    this.lastFormId = undefined
  }
}
