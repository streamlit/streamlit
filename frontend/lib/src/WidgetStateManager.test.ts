/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { Mock } from "vitest"
import { enableAllPlugins } from "immer"

import {
  ArrowTable as ArrowTableProto,
  Button as ButtonProto,
  FileUploaderState as FileUploaderStateProto,
  UploadedFileInfo as UploadedFileInfoProto,
} from "./proto"
import {
  createFormsData,
  FormsData,
  WidgetInfo,
  WidgetStateDict,
  WidgetStateManager,
} from "./WidgetStateManager"

const MOCK_ARROW_TABLE = new ArrowTableProto({
  data: new Uint8Array(),
  index: new Uint8Array(),
  columns: new Uint8Array(),
})

const MOCK_BYTES = new Uint8Array([0, 1, 2, 3])

const MOCK_JSON = { foo: "bar", baz: "qux" }

const MOCK_WIDGET = {
  id: "mockWidgetId",
  formId: "",
}

const MOCK_FORM_WIDGET = {
  id: "mockFormWidgetId",
  formId: "mockFormId",
}

const MOCK_FILE_UPLOADER_STATE = new FileUploaderStateProto({
  maxFileId: 42,
  uploadedFileInfo: [
    new UploadedFileInfoProto({
      id: 4,
      name: "bob",
      size: 5,
    }),

    new UploadedFileInfoProto({
      id: 42,
      name: "linus",
      size: 9001,
    }),
  ],
})

// Required by ImmerJS
enableAllPlugins()

describe("Widget State Manager", () => {
  let sendBackMsg: Mock
  let widgetMgr: WidgetStateManager
  let formsData: FormsData
  let onFormsDataChanged: Mock

  beforeEach(() => {
    formsData = createFormsData()
    sendBackMsg = vi.fn()
    onFormsDataChanged = vi.fn(newData => {
      formsData = newData
    })
    widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: sendBackMsg,
      formsDataChanged: onFormsDataChanged,
    })
  })

  /** Select the mock WidgetInfo to use for a test. */
  const getWidget = ({ insideForm }: { insideForm: boolean }): WidgetInfo => {
    return insideForm ? MOCK_FORM_WIDGET : MOCK_WIDGET
  }

  /** Assert calls of our callback functions. */
  const assertCallbacks = ({ insideForm }: { insideForm: boolean }): void => {
    if (insideForm) {
      expect(sendBackMsg).not.toHaveBeenCalled()
    } else {
      expect(sendBackMsg).toHaveBeenCalledTimes(1)
      expect(sendBackMsg).toHaveBeenCalledWith(
        expect.anything(),
        undefined, // fragmentId
        undefined,
        undefined
      )
    }
  }

  it.each([false, true])(
    "sets string value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setStringValue(
        widget,
        "mockStringValue",
        { fromUi: true },
        undefined
      )
      expect(widgetMgr.getStringValue(widget)).toBe("mockStringValue")
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets boolean value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setBoolValue(widget, true, { fromUi: true }, undefined)
      expect(widgetMgr.getBoolValue(widget)).toBe(true)
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets int value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setIntValue(widget, 100, { fromUi: true }, undefined)
      expect(widgetMgr.getIntValue(widget)).toBe(100)
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets float value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setDoubleValue(widget, 3.14, { fromUi: true }, undefined)
      expect(widgetMgr.getDoubleValue(widget)).toBe(3.14)
      assertCallbacks({ insideForm })
    }
  )

  /**
   * Buttons (which set trigger values) can't be used within forms, so this test
   * is not parameterized on insideForm.
   */
  it("sets trigger value correctly", () => {
    const widget = getWidget({ insideForm: false })
    widgetMgr.setTriggerValue(widget, { fromUi: true }, undefined)
    // @ts-expect-error
    expect(widgetMgr.getWidgetState(widget)).toBe(undefined)
    assertCallbacks({ insideForm: false })
  })

  /**
   * String Triggers can't be used within forms, so this test
   * is not parameterized on insideForm.
   */
  it("sets string trigger value correctly", () => {
    const widget = getWidget({ insideForm: false })
    widgetMgr.setStringTriggerValue(
      widget,
      "sample string",
      { fromUi: true },
      undefined
    )
    // @ts-expect-error
    expect(widgetMgr.getWidgetState(widget)).toBe(undefined)
    assertCallbacks({ insideForm: false })
  })

  it.each([false, true])(
    "sets string array value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setStringArrayValue(
        widget,
        ["foo", "bar", "baz"],
        {
          fromUi: true,
        },
        undefined
      )
      expect(widgetMgr.getStringArrayValue(widget)).toEqual([
        "foo",
        "bar",
        "baz",
      ])
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets int array value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setIntArrayValue(
        widget,
        [4, 5, 6],
        { fromUi: true },
        undefined
      )
      expect(widgetMgr.getIntArrayValue(widget)).toEqual([4, 5, 6])
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets float array value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setDoubleArrayValue(
        widget,
        [1.1, 2.2, 3.3],
        {
          fromUi: true,
        },
        undefined
      )
      expect(widgetMgr.getDoubleArrayValue(widget)).toEqual([1.1, 2.2, 3.3])
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets ArrowTable value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setArrowValue(
        widget,
        MOCK_ARROW_TABLE,
        { fromUi: true },
        undefined
      )
      expect(widgetMgr.getArrowValue(widget)).toEqual(MOCK_ARROW_TABLE)
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets JSON value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setJsonValue(
        widget,
        MOCK_JSON,
        {
          fromUi: true,
        },
        undefined
      )
      expect(widgetMgr.getJsonValue(widget)).toBe(JSON.stringify(MOCK_JSON))
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets bytes value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setBytesValue(widget, MOCK_BYTES, { fromUi: true }, undefined)
      expect(widgetMgr.getBytesValue(widget)).toEqual(MOCK_BYTES)
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets FileUploaderState value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setFileUploaderStateValue(
        widget,
        MOCK_FILE_UPLOADER_STATE,
        {
          fromUi: true,
        },
        undefined
      )
      expect(widgetMgr.getFileUploaderStateValue(widget)).toEqual(
        MOCK_FILE_UPLOADER_STATE
      )
      assertCallbacks({ insideForm })
    }
  )

  it("setIntValue can handle MIN_ and MAX_SAFE_INTEGER", () => {
    widgetMgr.setIntValue(
      MOCK_WIDGET,
      Number.MAX_SAFE_INTEGER,
      {
        fromUi: true,
      },
      undefined
    )

    expect(widgetMgr.getIntValue(MOCK_WIDGET)).toBe(Number.MAX_SAFE_INTEGER)

    widgetMgr.setIntValue(
      MOCK_WIDGET,
      Number.MIN_SAFE_INTEGER,
      {
        fromUi: true,
      },
      undefined
    )

    expect(widgetMgr.getIntValue(MOCK_WIDGET)).toBe(Number.MIN_SAFE_INTEGER)
  })

  it("setIntArrayValue can handle MIN_ and MAX_SAFE_INTEGER", () => {
    const values = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]
    widgetMgr.setIntArrayValue(
      MOCK_WIDGET,
      values,
      {
        fromUi: true,
      },
      undefined
    )

    expect(widgetMgr.getIntArrayValue(MOCK_WIDGET)).toStrictEqual(values)
  })

  describe("can set fragmentId in setter methods", () => {
    it.each([
      {
        setterMethod: "setStringTriggerValue",
        value: "Hello world",
      },
      {
        setterMethod: "setBoolValue",
        value: true,
      },
      {
        setterMethod: "setIntValue",
        value: 42,
      },
      {
        setterMethod: "setDoubleValue",
        value: 42.0,
      },
      {
        setterMethod: "setStringValue",
        value: "Hello world",
      },
      {
        setterMethod: "setStringArrayValue",
        value: ["Hello", "world"],
      },
      {
        setterMethod: "setDoubleArrayValue",
        value: [40.0, 2.0],
      },
      {
        setterMethod: "setIntArrayValue",
        value: [40, 2],
      },
      {
        setterMethod: "setJsonValue",
        value: MOCK_JSON,
      },
      {
        setterMethod: "setArrowValue",
        value: MOCK_ARROW_TABLE,
      },
      {
        setterMethod: "setBytesValue",
        value: MOCK_BYTES,
      },
      {
        setterMethod: "setFileUploaderStateValue",
        value: MOCK_FILE_UPLOADER_STATE,
      },
    ])("%p", ({ setterMethod, value }) => {
      // @ts-expect-error
      widgetMgr[setterMethod](
        MOCK_WIDGET,
        value,
        {
          fromUi: true,
        },
        "myFragmentId"
      )
      expect(sendBackMsg).toHaveBeenCalledWith(
        expect.anything(),
        "myFragmentId",
        undefined,
        undefined
      )
    })

    // This test isn't parameterized like the ones above because setTriggerValue
    // has a slightly different signature from the other setter methods.
    it("can set fragmentId in setTriggerValue", () => {
      widgetMgr.setTriggerValue(
        MOCK_WIDGET,
        {
          fromUi: true,
        },
        "myFragmentId"
      )
      expect(sendBackMsg).toHaveBeenCalledWith(
        expect.anything(),
        "myFragmentId",
        undefined,
        undefined
      )
    })
  })

  describe("Primitive types as JSON values", () => {
    it("sets string value as JSON correctly", () => {
      widgetMgr.setJsonValue(
        MOCK_WIDGET,
        "mockStringValue",
        { fromUi: true },
        undefined
      )
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(
        JSON.stringify("mockStringValue")
      )
    })

    it("sets int value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET, 45, { fromUi: true }, undefined)
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(JSON.stringify(45))
    })

    it("sets float value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET, 3.14, { fromUi: true }, undefined)
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(JSON.stringify(3.14))
    })

    it("sets string array value as JSON correctly", () => {
      widgetMgr.setJsonValue(
        MOCK_WIDGET,
        ["foo", "bar", "baz"],
        {
          fromUi: true,
        },
        undefined
      )
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(
        JSON.stringify(["foo", "bar", "baz"])
      )
    })

    it("sets int array value as JSON correctly", () => {
      widgetMgr.setJsonValue(
        MOCK_WIDGET,
        [5, 6, 7],
        { fromUi: true },
        undefined
      )
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(
        JSON.stringify([5, 6, 7])
      )
    })

    it("sets float array value as JSON correctly", () => {
      widgetMgr.setJsonValue(
        MOCK_WIDGET,
        [1.1, 2.2, 3.3],
        { fromUi: true },
        undefined
      )
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(
        JSON.stringify([1.1, 2.2, 3.3])
      )
    })
  })

  // Other FormsData-related tests
  describe("formsData", () => {
    it("updates submitButtons Array", () => {
      const newButtonMock = new ButtonProto()
      const secondButtonMock = new ButtonProto({ id: "newId" })
      expect(formsData.submitButtons.get("form")).not.toBeDefined()
      widgetMgr.addSubmitButton("form", newButtonMock)
      expect(formsData.submitButtons.get("form")?.length).toEqual(1)
      widgetMgr.addSubmitButton("form", secondButtonMock)
      expect(formsData.submitButtons.get("form")?.length).toEqual(2)
      widgetMgr.removeSubmitButton("form", newButtonMock)
      expect(formsData.submitButtons.get("form")?.length).toEqual(1)
      widgetMgr.removeSubmitButton("form", secondButtonMock)
      expect(formsData.submitButtons.get("form")?.length).toEqual(0)
    })

    it("updates formsWithUploads", () => {
      widgetMgr.setFormsWithUploadsInProgress(new Set(["three", "four"]))
      expect(onFormsDataChanged).toHaveBeenCalledTimes(1)
      expect(formsData.formsWithUploads.has("one")).toBe(false)
      expect(formsData.formsWithUploads.has("two")).toBe(false)
      expect(formsData.formsWithUploads.has("three")).toBe(true)
      expect(formsData.formsWithUploads.has("four")).toBe(true)
    })

    it("creates frozen FormsData instances", () => {
      // Our sets are readonly, but that doesn't prevent mutating functions
      // from being called on them. Immer will detect these calls at runtime
      // and throw errors.

      // It's sufficient to check just a single FormsData member for this test;
      // Immer imposes this immutability guarantee on all of an object's
      // sets, maps, and arrays.
      widgetMgr.setFormsWithUploadsInProgress(new Set(["one", "two"]))
      expect(Object.isFrozen(formsData.formsWithUploads)).toBe(true)
    })
  })

  describe("submitForm", () => {
    it("calls sendBackMsg with expected data", () => {
      const formId = "mockFormId"
      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton" })
      )

      // Populate a form
      widgetMgr.setStringValue(
        { id: "widget1", formId },
        "foo",
        {
          fromUi: true,
        },
        undefined
      )
      widgetMgr.setStringValue(
        { id: "widget2", formId },
        "bar",
        {
          fromUi: true,
        },
        undefined
      )

      // We have a single pending form.
      expect(formsData.formsWithPendingChanges).toEqual(new Set([formId]))

      widgetMgr.submitForm(formId, undefined)

      // Our backMsg should be populated with our two widget values,
      // plus the submitButton's value.
      expect(sendBackMsg).toHaveBeenCalledWith(
        {
          widgets: [
            { id: "submitButton", triggerValue: true },
            { id: "widget1", stringValue: "foo" },
            { id: "widget2", stringValue: "bar" },
          ],
        },
        undefined, // fragmentId
        undefined,
        undefined
      )

      // We have no more pending form.
      expect(formsData.formsWithPendingChanges).toEqual(new Set())
    })

    it("calls sendBackMsg with fragmentId", () => {
      const formId = "mockFormId"
      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton" })
      )

      // Populate a form
      widgetMgr.setStringValue(
        { id: "widget1", formId },
        "foo",
        {
          fromUi: true,
        },
        undefined
      )

      widgetMgr.submitForm(formId, "myFragmentId", undefined)

      // Our backMsg should be populated with our two widget values,
      // plus the submitButton's value.
      expect(sendBackMsg).toHaveBeenCalledWith(
        {
          widgets: [
            { id: "submitButton", triggerValue: true },
            { id: "widget1", stringValue: "foo" },
          ],
        },
        "myFragmentId",
        undefined,
        undefined
      )

      // We have no more pending form.
      expect(formsData.formsWithPendingChanges).toEqual(new Set())
    })

    it("throws on invalid formId", () => {
      expect(() =>
        widgetMgr.submitForm(MOCK_WIDGET.formId, undefined)
      ).toThrow(`invalid formID ${MOCK_WIDGET.formId}`)
    })

    it("submits the form for the first submitButton if an actualSubmitButton proto is not passed", () => {
      const formId = "mockFormId"
      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "firstSubmitButton" })
      )
      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "secondSubmitButton" })
      )
      widgetMgr.submitForm(formId, undefined)

      expect(sendBackMsg).toHaveBeenCalledWith(
        {
          widgets: [{ id: "firstSubmitButton", triggerValue: true }],
        },
        undefined,
        undefined,
        undefined
      )
    })

    it("submits the form for the actualSubmitButton when passed", () => {
      const formId = "mockFormId"
      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "firstSubmitButton" })
      )
      const actualSubmitButton = new ButtonProto({
        id: "secondSubmitButton",
        isFormSubmitter: true,
      })
      widgetMgr.addSubmitButton(formId, actualSubmitButton)
      widgetMgr.submitForm(formId, undefined, actualSubmitButton)

      expect(sendBackMsg).toHaveBeenCalledWith(
        {
          widgets: [{ id: "secondSubmitButton", triggerValue: true }],
        },
        undefined,
        undefined,
        undefined
      )
    })
  })

  describe("allowFormEnterToSubmit", () => {
    it("returns true for a valid formId with 1st submit button enabled", () => {
      // Create form with a submit button
      const formId = "mockFormId"

      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton" })
      )
      widgetMgr.setStringValue(
        { id: "widget1", formId },
        "foo",
        {
          fromUi: true,
        },
        undefined
      )

      // Form should exist & allow submission on Enter
      // @ts-expect-error - checking that form exists via internal state
      expect(widgetMgr.forms.get(formId)).toBeTruthy()
      expect(widgetMgr.allowFormEnterToSubmit(formId)).toBe(true)
    })

    it("returns false for an invalid formId", () => {
      // Create form with a submit button
      const formId = "mockFormId"

      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton" })
      )
      widgetMgr.setStringValue(
        { id: "widget1", formId },
        "foo",
        {
          fromUi: true,
        },
        undefined
      )

      // @ts-expect-error - Created form should exist
      expect(widgetMgr.forms.get(formId)).toBeTruthy()

      // @ts-expect-error - Other form should NOT exist & should not allow submit on Enter
      expect(widgetMgr.forms.get("INVALID_FORM_ID")).toBeFalsy()
      expect(widgetMgr.allowFormEnterToSubmit("INVALID_FORM_ID")).toBe(false)
    })

    it("returns false for a valid formId with no submit buttons", () => {
      // Create form with a submit button
      const formId = "mockFormId"

      widgetMgr.setStringValue(
        { id: "widget1", formId },
        "foo",
        {
          fromUi: true,
        },
        undefined
      )

      // @ts-expect-error - Created form should exist, but no allow submit on Enter
      expect(widgetMgr.forms.get(formId)).toBeTruthy()
      expect(widgetMgr.allowFormEnterToSubmit(formId)).toBe(false)
    })

    it("returns false if the 1st submit button disabled", () => {
      // Create form with a submit button
      const formId = "mockFormId"

      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton", disabled: true })
      )
      widgetMgr.setStringValue(
        { id: "widget1", formId },
        "foo",
        {
          fromUi: true,
        },
        undefined
      )

      // @ts-expect-error - Created form should exist, but no allow submit on Enter
      expect(widgetMgr.forms.get(formId)).toBeTruthy()
      expect(widgetMgr.allowFormEnterToSubmit(formId)).toBe(false)
    })

    it("returns true if the 1st submit button enabled, others disabled", () => {
      // Create form with a submit button
      const formId = "mockFormId"

      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton" })
      )
      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton2", disabled: true })
      )
      widgetMgr.setStringValue(
        { id: "widget1", formId },
        "foo",
        {
          fromUi: true,
        },
        undefined
      )

      // @ts-expect-error - Created form should exist and allow submit on Enter
      expect(widgetMgr.forms.get(formId)).toBeTruthy()
      expect(widgetMgr.allowFormEnterToSubmit(formId)).toBe(true)
    })

    it("returns false if form created with enter_to_submit=False", () => {
      // Create form with a submit button
      const formId = "mockFormId"

      // Create form with enter_to_submit=False
      widgetMgr.setFormSubmitBehaviors(formId, false, false)

      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton" })
      )
      widgetMgr.setStringValue(
        { id: "widget1", formId },
        "foo",
        {
          fromUi: true,
        },
        undefined
      )

      // @ts-expect-error - Created form should exist, but no allow submit on Enter
      expect(widgetMgr.forms.get(formId)).toBeTruthy()
      expect(widgetMgr.allowFormEnterToSubmit(formId)).toBe(false)
    })
  })

  describe("Forms don't interfere with each other", () => {
    const FORM_1 = {
      id: "NOT_A_REAL_WIDGET_ID_1",
      formId: "NOT_A_REAL_FORM_ID_1",
    }
    const FORM_2 = {
      id: "NOT_A_REAL_WIDGET_ID_2",
      formId: "NOT_A_REAL_FORM_ID_2",
    }

    beforeEach(() => {
      // Set widget value for the first form.
      widgetMgr.setStringValue(
        FORM_1,
        "foo",
        {
          fromUi: true,
        },
        undefined
      )

      // Set widget value for the second form.
      widgetMgr.setStringValue(
        FORM_2,
        "bar",
        {
          fromUi: true,
        },
        undefined
      )
    })

    it("checks that there are two pending forms", () => {
      expect(formsData.formsWithPendingChanges).toEqual(
        new Set([FORM_1.formId, FORM_2.formId])
      )
    })

    it("calls sendBackMsg with the first form data", () => {
      widgetMgr.addSubmitButton(
        FORM_1.formId,
        new ButtonProto({ id: "submitButton" })
      )

      // Submit the first form.
      widgetMgr.submitForm(FORM_1.formId, undefined)

      // Our backMsg should be populated with the first form widget value,
      // plus the first submitButton's triggerValue.
      expect(sendBackMsg).toHaveBeenCalledWith(
        {
          widgets: [
            { id: "submitButton", triggerValue: true },
            { id: FORM_1.id, stringValue: "foo" },
          ],
        },
        undefined,
        undefined,
        undefined
      )
    })

    it("checks that only the second form is pending after the first is submitted", () => {
      widgetMgr.submitForm(FORM_1.formId, undefined)
      expect(formsData.formsWithPendingChanges).toEqual(
        new Set([FORM_2.formId])
      )
    })

    it("calls sendBackMsg with data from both forms", () => {
      // Submit the first form and then the second form.
      widgetMgr.submitForm(FORM_1.formId, undefined)
      widgetMgr.submitForm(
        FORM_2.formId,
        undefined,
        new ButtonProto({ id: "submitButton2" })
      )

      // Our most recent backMsg should be populated with the both forms' widget values,
      // plus the second submitButton's fromSubmitValue.
      expect(sendBackMsg).toHaveBeenLastCalledWith(
        {
          widgets: [
            { id: FORM_1.id, stringValue: "foo" },
            { id: "submitButton2", triggerValue: true },
            { id: FORM_2.id, stringValue: "bar" },
          ],
        },
        undefined,
        undefined,
        undefined
      )
    })

    it("checks that no more pending forms exist after both are submitted", () => {
      widgetMgr.submitForm(FORM_1.formId, undefined)
      widgetMgr.submitForm(FORM_2.formId, undefined)
      expect(formsData.formsWithPendingChanges).toEqual(new Set())
    })

    it("supports two submit buttons and can submitForm on the second one", () => {
      widgetMgr.addSubmitButton(
        FORM_1.formId,
        new ButtonProto({ id: "submitButton" })
      )
      widgetMgr.addSubmitButton(
        FORM_2.formId,
        new ButtonProto({ id: "submitButton2" })
      )

      // Submit the second form.
      widgetMgr.submitForm(
        FORM_2.formId,
        undefined,
        new ButtonProto({ id: "submitButton2" })
      )

      expect(sendBackMsg).toHaveBeenCalledWith(
        {
          widgets: [
            { id: "submitButton2", triggerValue: true },
            { id: FORM_2.id, stringValue: "bar" },
          ],
        },
        undefined,
        undefined,
        undefined
      )
    })
  })

  describe("manages element state values", () => {
    it("sets extra widget information properly", () => {
      widgetMgr.setElementState("id", "color", "red")
      // @ts-expect-error
      expect(widgetMgr.elementStates.get("id")?.get("color")).toEqual("red")
    })

    it("returns extra widget information when id exists and key exists", () => {
      // @ts-expect-error
      widgetMgr.elementStates.set("id", new Map([["color", "red"]]))
      expect(widgetMgr.getElementState("id", "color")).toEqual("red")
    })

    it("returns undefined when when id does not exist", () => {
      expect(widgetMgr.getElementState("id", "color")).toEqual(undefined)
    })

    it("returns undefined when when id exists and key does not exist", () => {
      // @ts-expect-error
      widgetMgr.elementStates.set("id", new Map([["text", "red"]]))
      expect(widgetMgr.getElementState("id", "color")).toEqual(undefined)
    })

    it("deletes a value for the key if set", () => {
      // @ts-expect-error
      widgetMgr.elementStates.set("id", new Map([["text", "red"]]))
      widgetMgr.deleteElementState("id", "color")
      expect(widgetMgr.getElementState("id", "color")).toEqual(undefined)
    })

    it("does not error when deleting for the key if not set", () => {
      widgetMgr.deleteElementState("id", "color")
      expect(widgetMgr.getElementState("id", "color")).toEqual(undefined)
    })
  })

  it("cleans up widget & element states on removeInactive", () => {
    const widgetId1 = "TEST_ID_1"
    const widgetId2 = "TEST_ID_2"
    const widgetId3 = "TEST_ID_3"
    const widgetId4 = "TEST_ID_4"
    const elementId1 = "TEST_ID_5"
    const elementId2 = "TEST_ID_6"
    widgetMgr.setStringValue(
      { id: widgetId1 },
      "widgetState1",
      {
        fromUi: false,
      },
      undefined
    )
    widgetMgr.setStringValue(
      { id: widgetId2 },
      "widgetState2",
      {
        fromUi: false,
      },
      undefined
    )
    widgetMgr.setStringValue(
      { id: widgetId3 },
      "widgetState3",
      {
        fromUi: false,
      },
      undefined
    )
    widgetMgr.setStringValue(
      { id: widgetId4 },
      "widgetState4",
      {
        fromUi: false,
      },
      undefined
    )

    widgetMgr.setElementState(elementId1, "key1", "elementState1")
    widgetMgr.setElementState(elementId2, "key2", "elementState2")

    const activeIds = new Set([widgetId3, widgetId4, elementId2])
    widgetMgr.removeInactive(activeIds)

    expect(widgetMgr.getStringValue({ id: widgetId1 })).toBeUndefined()
    expect(widgetMgr.getStringValue({ id: widgetId2 })).toBeUndefined()
    expect(widgetMgr.getStringValue({ id: widgetId3 })).toEqual("widgetState3")
    expect(widgetMgr.getStringValue({ id: widgetId4 })).toEqual("widgetState4")
    expect(widgetMgr.getElementState(elementId1, "key1")).toBeUndefined()
    expect(widgetMgr.getElementState(elementId2, "key2")).toEqual(
      "elementState2"
    )
  })
})

describe("WidgetStateDict", () => {
  let widgetStateDict: WidgetStateDict
  const widgetId = "TEST_ID"

  beforeEach(() => {
    widgetStateDict = new WidgetStateDict()
  })

  it("creates a new state with the given widget id", () => {
    widgetStateDict.createState(widgetId)

    expect(widgetStateDict.getState(widgetId)).toEqual({ id: widgetId })
  })

  it("deletes a state with the given widget id", () => {
    widgetStateDict.createState(widgetId)
    widgetStateDict.deleteState(widgetId)

    expect(widgetStateDict.getState(widgetId)).toBeUndefined()
  })

  it("checks that widget state dict is empty after creation", () => {
    expect(widgetStateDict.isEmpty).toBeTruthy()
  })

  it("checks that widget state dict is not empty if there is at least one element in it", () => {
    widgetStateDict.createState(widgetId)

    expect(widgetStateDict.isEmpty).toBeFalsy()
  })

  it("checks that widget state dict is empty if all elements have been deleted", () => {
    widgetStateDict.createState(widgetId)
    widgetStateDict.deleteState(widgetId)

    expect(widgetStateDict.isEmpty).toBeTruthy()
  })

  it("cleans states of widgets that are not contained in `activeIds`", () => {
    const widgetId1 = "TEST_ID_1"
    const widgetId2 = "TEST_ID_2"
    const widgetId3 = "TEST_ID_3"
    const widgetId4 = "TEST_ID_4"
    widgetStateDict.createState(widgetId1)
    widgetStateDict.createState(widgetId2)
    widgetStateDict.createState(widgetId3)
    widgetStateDict.createState(widgetId4)

    const activeIds = new Set([widgetId3, widgetId4])
    widgetStateDict.removeInactive(activeIds)

    expect(widgetStateDict.getState(widgetId1)).toBeUndefined()
    expect(widgetStateDict.getState(widgetId2)).toBeUndefined()
    expect(widgetStateDict.getState(widgetId3)).toEqual({ id: widgetId3 })
    expect(widgetStateDict.getState(widgetId4)).toEqual({ id: widgetId4 })
  })

  it("creates widget state message", () => {
    widgetStateDict.createState(widgetId)
    const msg = widgetStateDict.createWidgetStatesMsg()

    expect(msg.widgets).toEqual([{ id: widgetId }])
  })

  it("copies the contents of another WidgetStateDict into the given one, overwriting any values with duplicate keys", () => {
    const widgetId1 = "TEST_ID_1"
    const widgetId2 = "TEST_ID_2"
    const widgetId3 = "TEST_ID_3"

    widgetStateDict.createState(widgetId1)
    widgetStateDict.createState(widgetId2)

    // NOTE: `widgetId2` is used in both dicts.
    const newWidgetDict = new WidgetStateDict()
    newWidgetDict.createState(widgetId2)
    newWidgetDict.createState(widgetId3)

    widgetStateDict.copyFrom(newWidgetDict)

    expect(widgetStateDict.getState(widgetId1)).toEqual({ id: widgetId1 })
    expect(widgetStateDict.getState(widgetId2)).toEqual({ id: widgetId2 })
    expect(widgetStateDict.getState(widgetId3)).toEqual({ id: widgetId3 })
  })

  it("supplies WidgetStates with for active widgets based on input", () => {
    const widgetStateManager = new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
    })

    widgetStateManager.setStringValue(
      { id: "widget1" },
      "foo",
      {
        fromUi: false,
      },
      undefined
    )
    widgetStateManager.setStringValue(
      { id: "widget2" },
      "bar",
      {
        fromUi: false,
      },
      undefined
    )

    const activeIds = new Set(["widget2"])
    const widgetStates = widgetStateManager.getActiveWidgetStates(activeIds)

    expect(widgetStates).toEqual({
      widgets: [
        {
          id: "widget2",
          stringValue: "bar",
        },
      ],
    })
  })
})
