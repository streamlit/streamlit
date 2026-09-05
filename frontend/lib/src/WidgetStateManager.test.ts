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

import { waitFor } from "@testing-library/react"
import { enableMapSet, enablePatches } from "immer"
import { getLogger } from "loglevel"
import { type Long, util } from "protobufjs/minimal"
import { Mock } from "vitest"

import {
  ArrowTable as ArrowTableProto,
  Button as ButtonProto,
  FileUploaderState as FileUploaderStateProto,
  UploadedFileInfo as UploadedFileInfoProto,
  WidgetState,
} from "@streamlit/protobuf"

import {
  createFormsData,
  FormsData,
  microsToIsoString,
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
        expect(sendBackMsg).toHaveBeenCalledWith(
          expect.anything(),
          undefined, // fragmentId
          undefined,
          undefined
        )
      })
      expect(sendBackMsg).toHaveBeenCalledTimes(1)
    }
  }

  it.each([false, true])(
    "sets string value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setStringValue(widget.id, "mockStringValue", {
        formId: widget.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getStringValue(widget)).toBe("mockStringValue")
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets boolean value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setBoolValue(widget.id, true, {
        formId: widget.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getBoolValue(widget)).toBe(true)
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets int value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setIntValue(widget.id, 100, {
        formId: widget.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getIntValue(widget)).toBe(100)
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets double value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setDoubleValue(widget.id, 3.14, {
        formId: widget.formId,
        fragmentId: undefined,
        fromUser: true,
      })
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
    await widgetMgr.setTriggerValue(widget.id, {
      formId: widget.formId,
      fragmentId: undefined,
      fromUser: true,
    })

    // @ts-expect-error
    expect(widgetMgr.getWidgetState(widget)).toBe(undefined)
    await assertCallbacks({ insideForm: false })
  })

  it.each([false, true])(
    "sets string array value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setStringArrayValue(widget.id, ["foo", "bar", "baz"], {
        formId: widget.formId,
        fragmentId: undefined,
        fromUser: true,
      })
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
      widgetMgr.setIntArrayValue(widget.id, [4, 5, 6], {
        formId: widget.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getIntArrayValue(widget)).toEqual([4, 5, 6])
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets double array value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setDoubleArrayValue(widget.id, [1.1, 2.2, 3.3], {
        formId: widget.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getDoubleArrayValue(widget)).toEqual([1.1, 2.2, 3.3])
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets ArrowTable value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setArrowValue(widget.id, MOCK_ARROW_TABLE, {
        formId: widget.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getArrowValue(widget)).toEqual(MOCK_ARROW_TABLE)
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets JSON value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setJsonValue(widget.id, MOCK_JSON, {
        formId: widget.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getJsonValue(widget)).toBe(JSON.stringify(MOCK_JSON))
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets bytes value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setBytesValue(widget.id, MOCK_BYTES, {
        formId: widget.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getBytesValue(widget)).toEqual(MOCK_BYTES)
      await assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets FileUploaderState value correctly (insideForm=%s)",
    async insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setFileUploaderStateValue(
        widget.id,
        MOCK_FILE_UPLOADER_STATE,
        { formId: widget.formId, fragmentId: undefined, fromUser: true }
      )
      expect(widgetMgr.getFileUploaderStateValue(widget)).toEqual(
        MOCK_FILE_UPLOADER_STATE
      )
      await assertCallbacks({ insideForm })
    }
  )

  it("setIntValue can handle MIN_ and MAX_SAFE_INTEGER", () => {
    widgetMgr.setIntValue(MOCK_WIDGET.id, Number.MAX_SAFE_INTEGER, {
      formId: MOCK_WIDGET.formId,
      fragmentId: undefined,
      fromUser: true,
    })

    expect(widgetMgr.getIntValue(MOCK_WIDGET)).toBe(Number.MAX_SAFE_INTEGER)

    widgetMgr.setIntValue(MOCK_WIDGET.id, Number.MIN_SAFE_INTEGER, {
      formId: MOCK_WIDGET.formId,
      fragmentId: undefined,
      fromUser: true,
    })

    expect(widgetMgr.getIntValue(MOCK_WIDGET)).toBe(Number.MIN_SAFE_INTEGER)
  })

  describe("handles protobuf sint64 Long values safely", () => {
    // Cover the Long branch of requireNumberInt directly. Widget int fields are
    // sint64 (`number | Long`), but the frontend never decodes a WidgetState
    // (values only go client -> server), so that branch is otherwise unreachable.

    // `false` selects a signed Long, matching sint64 widget int fields.
    const asLong = (value: number): Long =>
      util.LongBits.from(value).toLong(false)

    const update = {
      formId: MOCK_WIDGET.formId,
      fragmentId: undefined,
      fromUser: true,
    }

    const setRawIntValue = (raw: number | Long): void => {
      widgetMgr.setIntValue(MOCK_WIDGET.id, 0, update)
      // @ts-expect-error -- widgetStates is private; reach in to simulate a decoded proto
      widgetMgr.widgetStates.getState(MOCK_WIDGET.id).intValue = raw
    }

    it.each([0, 42, -42, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER])(
      "converts a Long holding %i",
      value => {
        setRawIntValue(asLong(value))
        expect(widgetMgr.getIntValue(MOCK_WIDGET)).toBe(value)
      }
    )

    it("converts Longs inside an int array", () => {
      widgetMgr.setIntArrayValue(MOCK_WIDGET.id, [0, 0], update)
      const data = [asLong(42), asLong(Number.MIN_SAFE_INTEGER)]
      // @ts-expect-error -- widgetStates is private; reach in to simulate a decoded proto
      widgetMgr.widgetStates.getState(MOCK_WIDGET.id).intArrayValue.data = data

      expect(widgetMgr.getIntArrayValue(MOCK_WIDGET)).toEqual([
        42,
        Number.MIN_SAFE_INTEGER,
      ])
    })

    it("throws when a Long exceeds the safe integer range", () => {
      // 2^53 is the first positive integer outside JavaScript's safe integer range.
      setRawIntValue(asLong(2 ** 53))
      expect(() => widgetMgr.getIntValue(MOCK_WIDGET)).toThrow(
        /cannot be converted to number without a loss of precision/
      )
    })
  })

  it("setIntArrayValue can handle MIN_ and MAX_SAFE_INTEGER", () => {
    const values = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]
    widgetMgr.setIntArrayValue(MOCK_WIDGET.id, values, {
      formId: MOCK_WIDGET.formId,
      fragmentId: undefined,
      fromUser: true,
    })

    expect(widgetMgr.getIntArrayValue(MOCK_WIDGET)).toStrictEqual(values)
  })

  it("returns undefined from typed getters when the widget has no stored value", () => {
    expect(widgetMgr.getIntArrayValue(MOCK_WIDGET)).toBeUndefined()
    expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBeUndefined()
    expect(widgetMgr.getArrowValue(MOCK_WIDGET)).toBeUndefined()
    expect(widgetMgr.getBytesValue(MOCK_WIDGET)).toBeUndefined()
  })

  it("flushes a string trigger value to the backend", async () => {
    widgetMgr.setStringTriggerValue(MOCK_WIDGET.id, "menu-item", {
      formId: MOCK_WIDGET.formId,
      fragmentId: undefined,
      fromUser: true,
    })

    await waitFor(() => {
      expect(sendBackMsg).toHaveBeenCalledTimes(1)
    })
    expect(sendBackMsg).toHaveBeenCalledWith(
      {
        widgets: [
          {
            id: MOCK_WIDGET.id,
            stringTriggerValue: { data: "menu-item" },
          },
        ],
      },
      undefined,
      undefined,
      undefined
    )
  })

  describe("triggerRerun (on_change=ignore delivery override)", () => {
    it("buffers the value without scheduling a rerun when triggerRerun is false", async () => {
      widgetMgr.setDoubleArrayValue(MOCK_WIDGET.id, [1.1, 2.2], {
        formId: MOCK_WIDGET.formId,
        fragmentId: undefined,
        fromUser: true,
        triggerRerun: false,
      })

      // The value is stored so it can be delivered on a later rerun...
      expect(widgetMgr.getDoubleArrayValue(MOCK_WIDGET)).toEqual([1.1, 2.2])
      // ...but no macrotask flush is scheduled, so no rerun happens.
      await new Promise(resolve => {
        setTimeout(resolve, 0)
      })
      expect(sendBackMsg).not.toHaveBeenCalled()
    })

    it("delivers a buffered (triggerRerun:false) value on the next committed rerun", async () => {
      const bufferedWidget = { id: "bufferedWidget", formId: "" }
      const committingWidget = { id: "committingWidget", formId: "" }

      // Buffer a value without triggering a rerun.
      widgetMgr.setDoubleValue(bufferedWidget.id, 42, {
        formId: bufferedWidget.formId,
        fragmentId: undefined,
        fromUser: true,
        triggerRerun: false,
      })
      expect(sendBackMsg).not.toHaveBeenCalled()

      // A normal committed change on another widget triggers the rerun and
      // carries the buffered value along.
      widgetMgr.setBoolValue(committingWidget.id, true, {
        formId: committingWidget.formId,
        fragmentId: undefined,
        fromUser: true,
      })

      await waitFor(() => {
        expect(sendBackMsg).toHaveBeenCalledTimes(1)
      })
      expect(sendBackMsg).toHaveBeenCalledWith(
        {
          widgets: expect.arrayContaining([
            { id: "bufferedWidget", doubleValue: 42 },
            { id: "committingWidget", boolValue: true },
          ]),
        },
        undefined,
        undefined,
        undefined
      )
    })

    it("defaults triggerRerun to fromUser when omitted", async () => {
      widgetMgr.setBoolValue(MOCK_WIDGET.id, true, {
        formId: MOCK_WIDGET.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      await waitFor(() => {
        expect(sendBackMsg).toHaveBeenCalledTimes(1)
      })
    })

    it("does not schedule a rerun when triggerRerun is omitted and fromUser is false", async () => {
      // The other half of `triggerRerun ?? fromUser`: a programmatic write
      // (fromUser: false) defaults triggerRerun to false, so the value is
      // stored without scheduling a flush/rerun.
      widgetMgr.setBoolValue(MOCK_WIDGET.id, true, {
        formId: MOCK_WIDGET.formId,
        fragmentId: undefined,
        fromUser: false,
      })

      expect(widgetMgr.getBoolValue(MOCK_WIDGET)).toBe(true)
      await new Promise(resolve => {
        setTimeout(resolve, 0)
      })
      expect(sendBackMsg).not.toHaveBeenCalled()
    })

    it("ignores triggerRerun inside a form: value is batched and delivered on submit", () => {
      const formId = "mockFormId"
      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton" })
      )

      // triggerRerun:false inside a form behaves like a normal form change,
      // because the form owns commit timing (values are sent on submit).
      widgetMgr.setStringValue("formWidget", "buffered", {
        formId: formId,
        fragmentId: undefined,
        fromUser: true,
        triggerRerun: false,
      })

      // No immediate rerun; the form is marked as having pending changes.
      expect(sendBackMsg).not.toHaveBeenCalled()
      expect(formsData.formsWithPendingChanges).toEqual(new Set([formId]))

      // The batched value is delivered on submit.
      widgetMgr.submitForm(formId, undefined)
      expect(sendBackMsg).toHaveBeenCalledWith(
        {
          widgets: expect.arrayContaining([
            { id: "submitButton", triggerValue: true },
            { id: "formWidget", stringValue: "buffered" },
          ]),
        },
        undefined,
        undefined,
        undefined
      )
    })
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
      await widgetMgr[setterMethod](MOCK_WIDGET.id, value, {
        formId: MOCK_WIDGET.formId,
        fragmentId: "myFragmentId",
        fromUser: true,
      })
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
      await widgetMgr.setTriggerValue(MOCK_WIDGET.id, {
        formId: MOCK_WIDGET.formId,
        fragmentId: "myFragmentId",
        fromUser: true,
      })
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
      widgetMgr.setJsonValue(MOCK_WIDGET.id, "mockStringValue", {
        formId: MOCK_WIDGET.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(
        JSON.stringify("mockStringValue")
      )
    })

    it("sets int value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET.id, 45, {
        formId: MOCK_WIDGET.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(JSON.stringify(45))
    })

    it("sets double value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET.id, 3.14, {
        formId: MOCK_WIDGET.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(JSON.stringify(3.14))
    })

    it("sets string array value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET.id, ["foo", "bar", "baz"], {
        formId: MOCK_WIDGET.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(
        JSON.stringify(["foo", "bar", "baz"])
      )
    })

    it("sets int array value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET.id, [5, 6, 7], {
        formId: MOCK_WIDGET.formId,
        fragmentId: undefined,
        fromUser: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(
        JSON.stringify([5, 6, 7])
      )
    })

    it("sets double array value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET.id, [1.1, 2.2, 3.3], {
        formId: MOCK_WIDGET.formId,
        fragmentId: undefined,
        fromUser: true,
      })
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
      widgetMgr.setStringValue("widget1", "foo", {
        formId: formId,
        fragmentId: undefined,
        fromUser: true,
      })
      widgetMgr.setStringValue("widget2", "bar", {
        formId: formId,
        fragmentId: undefined,
        fromUser: true,
      })

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
      widgetMgr.setStringValue("widget1", "foo", {
        formId: formId,
        fragmentId: undefined,
        fromUser: true,
      })

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

    it("aborts submission when a form validator fails", () => {
      const formId = "mockFormId"
      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton" })
      )
      widgetMgr.setStringValue("widget1", "foo", {
        formId: formId,
        fragmentId: undefined,
        fromUser: true,
      })

      const validator = vi.fn(() => false)
      widgetMgr.addFormSubmitValidator(formId, "widget1", validator)

      expect(widgetMgr.submitForm(formId, undefined)).toBe(false)

      expect(validator).toHaveBeenCalledTimes(1)
      expect(sendBackMsg).not.toHaveBeenCalled()
      expect(formsData.formsWithPendingChanges).toEqual(new Set([formId]))
    })

    it("runs all validators even when an earlier one fails", () => {
      const formId = "mockFormId"
      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton" })
      )

      const failingValidator = vi.fn(() => false)
      const secondValidator = vi.fn(() => false)
      widgetMgr.addFormSubmitValidator(formId, "widget1", failingValidator)
      widgetMgr.addFormSubmitValidator(formId, "widget2", secondValidator)

      expect(widgetMgr.submitForm(formId, undefined)).toBe(false)

      // Both validators must run (no short-circuit) so every invalid field can
      // surface its error state.
      expect(failingValidator).toHaveBeenCalledTimes(1)
      expect(secondValidator).toHaveBeenCalledTimes(1)
      expect(sendBackMsg).not.toHaveBeenCalled()
    })

    it("submits the form when all validators pass", () => {
      const formId = "mockFormId"
      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton" })
      )
      widgetMgr.setStringValue("widget1", "foo", {
        formId: formId,
        fragmentId: undefined,
        fromUser: true,
      })

      const validator = vi.fn(() => true)
      widgetMgr.addFormSubmitValidator(formId, "widget1", validator)

      expect(widgetMgr.submitForm(formId, undefined)).toBe(true)

      expect(validator).toHaveBeenCalledTimes(1)
      expect(sendBackMsg).toHaveBeenCalledWith(
        {
          widgets: [
            { id: "submitButton", triggerValue: true },
            { id: "widget1", stringValue: "foo" },
          ],
        },
        undefined,
        undefined,
        undefined
      )
    })

    it("does not run a validator after it is removed", () => {
      const formId = "mockFormId"
      widgetMgr.addSubmitButton(
        formId,
        new ButtonProto({ id: "submitButton" })
      )

      const validator = vi.fn(() => false)
      widgetMgr.addFormSubmitValidator(formId, "widget1", validator)
      widgetMgr.removeFormSubmitValidator(formId, "widget1")

      widgetMgr.submitForm(formId, undefined)

      // The removed validator must not run and must no longer block submission.
      expect(validator).not.toHaveBeenCalled()
      expect(sendBackMsg).toHaveBeenCalled()
    })

    it("does not resurrect a phantom FormState when removing a validator for an evicted form", () => {
      const formId = "neverCreatedForm"

      // This mirrors the widget unmount cleanup path: if the form was already
      // evicted, removing the validator must be a no-op and must not recreate
      // an empty, dangling FormState that is never submitted or cleaned up.
      expect(() =>
        widgetMgr.removeFormSubmitValidator(formId, "widget1")
      ).not.toThrow()

      // @ts-expect-error - inspect internal state: no phantom form was created
      expect(widgetMgr.forms.get(formId)).toBeFalsy()
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
      widgetMgr.setStringValue("widget1", "foo", {
        formId: formId,
        fragmentId: undefined,
        fromUser: true,
      })

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
      widgetMgr.setStringValue("widget1", "foo", {
        formId: formId,
        fragmentId: undefined,
        fromUser: true,
      })

      // @ts-expect-error - Created form should exist
      expect(widgetMgr.forms.get(formId)).toBeTruthy()

      // @ts-expect-error - Other form should NOT exist & should not allow submit on Enter
      expect(widgetMgr.forms.get("INVALID_FORM_ID")).toBeFalsy()
      expect(widgetMgr.allowFormEnterToSubmit("INVALID_FORM_ID")).toBe(false)
    })

    it("returns false for a valid formId with no submit buttons", () => {
      // Create form with a submit button
      const formId = "mockFormId"

      widgetMgr.setStringValue("widget1", "foo", {
        formId: formId,
        fragmentId: undefined,
        fromUser: true,
      })

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
      widgetMgr.setStringValue("widget1", "foo", {
        formId: formId,
        fragmentId: undefined,
        fromUser: true,
      })

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
      widgetMgr.setStringValue("widget1", "foo", {
        formId: formId,
        fragmentId: undefined,
        fromUser: true,
      })

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
      widgetMgr.setStringValue("widget1", "foo", {
        formId: formId,
        fragmentId: undefined,
        fromUser: true,
      })

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
      widgetMgr.setStringValue(FORM_1.id, "foo", {
        formId: FORM_1.formId,
        fragmentId: undefined,
        fromUser: true,
      })

      // Set widget value for the second form.
      widgetMgr.setStringValue(FORM_2.id, "bar", {
        formId: FORM_2.formId,
        fragmentId: undefined,
        fromUser: true,
      })
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
    widgetMgr.setStringValue(widgetId1, "widgetState1", {
      formId: undefined,
      fragmentId: undefined,
      fromUser: false,
    })
    widgetMgr.setStringValue(widgetId2, "widgetState2", {
      formId: undefined,
      fragmentId: undefined,
      fromUser: false,
    })
    widgetMgr.setStringValue(widgetId3, "widgetState3", {
      formId: undefined,
      fragmentId: undefined,
      fromUser: false,
    })
    widgetMgr.setStringValue(widgetId4, "widgetState4", {
      formId: undefined,
      fragmentId: undefined,
      fromUser: false,
    })

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

  it("keeps in-flight trigger values on removeInactive until they are flushed", async () => {
    // The Custom Components v2 trigger aggregator writes to a synthetic id that
    // is never an active element id, so a removeInactive landing between the
    // write and the batched flush used to destroy it, leaving the flush to send
    // a rerun with no trigger.
    const aggregatorId = "_streamlit_internal_myComponent:events"
    const update = { formId: "", fragmentId: undefined, fromUser: true }

    void widgetMgr.setTriggerValue(aggregatorId, update, {
      event: "foo",
      value: true,
    })
    void widgetMgr.setTriggerValue(aggregatorId, update, {
      event: "bar",
      value: true,
    })

    // A genuinely stale widget, to pin that retention is targeted at in-flight
    // triggers rather than blanket. `fromUser: false` avoids an extra flush.
    widgetMgr.setStringValue("staleWidget", "gone", {
      formId: "",
      fragmentId: undefined,
      fromUser: false,
    })

    widgetMgr.removeInactive(new Set(["myComponent"]))

    await waitFor(() => expect(sendBackMsg).toHaveBeenCalledTimes(1))

    const { widgets } = sendBackMsg.mock.calls[0][0]
    expect(widgets).toHaveLength(1)
    expect(widgets[0].id).toEqual(aggregatorId)
    // Both payloads batched in the same macrotask must survive.
    expect(JSON.parse(widgets[0].jsonTriggerValue)).toEqual([
      { event: "foo", value: true },
      { event: "bar", value: true },
    ])
    expect(widgetMgr.getStringValue({ id: "staleWidget" })).toBeUndefined()
  })

  it("keeps in-flight trigger values for widgets inside a form", () => {
    const triggerId = "formTriggerWidget"
    const { formId } = MOCK_FORM_WIDGET

    widgetMgr.setStringTriggerValue(triggerId, "typed", {
      formId,
      fragmentId: undefined,
      fromUser: true,
    })
    // A stale non-trigger widget in the same form, to pin that retention is
    // targeted rather than sparing the whole form dict.
    widgetMgr.setStringValue(MOCK_FORM_WIDGET.id, "stale", {
      formId,
      fragmentId: undefined,
      fromUser: true,
    })

    // Form-scoped trigger state lives in the form's own dict, so it needs the
    // same protection from a removeInactive landing before the flush.
    widgetMgr.removeInactive(new Set())
    widgetMgr.submitForm(formId, undefined)

    // The pending flush has not run yet, so the submit is the only message.
    expect(sendBackMsg).toHaveBeenCalledTimes(1)
    const { widgets } = sendBackMsg.mock.calls[0][0]
    expect(
      widgets.find((widget: WidgetState) => widget.id === triggerId)
        ?.stringTriggerValue?.data
    ).toEqual("typed")
    expect(widgets.map((widget: WidgetState) => widget.id)).not.toContain(
      MOCK_FORM_WIDGET.id
    )
  })

  it("drops widget state for a spent trigger id on a later removeInactive", async () => {
    const aggregatorId = "_streamlit_internal_myComponent:events"

    await widgetMgr.setTriggerValue(
      aggregatorId,
      { formId: "", fragmentId: undefined, fromUser: true },
      { event: "foo", value: true }
    )

    // Give the spent id fresh state. If the flush failed to clear it from
    // `pendingTriggerIds`, removeInactive would wrongly retain this.
    widgetMgr.setStringValue(aggregatorId, "stale", {
      formId: "",
      fragmentId: undefined,
      fromUser: false,
    })

    widgetMgr.removeInactive(new Set(["myComponent"]))

    expect(widgetMgr.getStringValue({ id: aggregatorId })).toBeUndefined()
  })

  it("cleans up inactive form widget states on removeInactive", () => {
    widgetMgr.setStringValue(MOCK_FORM_WIDGET.id, "pending", {
      formId: MOCK_FORM_WIDGET.formId,
      fragmentId: undefined,
      fromUser: true,
    })

    expect(widgetMgr.getStringValue(MOCK_FORM_WIDGET)).toEqual("pending")

    widgetMgr.removeInactive(new Set())

    expect(widgetMgr.getStringValue(MOCK_FORM_WIDGET)).toBeUndefined()
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

    widgetStateManager.setStringValue("widget1", "foo", {
      formId: undefined,
      fragmentId: undefined,
      fromUser: false,
    })
    widgetStateManager.setStringValue("widget2", "bar", {
      formId: undefined,
      fragmentId: undefined,
      fromUser: false,
    })

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

    await widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "fragT", fromUser: true },
      {
        t: 1,
      }
    )

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

    widgetMgr.setJsonValue(widget.id, jsonValue, {
      formId: widget.formId,
      fragmentId: "fragJT",
      fromUser: true,
    })

    const triggerPromise = widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "fragJT", fromUser: true },
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

    const p1 = widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "fragAgg", fromUser: true },
      {
        a: 1,
      }
    )
    const p2 = widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "fragAgg", fromUser: true },
      {
        b: 2,
      }
    )

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

    const p1 = widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "frag3", fromUser: true },
      {
        x: 1,
      }
    )
    const p2 = widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "frag3", fromUser: true },
      {
        y: 2,
      }
    )
    const p3 = widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "frag3", fromUser: true },
      {
        z: 3,
      }
    )

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

    const p1 = widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "f1", fromUser: true },
      {
        a: 1,
      }
    )
    const p2 = widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "f2", fromUser: true },
      {
        b: 2,
      }
    )

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

    const p1 = widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "fragA", fromUser: true },
      {
        a: true,
      }
    )
    const p2 = widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "fragB", fromUser: true },
      {
        b: true,
      }
    )

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

    const p1 = widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "fKeep", fromUser: true },
      {
        first: true,
      }
    )
    const p2 = widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: undefined, fromUser: true },
      {
        second: true,
      }
    )

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

    await widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "fragS", fromUser: true },
      {
        next: 2,
      }
    )

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

    await widgetMgr.setTriggerValue(
      widget.id,
      { formId: widget.formId, fragmentId: "fragPF", fromUser: true },
      {
        ok: true,
      }
    )

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

      it("normalizes a scalar date default so matching values hide the URL param", () => {
        const widget = { id: "date_slider_scalar", formId: "" }
        const defaultMicros = Date.UTC(2024, 5, 15) * 1000
        widgetMgr.registerQueryParamBinding(
          "date_slider_scalar",
          "date",
          "double_array_value",
          defaultMicros,
          false,
          "repeated",
          "date"
        )

        widgetMgr.setDoubleArrayValue(widget.id, [defaultMicros], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        expect(mockOnQueryParamsChange).not.toHaveBeenCalled()
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

    describe("URL sync is independent of triggerRerun", () => {
      it.each(["", "mockFormId"])(
        "syncs the URL for a user change when triggerRerun is false (formId=%s)",
        async formId => {
          const widget = { id: "ignoreWidget", formId }
          widgetMgr.registerQueryParamBinding(
            "ignoreWidget",
            "name",
            "string_value",
            "",
            false
          )

          widgetMgr.setStringValue(widget.id, "Alice", {
            formId: widget.formId,
            fragmentId: undefined,
            fromUser: true,
            triggerRerun: false,
          })

          // Same as a form: the URL reflects the UI value even though Python
          // has not received it yet (no rerun / no submit).
          expect(window.history.replaceState).toHaveBeenCalled()
          expect(mockOnQueryParamsChange).toHaveBeenCalledWith("name=Alice")

          await new Promise(resolve => {
            setTimeout(resolve, 0)
          })
          expect(sendBackMsg).not.toHaveBeenCalled()
        }
      )

      it("still syncs the URL for a normal committed change (triggerRerun omitted)", () => {
        const widget = { id: "commitWidget", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "commitWidget",
          "name",
          "string_value",
          "",
          false
        )

        widgetMgr.setStringValue(widget.id, "Alice", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        expect(window.history.replaceState).toHaveBeenCalled()
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("name=Alice")
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
            widgetMgr.setBoolValue(widget.id, testVal, {
              formId: widget.formId,
              fragmentId: undefined,
              fromUser: true,
            })
          } else if (valueType === "int_value") {
            widgetMgr.setIntValue(widget.id, testVal, {
              formId: widget.formId,
              fragmentId: undefined,
              fromUser: true,
            })
          } else if (valueType === "double_value") {
            widgetMgr.setDoubleValue(widget.id, testVal, {
              formId: widget.formId,
              fragmentId: undefined,
              fromUser: true,
            })
          } else {
            widgetMgr.setStringValue(widget.id, testVal, {
              formId: widget.formId,
              fragmentId: undefined,
              fromUser: true,
            })
          }

          expect(window.history.replaceState).toHaveBeenCalled()
          expect(mockOnQueryParamsChange).toHaveBeenCalledWith(expected)
        }
      )

      it("does not sync when value is from backend (fromUser: false)", () => {
        const widget = { id: "checkbox1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "checkbox1",
          "enabled",
          "bool_value",
          false,
          false
        )

        widgetMgr.setBoolValue(widget.id, true, {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: false,
        })

        expect(window.history.replaceState).not.toHaveBeenCalled()
        expect(mockOnQueryParamsChange).not.toHaveBeenCalled()
      })

      it("does not sync unbound widget", () => {
        const widget = { id: "unbound_widget", formId: "" }
        // Don't register any binding for this widget

        widgetMgr.setStringValue(widget.id, "test", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

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
        widgetMgr.setBoolValue(widget.id, true, {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
        vi.clearAllMocks()

        // Set back to default
        widgetMgr.setBoolValue(widget.id, false, {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

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
        widgetMgr.setIntValue(widget.id, 5, {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
        vi.clearAllMocks()

        // Set to null (widget cleared)
        widgetMgr.setIntValue(widget.id, null, {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        expect(window.history.replaceState).toHaveBeenCalled()
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("")
      })

      it("encodes spaces as + in URL, not %20", () => {
        const widget = { id: "widget1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "name",
          "string_value",
          "",
          false
        )

        widgetMgr.setStringValue(widget.id, "hello world", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        expect(window.history.replaceState).toHaveBeenCalled()
        const url = (window.history.replaceState as Mock).mock.calls[0][2]
        expect(url).toContain("name=hello+world")
        expect(url).not.toContain("%20")
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

        widgetMgr.setStringArrayValue(widget.id, ["foo", "bar"], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

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

        widgetMgr.setStringArrayValue(widget.id, ["foo", "bar"], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

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

        widgetMgr.setDoubleArrayValue(widget.id, [10, 90], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

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

        widgetMgr.setDoubleArrayValue(widget.id, [10, NaN, 90], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
          "range=10&range=90"
        )
      })

      it("clears URL param when all double array values are invalid (fromUser: true)", () => {
        const widget = { id: "slider1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "slider1",
          "range",
          "double_array_value",
          [0, 100],
          false
        )

        // First set a valid value to put something in the URL
        widgetMgr.setDoubleArrayValue(widget.id, [10, 90], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
          "range=10&range=90"
        )

        // Now set all invalid values - should clear the URL
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setDoubleArrayValue(widget.id, [NaN, NaN], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        // URL should be cleared (empty string means param removed)
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("")
        // State should NOT be updated when all values are invalid (previous value remains)
        expect(widgetMgr.getDoubleArrayValue(widget)).toEqual([10, 90])
      })

      it("does not update URL when all double array values are invalid (fromUser: false)", () => {
        const widget = { id: "slider1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "slider1",
          "range",
          "double_array_value",
          [0, 100],
          false
        )

        widgetMgr.setDoubleArrayValue(widget.id, [NaN, NaN], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: false,
        })

        // URL should NOT be modified for backend changes
        expect(window.history.replaceState).not.toHaveBeenCalled()
        expect(mockOnQueryParamsChange).not.toHaveBeenCalled()
        // State should NOT be updated when all values are invalid
        expect(widgetMgr.getDoubleArrayValue(widget)).toBeUndefined()
      })

      it("updates state but not URL for valid double array values (fromUser: false)", () => {
        const widget = { id: "slider1", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "slider1",
          "range",
          "double_array_value",
          [0, 100],
          false
        )

        widgetMgr.setDoubleArrayValue(widget.id, [25, 75], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: false,
        })

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
        widgetMgr.setStringArrayValue(widget.id, ["tag1", "tag2"], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
          "tags=tag1&tags=tag2"
        )

        // Now clear the array - empty matches default, so clear param
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setStringArrayValue(widget.id, [], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

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
        widgetMgr.setStringArrayValue(widget.id, [], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

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
        widgetMgr.setStringArrayValue(widget.id, [], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

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
        widgetMgr.setIntArrayValue(widget.id, [], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("selected=")
      })

      it("syncs a non-empty int array to repeated URL params", () => {
        const widget = { id: "pills2", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "pills2",
          "selected",
          "int_array_value",
          [0],
          true
        )

        widgetMgr.setIntArrayValue(widget.id, [1, 2], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
          "selected=1&selected=2"
        )
      })

      it("hides the URL param when a single-element int array matches a scalar default", () => {
        const widget = { id: "slider_scalar_default", formId: "" }
        widgetMgr.registerQueryParamBinding(
          "slider_scalar_default",
          "n",
          "int_array_value",
          5,
          false
        )

        widgetMgr.setIntArrayValue(widget.id, [5], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        expect(mockOnQueryParamsChange).not.toHaveBeenCalled()
      })

      it("hides the URL param when a date default matches the selected value", () => {
        const widget = { id: "date_default", formId: "" }
        const defaultDate = new Date(2024, 0, 15)
        widgetMgr.registerQueryParamBinding(
          "date_default",
          "d",
          "string_value",
          defaultDate,
          false
        )

        widgetMgr.setStringValue(widget.id, "2024-01-15", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        expect(mockOnQueryParamsChange).not.toHaveBeenCalled()
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
        widgetMgr.setStringValue(widget.id, null, {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

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
        widgetMgr.setStringValue(widget.id, "Blue", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("option=Blue")

        // Set back to null - matches default, so clear param
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setStringValue(widget.id, null, {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

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
        widgetMgr.setBoolValue(widget.id, true, {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("enabled=true")

        // Clear mock and set back to default - should clear the param
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setBoolValue(widget.id, false, {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

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
        widgetMgr.setStringValue(widget.id, "default text", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
        // Default value - no URL param
        expect(mockOnQueryParamsChange).not.toHaveBeenCalled()

        // Set to non-default value
        widgetMgr.setStringValue(widget.id, "hello", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("name=hello")

        // Set back to default - clears param
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setStringValue(widget.id, "default text", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
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
        widgetMgr.setStringValue(widget.id, "hello", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith("bio=hello")

        // Set to empty string - matches null default, so clears param
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setStringValue(widget.id, "", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
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
        widgetMgr.setStringArrayValue(widget.id, ["2025-06-20"], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
        expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
          "birthday=2025-06-20"
        )

        // Set back to default — URL string "2025-01-15" should match Date default
        mockOnQueryParamsChange.mockClear()
        widgetMgr.setStringArrayValue(widget.id, ["2025-01-15"], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
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
          widget.id,
          ["2025-03-01", "2025-03-15"],
          { formId: widget.formId, fragmentId: undefined, fromUser: true }
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

        widgetMgr.setStringArrayValue(widget.id, ["2025-06-20"], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })
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
          mgr.setBoolValue(widget.id, true, {
            formId: widget.formId,
            fragmentId: undefined,
            fromUser: true,
          })
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
        widgetMgr.setStringValue(widget.id, "my_value", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        // Now filter - should preserve the bound param
        const result = widgetMgr.filterParamsForPageChange("")
        expect(result).toBe("my_key=my_value")
      })

      it("preserves repeated bound params from the current URL", () => {
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "tags",
          "string_array_value",
          [],
          true
        )

        const widget = { id: "widget1", formId: "" }
        widgetMgr.setStringArrayValue(widget.id, ["alpha", "beta"], {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        const result = widgetMgr.filterParamsForPageChange("")
        expect(result).toContain("tags=alpha")
        expect(result).toContain("tags=beta")
      })

      describe("date/time slider ISO URL formatting", () => {
        it("formats date slider micros as ISO date strings in URL", () => {
          const widget = { id: "date_slider1", formId: "" }
          const dateMicros = Date.UTC(2024, 5, 15) * 1000
          widgetMgr.registerQueryParamBinding(
            "date_slider1",
            "date",
            "double_array_value",
            [dateMicros],
            false,
            "repeated",
            "date"
          )

          widgetMgr.setDoubleArrayValue(widget.id, [dateMicros], {
            formId: widget.formId,
            fragmentId: undefined,
            fromUser: true,
          })

          expect(mockOnQueryParamsChange).not.toHaveBeenCalled()
        })

        it("formats non-default date as ISO string in URL", () => {
          const widget = { id: "date_slider2", formId: "" }
          const defaultMicros = Date.UTC(2024, 5, 15) * 1000
          const newMicros = Date.UTC(2024, 2, 20) * 1000
          widgetMgr.registerQueryParamBinding(
            "date_slider2",
            "date",
            "double_array_value",
            [defaultMicros],
            false,
            "repeated",
            "date"
          )

          widgetMgr.setDoubleArrayValue(widget.id, [newMicros], {
            formId: widget.formId,
            fragmentId: undefined,
            fromUser: true,
          })

          expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
            "date=2024-03-20"
          )
        })

        it("formats time slider micros as ISO time strings in URL", () => {
          const widget = { id: "time_slider1", formId: "" }
          const timeMicros = Date.UTC(2000, 0, 1, 14, 30) * 1000
          const defaultMicros = Date.UTC(2000, 0, 1, 12, 0) * 1000
          widgetMgr.registerQueryParamBinding(
            "time_slider1",
            "time",
            "double_array_value",
            [defaultMicros],
            false,
            "repeated",
            "time"
          )

          widgetMgr.setDoubleArrayValue(widget.id, [timeMicros], {
            formId: widget.formId,
            fragmentId: undefined,
            fromUser: true,
          })

          expect(mockOnQueryParamsChange).toHaveBeenCalledWith("time=14%3A30")
        })

        it("formats datetime slider micros as ISO datetime strings in URL", () => {
          const widget = { id: "dt_slider1", formId: "" }
          const dtMicros = Date.UTC(2024, 2, 20, 9, 30) * 1000
          const defaultMicros = Date.UTC(2024, 5, 15, 14, 30) * 1000
          widgetMgr.registerQueryParamBinding(
            "dt_slider1",
            "dt",
            "double_array_value",
            [defaultMicros],
            false,
            "repeated",
            "datetime"
          )

          widgetMgr.setDoubleArrayValue(widget.id, [dtMicros], {
            formId: widget.formId,
            fragmentId: undefined,
            fromUser: true,
          })

          expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
            "dt=2024-03-20T09%3A30"
          )
        })

        it("formats date range slider as repeated ISO date params", () => {
          const widget = { id: "daterange_slider1", formId: "" }
          const startMicros = Date.UTC(2022, 0, 1) * 1000
          const endMicros = Date.UTC(2024, 0, 1) * 1000
          const defaultStart = Date.UTC(2020, 0, 1) * 1000
          const defaultEnd = Date.UTC(2025, 0, 1) * 1000
          widgetMgr.registerQueryParamBinding(
            "daterange_slider1",
            "range",
            "double_array_value",
            [defaultStart, defaultEnd],
            false,
            "repeated",
            "date"
          )

          widgetMgr.setDoubleArrayValue(widget.id, [startMicros, endMicros], {
            formId: widget.formId,
            fragmentId: undefined,
            fromUser: true,
          })

          expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
            "range=2022-01-01&range=2024-01-01"
          )
        })

        it("clears URL when date slider returns to default", () => {
          const widget = { id: "date_slider3", formId: "" }
          const defaultMicros = Date.UTC(2024, 5, 15) * 1000
          const newMicros = Date.UTC(2024, 2, 20) * 1000
          widgetMgr.registerQueryParamBinding(
            "date_slider3",
            "date",
            "double_array_value",
            [defaultMicros],
            false,
            "repeated",
            "date"
          )

          widgetMgr.setDoubleArrayValue(widget.id, [newMicros], {
            formId: widget.formId,
            fragmentId: undefined,
            fromUser: true,
          })
          expect(mockOnQueryParamsChange).toHaveBeenCalledWith(
            "date=2024-03-20"
          )

          mockOnQueryParamsChange.mockClear()
          widgetMgr.setDoubleArrayValue(widget.id, [defaultMicros], {
            formId: widget.formId,
            fragmentId: undefined,
            fromUser: true,
          })
          expect(mockOnQueryParamsChange).toHaveBeenCalledWith("")
        })
      })

      it("combines embed params with bound widget params", () => {
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "color",
          "string_value",
          "red",
          false
        )

        // Set the widget value
        const widget = { id: "widget1", formId: "" }
        widgetMgr.setStringValue(widget.id, "blue", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

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
        widgetMgr.setStringValue(widget1.id, "test", {
          formId: widget1.formId,
          fragmentId: undefined,
          fromUser: true,
        })
        widgetMgr.setIntValue(widget2.id, 42, {
          formId: widget2.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        // Filter - should preserve both bound params
        const result = widgetMgr.filterParamsForPageChange("")
        expect(result).toContain("name=test")
        expect(result).toContain("count=42")
      })

      it("encodes spaces as + in filterParamsForPageChange, not %20", () => {
        widgetMgr.registerQueryParamBinding(
          "widget1",
          "q",
          "string_value",
          "",
          false
        )

        const widget = { id: "widget1", formId: "" }
        widgetMgr.setStringValue(widget.id, "hello world", {
          formId: widget.formId,
          fragmentId: undefined,
          fromUser: true,
        })

        const result = widgetMgr.filterParamsForPageChange("")
        expect(result).toBe("q=hello+world")
        expect(result).not.toContain("%20")
      })
    })
  })
})

describe("microsToIsoString", () => {
  it("formats date micros as YYYY-MM-DD", () => {
    const micros = Date.UTC(2024, 5, 15) * 1000
    expect(microsToIsoString(micros, "date")).toBe("2024-06-15")
  })

  it("formats time micros as HH:mm", () => {
    const micros = Date.UTC(2000, 0, 1, 14, 30) * 1000
    expect(microsToIsoString(micros, "time")).toBe("14:30")
  })

  it("formats time micros with seconds as HH:mm:ss", () => {
    const micros = Date.UTC(2000, 0, 1, 14, 30, 45) * 1000
    expect(microsToIsoString(micros, "time")).toBe("14:30:45")
  })

  it("formats datetime micros as YYYY-MM-DDTHH:mm", () => {
    const micros = Date.UTC(2024, 5, 15, 14, 30) * 1000
    expect(microsToIsoString(micros, "datetime")).toBe("2024-06-15T14:30")
  })

  it("formats datetime micros with seconds as YYYY-MM-DDTHH:mm:ss", () => {
    const micros = Date.UTC(2024, 5, 15, 14, 30, 45) * 1000
    expect(microsToIsoString(micros, "datetime")).toBe("2024-06-15T14:30:45")
  })

  it("handles midnight correctly for date", () => {
    const micros = Date.UTC(2020, 0, 1) * 1000
    expect(microsToIsoString(micros, "date")).toBe("2020-01-01")
  })

  it("handles midnight correctly for time", () => {
    const micros = Date.UTC(2000, 0, 1, 0, 0) * 1000
    expect(microsToIsoString(micros, "time")).toBe("00:00")
  })

  it("omits seconds for time when seconds are zero", () => {
    const micros = Date.UTC(2000, 0, 1, 9, 15, 0) * 1000
    expect(microsToIsoString(micros, "time")).toBe("09:15")
  })

  it("omits seconds for datetime when seconds are zero", () => {
    const micros = Date.UTC(2024, 2, 20, 9, 30, 0) * 1000
    expect(microsToIsoString(micros, "datetime")).toBe("2024-03-20T09:30")
  })
})
