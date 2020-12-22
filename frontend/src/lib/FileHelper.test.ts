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
  getSizeDisplay,
  sizeConverter,
  FileSize,
  BYTE_CONVERSION_SIZE,
} from "./FileHelper"

describe("getSizeDisplay", () => {
  test("it shows unit", async () => {
    expect(getSizeDisplay(BYTE_CONVERSION_SIZE, FileSize.Byte)).toEqual(
      "1.0KB"
    )
    expect(getSizeDisplay(BYTE_CONVERSION_SIZE ** 2, FileSize.Byte)).toEqual(
      "1.0MB"
    )
    expect(getSizeDisplay(BYTE_CONVERSION_SIZE ** 3, FileSize.Byte)).toEqual(
      "1.0GB"
    )

    expect(getSizeDisplay(10, FileSize.GigaByte)).toEqual("10.0GB")
    expect(getSizeDisplay(BYTE_CONVERSION_SIZE, FileSize.MegaByte)).toEqual(
      "1.0GB"
    )
  })

  test("it has unusual values", async () => {
    expect(() => getSizeDisplay(-100, FileSize.Byte)).toThrow(
      "Size must be greater than or equal to 0"
    )
    expect(getSizeDisplay(0, FileSize.Byte, -1)).toEqual("0B")
  })

  test("it truncates to the right amount of decimals", async () => {
    expect(getSizeDisplay(BYTE_CONVERSION_SIZE, FileSize.Byte)).toEqual(
      "1.0KB"
    )
    expect(getSizeDisplay(BYTE_CONVERSION_SIZE, FileSize.Byte, 0)).toEqual(
      "1KB"
    )
    expect(getSizeDisplay(BYTE_CONVERSION_SIZE, FileSize.Byte, 3)).toEqual(
      "1.000KB"
    )
  })

  test("it rounds up to the next unit", async () => {
    expect(getSizeDisplay(500, FileSize.Byte)).toEqual("500.0B")
    expect(getSizeDisplay(800, FileSize.Byte)).toEqual("0.8KB")
    expect(getSizeDisplay(501, FileSize.GigaByte)).toEqual("501.0GB")
  })
})

describe("sizeConverter", () => {
  test("it converts up to the bigger unit", async () => {
    expect(sizeConverter(0.5, FileSize.KiloByte, FileSize.MegaByte)).toEqual(
      0.5 / BYTE_CONVERSION_SIZE
    )
    expect(
      sizeConverter(BYTE_CONVERSION_SIZE, FileSize.Byte, FileSize.KiloByte)
    ).toEqual(1)
    expect(
      sizeConverter(
        BYTE_CONVERSION_SIZE ** 2,
        FileSize.KiloByte,
        FileSize.GigaByte
      )
    ).toEqual(1)
    expect(sizeConverter(1, FileSize.MegaByte, FileSize.GigaByte)).toEqual(
      1 / BYTE_CONVERSION_SIZE
    )
  })

  test("it converts down to the smaller unit", async () => {
    expect(sizeConverter(0.5, FileSize.GigaByte, FileSize.MegaByte)).toEqual(
      BYTE_CONVERSION_SIZE * 0.5
    )
    expect(
      sizeConverter(BYTE_CONVERSION_SIZE, FileSize.GigaByte, FileSize.KiloByte)
    ).toEqual(BYTE_CONVERSION_SIZE ** 3)
    expect(
      sizeConverter(
        BYTE_CONVERSION_SIZE ** 2,
        FileSize.MegaByte,
        FileSize.KiloByte
      )
    ).toEqual(BYTE_CONVERSION_SIZE ** 3)
    expect(sizeConverter(1, FileSize.KiloByte, FileSize.Byte)).toEqual(
      BYTE_CONVERSION_SIZE
    )
  })

  test("it handles unusual cases", async () => {
    expect(
      sizeConverter(BYTE_CONVERSION_SIZE, FileSize.Byte, FileSize.Byte)
    ).toEqual(BYTE_CONVERSION_SIZE)
    expect(() =>
      sizeConverter(-1, FileSize.GigaByte, FileSize.GigaByte)
    ).toThrowError()
  })
})
