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
import { IArrowTable, IFileUploaderState, WidgetState, WidgetStates } from "src/autogen/proto";
import { SignalConnection } from "typed-signals";
export interface Source {
    fromUi: boolean;
}
/** Common widget protobuf fields that are used by the WidgetStateManager. */
export interface WidgetInfo {
    id: string;
    formId: string;
}
/**
 * Immutable structure that exposes public data about all the forms in the app.
 * WidgetStateManager produces new instances of this type when forms data
 * changes.
 */
export interface FormsData {
    /** Forms that have unsubmitted changes. */
    readonly formsWithPendingChanges: Set<string>;
    /** Forms that have in-progress file uploads. */
    readonly formsWithUploads: Set<string>;
    /**
     * Mapping of formID:numberOfSubmitButtons. (Most forms will have only one,
     * but it's not an error to have multiple.)
     */
    readonly submitButtonCount: Map<string, number>;
}
/** Create an empty FormsData instance. */
export declare function createFormsData(): FormsData;
/**
 * A Dictionary that maps widgetID -> WidgetState, and provides some utility
 * functions.
 */
export declare class WidgetStateDict {
    private readonly widgetStates;
    /**
     * Create a new WidgetState proto for the widget with the given ID,
     * overwriting any that currently exists.
     */
    createState(widgetId: string): WidgetState;
    /** Return the WidgetState for the given widgetID if it exists. */
    getState(widgetId: string): WidgetState | undefined;
    /** Remove the WidgetState proto with the given id, if it exists. */
    deleteState(widgetId: string): void;
    /** Remove the state of widgets that are not contained in `activeIds`. */
    removeInactive(activeIds: Set<string>): void;
    /** Remove all widget states. */
    clear(): void;
    get isEmpty(): boolean;
    createWidgetStatesMsg(): WidgetStates;
    /**
     * Copy the contents of another WidgetStateDict into this one, overwriting
     * any values with duplicate keys.
     */
    copyFrom(other: WidgetStateDict): void;
    /** Call a function for each value in the dict. */
    forEach(callbackfn: (value: WidgetState) => void): void;
}
interface Props {
    /** Callback to deliver a message to the server */
    sendRerunBackMsg: (widgetStates: WidgetStates) => void;
    /**
     * Callback invoked whenever our FormsData changed. (Because FormsData
     * is immutable, any changes to it result in a new instance being created.)
     */
    formsDataChanged: (formsData: FormsData) => void;
}
/**
 * Manages widget values, and sends widget update messages back to the server.
 */
export declare class WidgetStateManager {
    private readonly props;
    private readonly widgetStates;
    private readonly forms;
    private formsData;
    constructor(props: Props);
    /**
     * Register a function that will be called when the given form is cleared.
     * Returns an object that can be used to de-register the listener.
     */
    addFormClearedListener(formId: string, listener: () => void): SignalConnection;
    /**
     * Register a Form, and assign its clearOnSubmit value.
     * The `Form` element calls this when it's first mounted.
     */
    setFormClearOnSubmit(formId: string, clearOnSubmit: boolean): void;
    /**
     * Commit pending changes for widgets that belong to the given form,
     * and send a rerunBackMsg to the server.
     */
    submitForm(submitButton: WidgetInfo): void;
    /**
     * Sets the trigger value for the given widget ID to true, sends a rerunScript message
     * to the server, and then immediately unsets the trigger value.
     */
    setTriggerValue(widget: WidgetInfo, source: Source): void;
    getBoolValue(widget: WidgetInfo): boolean | undefined;
    setBoolValue(widget: WidgetInfo, value: boolean, source: Source): void;
    getIntValue(widget: WidgetInfo): number | undefined;
    setIntValue(widget: WidgetInfo, value: number, source: Source): void;
    getDoubleValue(widget: WidgetInfo): number | undefined;
    setDoubleValue(widget: WidgetInfo, value: number, source: Source): void;
    getStringValue(widget: WidgetInfo): string | undefined;
    setStringValue(widget: WidgetInfo, value: string, source: Source): void;
    setStringArrayValue(widget: WidgetInfo, value: string[], source: Source): void;
    getStringArrayValue(widget: WidgetInfo): string[] | undefined;
    getDoubleArrayValue(widget: WidgetInfo): number[] | undefined;
    setDoubleArrayValue(widget: WidgetInfo, value: number[], source: Source): void;
    getIntArrayValue(widget: WidgetInfo): number[] | undefined;
    setIntArrayValue(widget: WidgetInfo, value: number[], source: Source): void;
    getJsonValue(widget: WidgetInfo): string | undefined;
    setJsonValue(widget: WidgetInfo, value: any, source: Source): void;
    setArrowValue(widget: WidgetInfo, value: IArrowTable, source: Source): void;
    getArrowValue(widget: WidgetInfo): IArrowTable | undefined;
    setBytesValue(widget: WidgetInfo, value: Uint8Array, source: Source): void;
    getBytesValue(widget: WidgetInfo): Uint8Array | undefined;
    setFileUploaderStateValue(widget: WidgetInfo, value: IFileUploaderState, source: Source): void;
    getFileUploaderStateValue(widget: WidgetInfo): IFileUploaderState | undefined;
    /**
     * Perform housekeeping every time a widget value changes.
     * - If the widget does not belong to a form, and the value update came from
     *   a user action, send the "updateWidgets" message
     * - If the widget belongs to a form, dispatch the "pendingFormsChanged"
     *   callback if needed.
     *
     * Called by every "setValue" function.
     */
    private onWidgetValueChanged;
    /**
     * Update FormsData.formsWithPendingChanges with the current set of forms
     * that have pending changes. This is called after widget values are updated.
     */
    private syncFormsWithPendingChanges;
    sendUpdateWidgetsMessage(): void;
    /**
     * Remove the state of widgets that are not contained in `activeIds`.
     * This is called when a script finishes running, so that we don't retain
     * data for widgets that have been removed from the app.
     */
    removeInactive(activeIds: Set<string>): void;
    /**
     * Create and return a new WidgetState proto for the given widget ID,
     * overwriting any that currently exists. If the widget belongs to a form,
     * the WidgetState will be created inside the form's WidgetStateDict.
     */
    private createWidgetState;
    /**
     * Get the WidgetState proto for the given widget ID, if it exists.
     */
    private getWidgetState;
    /**
     * Remove the WidgetState proto with the given id, if it exists
     */
    private deleteWidgetState;
    /** Return the FormState for the given form. Create it if it doesn't exist. */
    private getOrCreateFormState;
    /** Store the IDs of all forms with in-progress uploads. */
    setFormsWithUploads(formsWithUploads: Set<string>): void;
    /**
     * Called by FormSubmitButton on creation. Increment submitButtonCount for
     * the given form, and update FormsData.
     */
    incrementSubmitButtonCount(formId: string): void;
    /**
     * Called by FormSubmitButton on creation. Decrement submitButtonCount for
     * the given form, and update FormsData.
     */
    decrementSubmitButtonCount(formId: string): void;
    private setSubmitButtonCount;
    /**
     * Produce a new FormsData with the given recipe, and fire off the
     * formsDataChanged callback with that new data.
     */
    private updateFormsData;
    private static getSubmitButtonCount;
}
export {};
