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

import { waitFor } from "@testing-library/dom"
import { enableMapSet, enablePatches } from "immer"
import { getLogger } from "loglevel"
import { Mock } from "vitest"

import {
  ArrowTable as ArrowTableProto,
  Button as ButtonProto,
  FileUploaderState as FileUploaderStateProto,
  UploadedFileInfo as UploadedFileInfoProto,
} from "@streamlit/protobuf"

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

const MOCK_CHAT_INPUT_VALUE = {
  data: "mockChatInputValue",
  fileUploaderState: null,
}

const MOCK_FORM_WIDGET = {
  id: "mockFormWidgetId",
  formId: "mockFormId",
}

const MOCK_FILE_UPLOADER_STATE = new FileUploaderStateProto({
  uploadedFileInfo: [
    new UploadedFileInfoProto({
      fileId: "file-1",
      name: "bob",
      size: 5,
    }),

    new UploadedFileInfoProto({
      fileId: "file-2",
      name: "linus",
      size: 9001,
    }),
  ],
})

// Required by ImmerJS
enablePatches()
enableMapSet()

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
  const assertCallbacks = async ({
    insideForm,
  }: {
    insideForm: boolean
  }): Promise<void> => {
    if (insideForm) {
      expect(sendBackMsg).not.toHaveBeenCalled()
    } else {
      await waitFor(() => {
        expect(sendBackMsg).toHaveBeenCalledTimes(1)
        expect(sendBackMsg).toHaveBeenCalledWith(
          expect.anything(),
          undefined, // fragmentId
          undefined,
          undefined
        )
      })
    }
  }

  it.each([false, true])(
    "sets string value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setStringValue(
        widget,
        "mockStringValue",
        { fromUi: true },
        undefined
      )
      expect(widgetMgr.getStringValue(widget)).toBe("mockStringValue")
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets boolean value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setBoolValue(widget, true, { fromUi: true }, undefined)
      expect(widgetMgr.getBoolValue(widget)).toBe(true)
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets int value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setIntValue(widget, 100, { fromUi: true }, undefined)
      expect(widgetMgr.getIntValue(widget)).toBe(100)
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets double value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setDoubleValue(widget, 3.14, { fromUi: true }, undefined)
      expect(widgetMgr.getDoubleValue(widget)).toBe(3.14)
      await assertCallbacks({ insideForm })
    }
  )

  /**
   * Buttons (which set trigger values) can't be used within forms, so this test
   * is not parameterized on insideForm.
   */
  it("sets trigger value correctly", async () => {
    const widget = getWidget({ insideForm: false })
    await widgetMgr.setTriggerValue(widget, { fromUi: true }, undefined)

    // @ts-expect-error
    expect(widgetMgr.getWidgetState(widget)).toBe(undefined)
    await assertCallbacks({ insideForm: false })
  })

  it.each([false, true])(
    "sets string array value correctly (insideForm=%s)",
    async insideForm => {
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
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets int array value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setIntArrayValue(
        widget,
        [4, 5, 6],
        { fromUi: true },
        undefined
      )
      expect(widgetMgr.getIntArrayValue(widget)).toEqual([4, 5, 6])
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets double array value correctly (insideForm=%s)",
    async insideForm => {
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
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets ArrowTable value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setArrowValue(
        widget,
        MOCK_ARROW_TABLE,
        { fromUi: true },
        undefined
      )
      expect(widgetMgr.getArrowValue(widget)).toEqual(MOCK_ARROW_TABLE)
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets JSON value correctly (insideForm=%s)",
    async insideForm => {
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
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets bytes value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setBytesValue(widget, MOCK_BYTES, { fromUi: true }, undefined)
      expect(widgetMgr.getBytesValue(widget)).toEqual(MOCK_BYTES)
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets FileUploaderState value correctly (insideForm=%s)",
    async insideForm => {
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
      await assertCallbacks({ insideForm })
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
        setterMethod: "setChatInputValue",
        value: MOCK_CHAT_INPUT_VALUE,
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
    ])("%s", async ({ setterMethod, value }) => {
      // @ts-expect-error
      await widgetMgr[setterMethod](
        MOCK_WIDGET,
        value,
        {
          fromUi: true,
        },
        "myFragmentId"
      )
      await waitFor(() => {
        expect(sendBackMsg).toHaveBeenCalledWith(
          expect.anything(),
          "myFragmentId",
          undefined,
          undefined
        )
      })
    })

    // This test isn't parameterized like the ones above because setTriggerValue
    // has a slightly different signature from the other setter methods.
    it("can set fragmentId in setTriggerValue", async () => {
      await widgetMgr.setTriggerValue(
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

    it("sets double value as JSON correctly", () => {
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

    it("sets double array value as JSON correctly", () => {
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

// New tests for isolated batched JSON APIs
describe("Trigger JSON payloads (aggregated)", () => {
  let sendBackMsg: Mock
  let widgetMgr: WidgetStateManager

  beforeEach(() => {
    sendBackMsg = vi.fn()
    widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: sendBackMsg,
      formsDataChanged: vi.fn(),
    })
  })

  it("setTriggerValue(payload): uses jsonTriggerValue field", async () => {
    const widget = { id: "batchedTriggerWidget", formId: "" }

    await widgetMgr.setTriggerValue(widget, { fromUi: true }, "fragT", {
      t: 1,
    })

    expect(sendBackMsg).toHaveBeenCalledTimes(1)
    expect(sendBackMsg).toHaveBeenCalledWith(
      {
        widgets: [
          {
            id: "batchedTriggerWidget",
            jsonTriggerValue: JSON.stringify([{ t: 1 }]),
          },
        ],
      },
      "fragT",
      undefined,
      undefined
    )
  })

  it("setJsonValue and setTriggerValue(payload): coalesce to one back message", async () => {
    const widget = { id: "jsonAndTriggerCoalesce", formId: "" }
    const jsonValue = { foo: "bar" }
    const triggerPayload = { baz: 42 }

    widgetMgr.setJsonValue(widget, jsonValue, { fromUi: true }, "fragJT")

    const triggerPromise = widgetMgr.setTriggerValue(
      widget,
      { fromUi: true },
      "fragJT",
      triggerPayload
    )

    await triggerPromise

    expect(sendBackMsg).toHaveBeenCalledTimes(1)
    expect(sendBackMsg).toHaveBeenCalledWith(
      {
        widgets: [
          {
            id: "jsonAndTriggerCoalesce",
            jsonValue: JSON.stringify(jsonValue),
            jsonTriggerValue: JSON.stringify([triggerPayload]),
          },
        ],
      },
      "fragJT",
      undefined,
      undefined
    )
  })

  it("setTriggerValue(payload): aggregates multiple payloads into a JSON array in one macrotask", async () => {
    const widget = { id: "batchedTriggerAgg", formId: "" }

    const p1 = widgetMgr.setTriggerValue(widget, { fromUi: true }, "fragAgg", {
      a: 1,
    })
    const p2 = widgetMgr.setTriggerValue(widget, { fromUi: true }, "fragAgg", {
      b: 2,
    })

    await Promise.all([p1, p2])

    expect(sendBackMsg).toHaveBeenCalledTimes(1)
    expect(sendBackMsg).toHaveBeenCalledWith(
      {
        widgets: [
          {
            id: "batchedTriggerAgg",
            jsonTriggerValue: JSON.stringify([{ a: 1 }, { b: 2 }]),
          },
        ],
      },
      "fragAgg",
      undefined,
      undefined
    )
  })

  it("setTriggerValue(payload): aggregates three payloads and sends once", async () => {
    const widget = { id: "batchedTriple", formId: "" }

    const p1 = widgetMgr.setTriggerValue(widget, { fromUi: true }, "frag3", {
      x: 1,
    })
    const p2 = widgetMgr.setTriggerValue(widget, { fromUi: true }, "frag3", {
      y: 2,
    })
    const p3 = widgetMgr.setTriggerValue(widget, { fromUi: true }, "frag3", {
      z: 3,
    })

    await Promise.all([p1, p2, p3])

    expect(sendBackMsg).toHaveBeenCalledTimes(1)
    expect(sendBackMsg).toHaveBeenCalledWith(
      {
        widgets: [
          {
            id: "batchedTriple",
            jsonTriggerValue: JSON.stringify([{ x: 1 }, { y: 2 }, { z: 3 }]),
          },
        ],
      },
      "frag3",
      undefined,
      undefined
    )
  })

  it("setTriggerValue(payload): batches even when fragments differ, using the first fragment id", async () => {
    // Note that this flow shouldn't actually happen in practice. We shouldn't
    // be updating multiple fragments in the same macrotask. This test is
    // written now to test the behavior of the code, but it can change in the
    // future if we decide to change the behavior.
    const widget = { id: "batchedFragment", formId: "" }

    const p1 = widgetMgr.setTriggerValue(widget, { fromUi: true }, "f1", {
      a: 1,
    })
    const p2 = widgetMgr.setTriggerValue(widget, { fromUi: true }, "f2", {
      b: 2,
    })

    await Promise.all([p1, p2])

    expect(sendBackMsg).toHaveBeenCalledTimes(1)
    expect(sendBackMsg).toHaveBeenCalledWith(
      {
        widgets: [
          {
            id: "batchedFragment",
            jsonTriggerValue: JSON.stringify([{ a: 1 }, { b: 2 }]),
          },
        ],
      },
      "f1",
      undefined,
      undefined
    )
  })

  it("logs a warning and uses the first fragmentId when batch contains mixed fragmentIds", async () => {
    const logger = getLogger("WidgetStateManager")
    const warnSpy = vi.spyOn(logger, "warn")

    const widget = { id: "warnMixedFragments", formId: "" }

    const p1 = widgetMgr.setTriggerValue(widget, { fromUi: true }, "fragA", {
      a: true,
    })
    const p2 = widgetMgr.setTriggerValue(widget, { fromUi: true }, "fragB", {
      b: true,
    })

    await Promise.all([p1, p2])

    // Uses the first fragment id
    expect(sendBackMsg).toHaveBeenCalledTimes(1)
    expect(sendBackMsg).toHaveBeenCalledWith(
      expect.anything(),
      "fragA",
      undefined,
      undefined
    )

    // Logs exactly one warning for the batch
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const [msg, usedFragment] = warnSpy.mock.calls[0]
    expect(String(msg)).toContain("Multiple different fragmentIds")
    expect(usedFragment).toBe("fragA")

    warnSpy.mockRestore()
  })

  it("setTriggerValue(payload): retains existing fragment id if subsequent calls omit it", async () => {
    const widget = { id: "batchedFragmentFallback", formId: "" }

    const p1 = widgetMgr.setTriggerValue(widget, { fromUi: true }, "fKeep", {
      first: true,
    })
    const p2 = widgetMgr.setTriggerValue(widget, { fromUi: true }, undefined, {
      second: true,
    })

    await Promise.all([p1, p2])

    expect(sendBackMsg).toHaveBeenCalledTimes(1)
    expect(sendBackMsg).toHaveBeenCalledWith(
      {
        widgets: [
          {
            id: "batchedFragmentFallback",
            jsonTriggerValue: JSON.stringify([
              { first: true },
              { second: true },
            ]),
          },
        ],
      },
      "fKeep",
      undefined,
      undefined
    )
  })

  it("setTriggerValue(payload): merges with existing scalar jsonTriggerValue", async () => {
    const widget = { id: "batchedScalarPrev", formId: "" }

    // Pre-seed an existing scalar jsonTriggerValue
    ;(
      widgetMgr as unknown as {
        widgetStates: {
          createState: (id: string) => { jsonTriggerValue?: string }
        }
      }
    ).widgetStates.createState(widget.id).jsonTriggerValue = JSON.stringify({
      prev: 1,
    })

    await widgetMgr.setTriggerValue(widget, { fromUi: true }, "fragS", {
      next: 2,
    })

    expect(sendBackMsg).toHaveBeenCalledTimes(1)
    expect(sendBackMsg).toHaveBeenCalledWith(
      {
        widgets: [
          {
            id: "batchedScalarPrev",
            jsonTriggerValue: JSON.stringify([{ prev: 1 }, { next: 2 }]),
          },
        ],
      },
      "fragS",
      undefined,
      undefined
    )
  })

  it("setTriggerValue(payload): parse failure falls back to [prevString, payload]", async () => {
    const widget = { id: "batchedParseFail", formId: "" }

    // Pre-seed an invalid JSON string as previous value
    ;(
      widgetMgr as unknown as {
        widgetStates: {
          createState: (id: string) => { jsonTriggerValue?: string }
        }
      }
    ).widgetStates.createState(widget.id).jsonTriggerValue = "NOT JSON"

    await widgetMgr.setTriggerValue(widget, { fromUi: true }, "fragPF", {
      ok: true,
    })

    expect(sendBackMsg).toHaveBeenCalledTimes(1)
    expect(sendBackMsg).toHaveBeenCalledWith(
      {
        widgets: [
          {
            id: "batchedParseFail",
            jsonTriggerValue: JSON.stringify(["NOT JSON", { ok: true }]),
          },
        ],
      },
      "fragPF",
      undefined,
      undefined
    )
  })

  describe("Query Param Binding", () => {
    let mockOnQueryParamsChange: Mock
    let originalLocation: Location
    let originalReplaceState: typeof window.history.replaceState

    beforeEach(() => {
      // Store originals for cleanup
      originalLocation = window.location
      originalReplaceState = window.history.replaceState

      mockOnQueryParamsChange = vi.fn()
      widgetMgr.setQueryParamsChangeHandler(mockOnQueryParamsChange)
      // Mock window.history.replaceState to capture URL changes
      let currentUrl = "http://localhost:3000/"
      window.history.replaceState = vi.fn((_, __, url) => {
        if (url) currentUrl = url as string
      })
      // Mock window.location with proper URL structure
      Object.defineProperty(window, "location", {
        get() {
          return new URL(currentUrl)
        },
        configurable: true,
      })
    })

    afterEach(() => {
      // Restore original window.location and history.replaceState
      Object.defineProperty(window, "location", {
        value: originalLocation,
        configurable: true,
        writable: true,
      })
      window.history.replaceState = originalReplaceState
    })

    describe("registerQueryParamBinding", () => {
      it("registers a binding", () => {
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "my_key",
          "string_value",
          "default",
          false
        )

        expect(widgetMgr.hasQueryParamBinding("widget1")).toBe(true)
      })

      it("registers binding with urlDefault for select_slider", () => {
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "color",
          "string_array_value",
          ["Red"],
          false,
          "repeated"
        )

        expect(widgetMgr.hasQueryParamBinding("widget1")).toBe(true)
      })

      it("registers binding with urlFormat", () => {
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "tags",
          "string_array_value",
          [],
          true,
          "comma"
        )

        expect(widgetMgr.hasQueryParamBinding("widget1")).toBe(true)
      })

      it("cleans up old binding when different widget binds to same paramKey", () => {
        // First widget binds to "my_key"
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "my_key",
          "string_value",
          "default1",
          false
        )
        expect(widgetMgr.hasQueryParamBinding("widget1")).toBe(true)

        // Second widget binds to the same "my_key" - should clean up widget1
        widgetMgr.registerQueryParamBinding(
          "widget2",
          "my_key",
          "string_value",
          "default2",
          false
        )

        // widget2 should be bound, widget1 should be cleaned up
        expect(widgetMgr.hasQueryParamBinding("widget2")).toBe(true)
        expect(widgetMgr.hasQueryParamBinding("widget1")).toBe(false)
      })

      it("allows same widget to re-register with same paramKey", () => {
        // Widget registers
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "my_key",
          "string_value",
          "default1",
          false
        )

        // Same widget re-registers (e.g., on re-render) - should not break
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "my_key",
          "string_value",
          "default2",
          false
        )

        expect(widgetMgr.hasQueryParamBinding("widget1")).toBe(true)
      })
    })

    describe("unregisterQueryParamBinding", () => {
      it("unregisters a binding", () => {
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "my_key",
          "string_value",
          "default",
          false
        )
        widgetMgr.unregisterQueryParamBinding("widget1")

        expect(widgetMgr.hasQueryParamBinding("widget1")).toBe(false)
      })

      it("is a no-op for non-existent widget", () => {
        expect(() => {
          widgetMgr.unregisterQueryParamBinding("nonexistent")
        }).not.toThrow()
      })
    })

    describe("URL sync for scalar values", () => {
      it.each([
        {
          type: "bool",
          paramKey: "enabled",
          valueType: "bool_value" as const,
          defaultVal: false,
          testVal: true,
          expected: "enabled=true",
        },
        {
          type: "int",
          paramKey: "count",
          valueType: "int_value" as const,
          defaultVal: 0,
          testVal: 42,
          expected: "count=42",
        },
        {
          type: "double",
          paramKey: "value",
          valueType: "double_value" as const,
          defaultVal: 0,
          testVal: 3.14,
          expected: "value=3.14",
        },
        {
          type: "string",
          paramKey: "name",
          valueType: "string_value" as const,
          defaultVal: "",
          testVal: "Alice",
          expected: "name=Alice",
        },
      ])(
        "syncs $type value to URL",
        ({ paramKey, valueType, defaultVal, testVal, expected }) => {
          const widget = { id: "widget1", formId: "" }
          widgetMgr.registerQueryParamBinding(
            "widget1",
            paramKey,
            valueType,
            defaultVal,
            false
          )

          // Call the appropriate setter based on value type
          if (valueType === "bool_value") {
            widgetMgr.setBoolValue(
              widget,
              testVal,
              { fromUi: true },
              undefined
            )
          } else if (valueType === "int_value") {
            widgetMgr.setIntValue(widget, testVal, { fromUi: true }, undefined)
          } else if (valueType === "double_value") {
            widgetMgr.setDoubleValue(
              widget,
              testVal,
              { fromUi: true },
              undefined
            )
          } else {
            widgetMgr.setStringValue(
              widget,
              testVal,
              { fromUi: true },
              undefined
            )
          }

          expect(window.history.replaceState).toHaveBeenCalled()
          expect(mockOnQueryParamsChange).toHaveBeenCalledWith(expected)
        }
      )

      it("does not sync when value is from backend (fromUi: false)", () => {
        const widget = { id: "checkbox1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "checkbox1",
          "enabled",
          "bool_value",
          false,
          false
        )

        widgetMgr.setBoolValue(widget, true, { fromUi: false }, undefined)

        expect(window.history.replaceState).not.toHaveBeenCalled()
        expect(mockOnQueryParamsChange).not.toHaveBeenCalled()
      })

      it("does not sync unbound widget", () => {
        const widget = { id: "unbound_widget", formId: "" }
        // Don't register any binding for this widget

        widgetMgr.setStringValue(widget, "test", { fromUi: true }, undefined)

        expect(window.history.replaceState).not.toHaveBeenCalled()
        expect(mockOnQueryParamsChange).not.toHaveBeenCalled()
      })

      it("clears URL param when value equals default", () => {
        const widget = { id: "checkbox1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "checkbox1",
          "enabled",
          "bool_value",
          false,
          false
        )

        // Set to non-default
        widgetMgr.setBoolValue(widget, true, { fromUi: true }, undefined)
        vi.clearAllMocks()

        // Set back to default
        widgetMgr.setBoolValue(widget, false, { fromUi: true }, undefined)

        expect(window.history.replaceState).toHaveBeenCalled()
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("")
      })

      it("clears URL param when nullable value is set to null", () => {
        const widget = { id: "number1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "number1",
          "count",
          "int_value",
          0,
          false
        )

        // Set a value first
        widgetMgr.setIntValue(widget, 5, { fromUi: true }, undefined)
        vi.clearAllMocks()

        // Set to null (widget cleared)
        widgetMgr.setIntValue(widget, null, { fromUi: true }, undefined)

        expect(window.history.replaceState).toHaveBeenCalled()
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("")
      })
    })

    describe("URL sync for array values", () => {
      it("syncs string array with repeated params", () => {
        const widget = { id: "multiselect1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "multiselect1",
          "tags",
          "string_array_value",
          [],
          true
        )

        widgetMgr.setStringArrayValue(
          widget,
          ["foo", "bar"],
          { fromUi: true },
          undefined
        )

        expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
          "tags=foo&tags=bar"
        )
      })

      it("syncs string array with comma format", () => {
        const widget = { id: "multiselect1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "multiselect1",
          "tags",
          "string_array_value",
          [],
          true,
          "comma"
        )

        widgetMgr.setStringArrayValue(
          widget,
          ["foo", "bar"],
          { fromUi: true },
          undefined
        )

        // Comma is URL-encoded by URLSearchParams.toString()
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("tags=foo%2Cbar")
      })

      it("syncs double array with repeated params", () => {
        const widget = { id: "slider1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "slider1",
          "range",
          "double_array_value",
          [0, 100],
          false
        )

        widgetMgr.setDoubleArrayValue(
          widget,
          [10, 90],
          { fromUi: true },
          undefined
        )

        expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
          "range=10&range=90"
        )
      })

      it("filters out invalid double array values", () => {
        const widget = { id: "slider1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "slider1",
          "range",
          "double_array_value",
          [0, 100],
          false
        )

        widgetMgr.setDoubleArrayValue(
          widget,
          [10, NaN, 90],
          { fromUi: true },
          undefined
        )

        expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
          "range=10&range=90"
        )
      })

      it("clears URL param when all double array values are invalid (fromUi: true)", () => {
        const widget = { id: "slider1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "slider1",
          "range",
          "double_array_value",
          [0, 100],
          false
        )

        // First set a valid value to put something in the URL
        widgetMgr.setDoubleArrayValue(
          widget,
          [10, 90],
          { fromUi: true },
          undefined
        )
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
          "range=10&range=90"
        )

        // Now set all invalid values - should clear the URL
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setDoubleArrayValue(
          widget,
          [NaN, NaN],
          { fromUi: true },
          undefined
        )

        // URL should be cleared (empty string means param removed)
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("")
        // State should NOT be updated when all values are invalid (previous value remains)
        expect(widgetMgr.getDoubleArrayValue(widget)).toEqual([10, 90])
      })

      it("does not update URL when all double array values are invalid (fromUi: false)", () => {
        const widget = { id: "slider1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "slider1",
          "range",
          "double_array_value",
          [0, 100],
          false
        )

        widgetMgr.setDoubleArrayValue(
          widget,
          [NaN, NaN],
          { fromUi: false },
          undefined
        )

        // URL should NOT be modified for backend changes
        expect(window.history.replaceState).not.toHaveBeenCalled()
        expect(mockOnQueryParamsChange).not.toHaveBeenCalled()
        // State should NOT be updated when all values are invalid
        expect(widgetMgr.getDoubleArrayValue(widget)).toBeUndefined()
      })

      it("updates state but not URL for valid double array values (fromUi: false)", () => {
        const widget = { id: "slider1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "slider1",
          "range",
          "double_array_value",
          [0, 100],
          false
        )

        widgetMgr.setDoubleArrayValue(
          widget,
          [25, 75],
          { fromUi: false },
          undefined
        )

        // URL should NOT be modified for backend changes
        expect(window.history.replaceState).not.toHaveBeenCalled()
        expect(mockOnQueryParamsChange).not.toHaveBeenCalled()
        // State SHOULD be updated
        expect(widgetMgr.getDoubleArrayValue(widget)).toEqual([25, 75])
      })

      it("clears URL when empty array equals default (hide at default)", () => {
        const widget = { id: "multiselect1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "multiselect1",
          "tags",
          "string_array_value",
          [], // default is empty array
          true // clearable
        )

        // First set a value to put something in the URL
        widgetMgr.setStringArrayValue(
          widget,
          ["tag1", "tag2"],
          { fromUi: true },
          undefined
        )
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
          "tags=tag1&tags=tag2"
        )

        // Now clear the array - empty matches default, so clear param
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setStringArrayValue(widget, [], { fromUi: true }, undefined)

        // Empty matches default [], so param is cleared (not ?tags=)
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("")
      })

      it("preserves empty array in URL when empty differs from default", () => {
        const widget = { id: "multiselect2", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "multiselect2",
          "langs",
          "string_array_value",
          ["Python"], // default is non-empty
          true // clearable
        )

        // Clear to empty - differs from default, so preserve ?langs=
        widgetMgr.setStringArrayValue(widget, [], { fromUi: true }, undefined)

        // Empty differs from default ["Python"], so we write ?langs=
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("langs=")
      })
    })

    describe("empty value handling with clearable parameter", () => {
      it("preserves empty value in URL when clearable=true (multiselect)", () => {
        const widget = { id: "multiselect1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "multiselect1",
          "tags",
          "string_array_value",
          ["default"],
          true // clearable - multiselect always allows clearing
        )

        // Set empty array - should write ?tags= since clearable=true
        widgetMgr.setStringArrayValue(widget, [], { fromUi: true }, undefined)

        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("tags=")
      })

      it("preserves empty value in URL when clearable=true (pills)", () => {
        const widget = { id: "pills1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "pills1",
          "selected",
          "int_array_value",
          [0],
          true // clearable - pills allows clearing
        )

        // Set empty array - should write ?selected= since clearable=true
        widgetMgr.setIntArrayValue(widget, [], { fromUi: true }, undefined)

        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("selected=")
      })

      it("preserves empty value in URL when clearable=true and empty differs from default (selectbox)", () => {
        const widget = { id: "selectbox1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "selectbox1",
          "choice",
          "string_value",
          "Red", // Non-null default
          true // clearable - selectbox with index=None allows clearing
        )

        // Set null (cleared) - differs from default "Red", so write ?choice=
        widgetMgr.setStringValue(widget, null, { fromUi: true }, undefined)

        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("choice=")
      })

      it("clears URL when null equals null default (hide at default)", () => {
        const widget = { id: "selectbox2", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "selectbox2",
          "option",
          "string_value",
          null, // Null default
          true // clearable
        )

        // First set a non-null value
        widgetMgr.setStringValue(widget, "Blue", { fromUi: true }, undefined)
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("option=Blue")

        // Set back to null - matches default, so clear param
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setStringValue(widget, null, { fromUi: true }, undefined)

        // Null matches default null, so param is cleared (not ?option=)
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("")
      })

      it("clears URL param when clearable=false (checkbox)", () => {
        const widget = { id: "checkbox1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "checkbox1",
          "enabled",
          "bool_value",
          false,
          false // not clearable - checkbox always has a value
        )

        // First set to non-default value to populate URL
        widgetMgr.setBoolValue(widget, true, { fromUi: true }, undefined)
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("enabled=true")

        // Clear mock and set back to default - should clear the param
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setBoolValue(widget, false, { fromUi: true }, undefined)

        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("")
      })

      it("clears param when value matches non-null default (clearable=false)", () => {
        const widget = { id: "text1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "text1",
          "name",
          "string_value",
          "default text", // non-null default
          false // not clearable
        )

        // First set to default to establish baseline
        widgetMgr.setStringValue(
          widget,
          "default text",
          { fromUi: true },
          undefined
        )
        // Default value - no URL param
        expect(mockOnQueryParamsChange).not.toHaveBeenCalled()

        // Set to non-default value
        widgetMgr.setStringValue(widget, "hello", { fromUi: true }, undefined)
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("name=hello")

        // Set back to default - clears param
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setStringValue(
          widget,
          "default text",
          { fromUi: true },
          undefined
        )
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("")
      })

      it("clears param when value matches null default (clearable=true)", () => {
        const widget = { id: "text2", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "text2",
          "bio",
          "string_value",
          null, // null default
          true // clearable
        )

        // First set non-empty value
        widgetMgr.setStringValue(widget, "hello", { fromUi: true }, undefined)
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("bio=hello")

        // Set to empty string - matches null default, so clears param
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setStringValue(widget, "", { fromUi: true }, undefined)
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("")
      })
    })

    describe("Date object default comparison", () => {
      it("clears URL when string array matches Date[] default (date_input)", () => {
        const widget = { id: "date1", formId: "" }
        const dateDefault = [new Date(2025, 0, 15)] // Jan 15, 2025
        widgetMgr.registerQueryParamBinding(
          "date1",
          "birthday",
          "string_array_value",
          dateDefault,
          false
        )

        // Set to non-default value first
        widgetMgr.setStringArrayValue(
          widget,
          ["2025-06-20"],
          { fromUi: true },
          undefined
        )
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
          "birthday=2025-06-20"
        )

        // Set back to default — URL string "2025-01-15" should match Date default
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setStringArrayValue(
          widget,
          ["2025-01-15"],
          { fromUi: true },
          undefined
        )
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("")
      })

      it("clears URL when string array matches Date[] range default", () => {
        const widget = { id: "daterange1", formId: "" }
        const rangeDefault = [new Date(2025, 2, 1), new Date(2025, 2, 15)]
        widgetMgr.registerQueryParamBinding(
          "daterange1",
          "range",
          "string_array_value",
          rangeDefault,
          false
        )

        widgetMgr.setStringArrayValue(
          widget,
          ["2025-03-01", "2025-03-15"],
          { fromUi: true },
          undefined
        )
        expect(mockOnQueryParamsChange).not.toHaveBeenCalled()
      })

      it("does not clear URL when string array differs from Date[] default", () => {
        const widget = { id: "date2", formId: "" }
        const dateDefault = [new Date(2025, 0, 15)]
        widgetMgr.registerQueryParamBinding(
          "date2",
          "birthday",
          "string_array_value",
          dateDefault,
          false
        )

        widgetMgr.setStringArrayValue(
          widget,
          ["2025-06-20"],
          { fromUi: true },
          undefined
        )
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
          "birthday=2025-06-20"
        )
      })
    })

    describe("handler edge cases", () => {
      it("gracefully handles no handler set", () => {
        // Create a new widgetMgr without setting a handler
        const mgr = new WidgetStateManager({
          sendRerunBackMsg: vi.fn(),
          formsDataChanged: vi.fn(),
        })

        const widget = { id: "checkbox1", formId: "" }
        mgr.registerQueryParamBinding(
          "checkbox1",
          "enabled",
          "bool_value",
          false,
          false
        )

        // Should not throw when no handler is set
        expect(() => {
          mgr.setBoolValue(widget, true, { fromUi: true }, undefined)
        }).not.toThrow()
      })
    })

    describe("filterParamsForPageChange", () => {
      it("returns only embed params when no widgets are bound", () => {
        const result = widgetMgr.filterParamsForPageChange("embed=true")
        expect(result).toBe("embed=true")
      })

      it("returns empty string when no embed params and no bound widgets", () => {
        const result = widgetMgr.filterParamsForPageChange("")
        expect(result).toBe("")
      })

      it("preserves bound widget params from current URL", () => {
        // Register a binding
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "my_key",
          "string_value",
          "default",
          false
        )

        // Set the widget value to update URL
        const widget = { id: "widget1", formId: "" }
        widgetMgr.setStringValue(
          widget,
          "my_value",
          { fromUi: true },
          undefined
        )

        // Now filter - should preserve the bound param
        const result = widgetMgr.filterParamsForPageChange("")
        expect(result).toBe("my_key=my_value")
      })

      it("combines embed params with bound widget params", () => {
        // Register a binding
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "color",
          "string_value",
          "red",
          false
        )

        // Set the widget value
        const widget = { id: "widget1", formId: "" }
        widgetMgr.setStringValue(widget, "blue", { fromUi: true }, undefined)

        // Filter with embed params
        const result = widgetMgr.filterParamsForPageChange("embed=true")
        expect(result).toBe("embed=true&color=blue")
      })

      it("preserves multiple bound widget params", () => {
        // Register multiple bindings

        widgetMgr.registerQueryParamBinding(
          "widget1",
          "name",
          "string_value",
          "",
          false
        )
        widgetMgr.registerQueryParamBinding(
          "widget2",
          "count",
          "int_value",
          0,
          false
        )

        // Set widget values
        const widget1 = { id: "widget1", formId: "" }

        const widget2 = { id: "widget2", formId: "" }
        widgetMgr.setStringValue(widget1, "test", { fromUi: true }, undefined)
        widgetMgr.setIntValue(widget2, 42, { fromUi: true }, undefined)

        // Filter - should preserve both bound params
        const result = widgetMgr.filterParamsForPageChange("")
        expect(result).toContain("name=test")
        expect(result).toContain("count=42")
      })
    })
  })
})
