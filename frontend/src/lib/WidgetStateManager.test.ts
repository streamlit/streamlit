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

import { ArrowTable } from "src/autogen/proto"
import {
  WidgetInfo,
  WidgetStateDict,
  WidgetStateManager,
} from "src/lib/WidgetStateManager"

const MOCK_ARROW_TABLE = new ArrowTable({
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

describe("Widget State Manager", () => {
  let sendBackMsg: jest.Mock
  let pendingFormsChanged: jest.Mock
  let widgetMgr: WidgetStateManager

  beforeEach(() => {
    sendBackMsg = jest.fn()
    pendingFormsChanged = jest.fn()
    widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: sendBackMsg,
      pendingFormsChanged,
    })
  })

  /** Select the mock WidgetInfo to use for a test. */
  const getWidget = ({ insideForm }: { insideForm: boolean }): WidgetInfo => {
    return insideForm ? MOCK_FORM_WIDGET : MOCK_WIDGET
  }

  /** Assert calls of our callback functions. */
  const assertCallbacks = ({ insideForm }: { insideForm: boolean }): void => {
    if (insideForm) {
      const widget = getWidget({ insideForm: true })
      const formIds = new Set([widget.formId])

      expect(sendBackMsg).not.toBeCalled()
      expect(pendingFormsChanged).toBeCalledTimes(1)
      expect(pendingFormsChanged).toHaveBeenLastCalledWith(formIds)
    } else {
      expect(sendBackMsg).toBeCalledTimes(1)
      expect(pendingFormsChanged).not.toBeCalled()
    }
  }

  it.each([false, true])(
    "sets string value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setStringValue(widget, "mockStringValue", { fromUi: true })
      expect(widgetMgr.getStringValue(widget)).toBe("mockStringValue")
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets boolean value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setBoolValue(widget, true, { fromUi: true })
      expect(widgetMgr.getBoolValue(widget)).toBe(true)
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets int value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setIntValue(widget, 100, { fromUi: true })
      expect(widgetMgr.getIntValue(widget)).toBe(100)
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets float value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setDoubleValue(widget, 3.14, { fromUi: true })
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
    widgetMgr.setTriggerValue(widget, { fromUi: true })
    // @ts-ignore
    expect(widgetMgr.getWidgetState(widget)).toBe(undefined)
    assertCallbacks({ insideForm: false })
  })

  it.each([false, true])(
    "sets string array value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setStringArrayValue(widget, ["foo", "bar", "baz"], {
        fromUi: true,
      })
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
      widgetMgr.setIntArrayValue(widget, [4, 5, 6], { fromUi: true })
      expect(widgetMgr.getIntArrayValue(widget)).toEqual([4, 5, 6])
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets float array value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setDoubleArrayValue(widget, [1.1, 2.2, 3.3], {
        fromUi: true,
      })
      expect(widgetMgr.getDoubleArrayValue(widget)).toEqual([1.1, 2.2, 3.3])
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets ArrowTable value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setArrowValue(widget, MOCK_ARROW_TABLE, { fromUi: true })
      expect(widgetMgr.getArrowValue(widget)).toEqual(MOCK_ARROW_TABLE)
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets JSON value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setJsonValue(widget, MOCK_JSON, {
        fromUi: true,
      })
      expect(widgetMgr.getJsonValue(widget)).toBe(JSON.stringify(MOCK_JSON))
      assertCallbacks({ insideForm })
    }
  )

  it.each([false, true])(
    "sets bytes value correctly (insideForm=%p)",
    insideForm => {
      const widget = getWidget({ insideForm })
      widgetMgr.setBytesValue(widget, MOCK_BYTES, { fromUi: true })
      expect(widgetMgr.getBytesValue(widget)).toEqual(MOCK_BYTES)
      assertCallbacks({ insideForm })
    }
  )

  describe("Primitive types as JSON values", () => {
    it("sets string value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET, "mockStringValue", { fromUi: true })
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(
        JSON.stringify("mockStringValue")
      )
    })

    it("sets int value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET, 45, { fromUi: true })
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(JSON.stringify(45))
    })

    it("sets float value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET, 3.14, { fromUi: true })
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(JSON.stringify(3.14))
    })

    it("sets string array value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET, ["foo", "bar", "baz"], {
        fromUi: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(
        JSON.stringify(["foo", "bar", "baz"])
      )
    })

    it("sets int array value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET, [5, 6, 7], { fromUi: true })
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(
        JSON.stringify([5, 6, 7])
      )
    })

    it("sets float array value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_WIDGET, [1.1, 2.2, 3.3], { fromUi: true })
      expect(widgetMgr.getJsonValue(MOCK_WIDGET)).toBe(
        JSON.stringify([1.1, 2.2, 3.3])
      )
    })

    it("setIntValue can handle MIN_ and MAX_SAFE_INTEGER", () => {
      widgetMgr.setIntValue(MOCK_WIDGET, Number.MAX_SAFE_INTEGER, {
        fromUi: true,
      })

      expect(widgetMgr.getIntValue(MOCK_WIDGET)).toBe(Number.MAX_SAFE_INTEGER)

      widgetMgr.setIntValue(MOCK_WIDGET, Number.MIN_SAFE_INTEGER, {
        fromUi: true,
      })

      expect(widgetMgr.getIntValue(MOCK_WIDGET)).toBe(Number.MIN_SAFE_INTEGER)
    })

    it("setIntArrayValue can handle MIN_ and MAX_SAFE_INTEGER", () => {
      const values = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]
      widgetMgr.setIntArrayValue(MOCK_WIDGET, values, {
        fromUi: true,
      })

      expect(widgetMgr.getIntArrayValue(MOCK_WIDGET)).toStrictEqual(values)
    })
  })

  describe("submitForm", () => {
    it("calls sendBackMsg with expected data", () => {
      // Populate a form
      const formId = "mockFormId"
      widgetMgr.setStringValue({ id: "widget1", formId }, "foo", {
        fromUi: true,
      })
      widgetMgr.setStringValue({ id: "widget2", formId }, "bar", {
        fromUi: true,
      })

      // We have a single pending form.
      expect(pendingFormsChanged).toHaveBeenLastCalledWith(new Set([formId]))

      // Submit the form
      widgetMgr.submitForm({ id: "submitButton", formId })

      // Our backMsg should be populated with our two widget values,
      // plus the submitButton's triggerValue.
      expect(sendBackMsg).toHaveBeenCalledWith({
        widgets: [
          { id: "widget1", stringValue: "foo" },
          { id: "widget2", stringValue: "bar" },
          { id: "submitButton", triggerValue: true },
        ],
      })

      // We have no more pending form.
      expect(pendingFormsChanged).toHaveBeenLastCalledWith(new Set<string>())
    })

    it("throws on invalid formId", () => {
      expect(() => widgetMgr.submitForm(MOCK_WIDGET)).toThrowError(
        `invalid formID ${MOCK_WIDGET.formId}`
      )
    })
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
    widgetStateDict.clean(activeIds)

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
})
