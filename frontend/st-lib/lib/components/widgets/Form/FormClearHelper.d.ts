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
import { WidgetStateManager } from "src/lib/WidgetStateManager";
export declare class FormClearHelper {
    private formClearListener?;
    private lastWidgetMgr?;
    private lastFormId?;
    /**
     * Register the listener that will be called when the widget's form is cleared.
     * This should be called in the `render` function of every class-based widget
     * element - it mimics the behavior of a `useEffect` hook, and ensures that
     * subscription and unsubscription happen correctly.
     *
     * Hooks-based widgets can just use `useEffect` and call
     * `widgetMgr.addFormClearedListener` directly.
     */
    manageFormClearListener(widgetMgr: WidgetStateManager, formId: string, listener: () => void): void;
    /**
     * Disconnect from the form-clear signal, if we're connected.
     * This should be called from the `componentWillUnmount` function of every
     * element that uses it.
     */
    disconnect(): void;
}
