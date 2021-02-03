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

import { ArrowTable } from "autogen/proto"
import { WidgetStateManager } from "lib/WidgetStateManager"

const MOCK_DATA = {
  widgetId: "NOT_A_REAL_ID",
  stringValue: "NOT_A_REAL_STRING_VALUE",
  booleanValue: true,
  intValue: 10,
  doubleValue: 0.1,
  stringArray: ["foo", "bar", "baz"],
  intArray: [1, 25, 50],
  doubleArray: [0.1, 0.25, 5],
  jsonValue: {
    foo: "bar",
    baz: "qux",
  },
  bytesValue: new Uint8Array([0, 1, 2, 3]),
  arrowValue: new ArrowTable({
    data: new Uint8Array(),
    index: new Uint8Array(),
    columns: new Uint8Array(),
  }),
}

describe("Widget State Manager", () => {
  jest.mock("lib/WidgetStateManager")
  const sendBackMsg = jest.fn()
  const widgetMgr = new WidgetStateManager(sendBackMsg)

  it("sets string value correctly", () => {
    widgetMgr.setStringValue(MOCK_DATA.widgetId, MOCK_DATA.stringValue, {
      fromUi: true,
    })
    expect(widgetMgr.getStringValue(MOCK_DATA.widgetId)).toBe(
      MOCK_DATA.stringValue
    )
  })

  it("sets boolean value correctly", () => {
    widgetMgr.setBoolValue(MOCK_DATA.widgetId, MOCK_DATA.booleanValue, {
      fromUi: true,
    })
    expect(widgetMgr.getBoolValue(MOCK_DATA.widgetId)).toBe(
      MOCK_DATA.booleanValue
    )
  })

  it("sets int value correctly", () => {
    widgetMgr.setIntValue(MOCK_DATA.widgetId, MOCK_DATA.intValue, {
      fromUi: true,
    })
    expect(widgetMgr.getIntValue(MOCK_DATA.widgetId)).toBe(MOCK_DATA.intValue)
  })

  it("sets float value correctly", () => {
    widgetMgr.setDoubleValue(MOCK_DATA.widgetId, MOCK_DATA.doubleValue, {
      fromUi: true,
    })
    expect(widgetMgr.getDoubleValue(MOCK_DATA.widgetId)).toBe(
      MOCK_DATA.doubleValue
    )
  })

  it("sets trigger value correctly", () => {
    widgetMgr.setTriggerValue(MOCK_DATA.widgetId, { fromUi: true })
    // @ts-ignore
    expect(widgetMgr.getWidgetStateProto(MOCK_DATA.widget_id)).toBe(undefined)
  })

  it("sets string array value correctly", () => {
    widgetMgr.setStringArrayValue(MOCK_DATA.widgetId, MOCK_DATA.stringArray, {
      fromUi: true,
    })
    expect(widgetMgr.getStringArrayValue(MOCK_DATA.widgetId)).toEqual(
      MOCK_DATA.stringArray
    )
  })

  it("sets int array value correctly", () => {
    widgetMgr.setIntArrayValue(MOCK_DATA.widgetId, MOCK_DATA.intArray, {
      fromUi: true,
    })
    expect(widgetMgr.getIntArrayValue(MOCK_DATA.widgetId)).toEqual(
      MOCK_DATA.intArray
    )
  })

  it("sets float array value correctly", () => {
    widgetMgr.setDoubleArrayValue(MOCK_DATA.widgetId, MOCK_DATA.doubleArray, {
      fromUi: true,
    })
    expect(widgetMgr.getDoubleArrayValue(MOCK_DATA.widgetId)).toEqual(
      MOCK_DATA.doubleArray
    )
  })

  it("sets ArrowTable value correctly", () => {
    widgetMgr.setArrowValue(MOCK_DATA.widgetId, MOCK_DATA.arrowValue, {
      fromUi: true,
    })
    expect(widgetMgr.getArrowValue(MOCK_DATA.widgetId)).toEqual(
      MOCK_DATA.arrowValue
    )
  })

  it("sets JSON value correctly", () => {
    widgetMgr.setJsonValue(MOCK_DATA.widgetId, MOCK_DATA.jsonValue, {
      fromUi: true,
    })
    expect(widgetMgr.getJsonValue(MOCK_DATA.widgetId)).toBe(
      JSON.stringify(MOCK_DATA.jsonValue)
    )
  })

  it("sets bytes value correctly", () => {
    widgetMgr.setBytesValue(MOCK_DATA.widgetId, MOCK_DATA.bytesValue, {
      fromUi: true,
    })
    expect(widgetMgr.getBytesValue(MOCK_DATA.widgetId)).toEqual(
      MOCK_DATA.bytesValue
    )
  })

  describe("Primitive types as JSON values", () => {
    it("sets string value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_DATA.widgetId, MOCK_DATA.stringValue, {
        fromUi: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_DATA.widgetId)).toBe(
        JSON.stringify(MOCK_DATA.stringValue)
      )
    })

    it("sets int value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_DATA.widgetId, MOCK_DATA.intValue, {
        fromUi: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_DATA.widgetId)).toBe(
        JSON.stringify(MOCK_DATA.intValue)
      )
    })

    it("sets float value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_DATA.widgetId, MOCK_DATA.doubleValue, {
        fromUi: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_DATA.widgetId)).toBe(
        JSON.stringify(MOCK_DATA.doubleValue)
      )
    })

    it("sets string array value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_DATA.widgetId, MOCK_DATA.stringArray, {
        fromUi: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_DATA.widgetId)).toBe(
        JSON.stringify(MOCK_DATA.stringArray)
      )
    })

    it("sets int array value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_DATA.widgetId, MOCK_DATA.intArray, {
        fromUi: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_DATA.widgetId)).toBe(
        JSON.stringify(MOCK_DATA.intArray)
      )
    })

    it("sets int array value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_DATA.widgetId, MOCK_DATA.intArray, {
        fromUi: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_DATA.widgetId)).toBe(
        JSON.stringify(MOCK_DATA.intArray)
      )
    })

    it("sets float array value as JSON correctly", () => {
      widgetMgr.setJsonValue(MOCK_DATA.widgetId, MOCK_DATA.doubleArray, {
        fromUi: true,
      })
      expect(widgetMgr.getJsonValue(MOCK_DATA.widgetId)).toBe(
        JSON.stringify(MOCK_DATA.doubleArray)
      )
    })

    it("setIntValue can handle MIN_ and MAX_SAFE_INTEGER", () => {
      widgetMgr.setIntValue(MOCK_DATA.widgetId, Number.MAX_SAFE_INTEGER, {
        fromUi: true,
      })

      expect(widgetMgr.getIntValue(MOCK_DATA.widgetId)).toBe(
        Number.MAX_SAFE_INTEGER
      )

      widgetMgr.setIntValue(MOCK_DATA.widgetId, Number.MIN_SAFE_INTEGER, {
        fromUi: true,
      })

      expect(widgetMgr.getIntValue(MOCK_DATA.widgetId)).toBe(
        Number.MIN_SAFE_INTEGER
      )
    })

    it("setIntArrayValue can handle MIN_ and MAX_SAFE_INTEGER", () => {
      const values = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]
      widgetMgr.setIntArrayValue(MOCK_DATA.widgetId, values, {
        fromUi: true,
      })

      expect(widgetMgr.getIntArrayValue(MOCK_DATA.widgetId)).toStrictEqual(
        values
      )
    })
  })
})
