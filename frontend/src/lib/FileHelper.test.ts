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

import { getSizeDisplay, sizeConverter, FileSizes } from "./FileHelper"

describe("getSizeDisplay", () => {
  test("shows unit", async () => {
    expect(getSizeDisplay(1024, "b")).toEqual("1.0KB")
    expect(getSizeDisplay(1024 * 1024, "b")).toEqual("1.0MB")
    expect(getSizeDisplay(1024 * 1024 * 1024, "b")).toEqual("1.0GB")

    expect(getSizeDisplay(10, "gb")).toEqual("10.0GB")
    expect(getSizeDisplay(1024, "mb")).toEqual("1.0GB")
  })

  test("unusual values", async () => {
    expect(() => getSizeDisplay(-100, "b")).toThrow(
      "Size must be greater than or equal to 0"
    )
    expect(getSizeDisplay(0, "")).toEqual("0.0B")
    expect(getSizeDisplay(0, "b", -1)).toEqual("0B")
  })

  test("rounding truncation", async () => {
    expect(getSizeDisplay(1024, "b")).toEqual("1.0KB")
    expect(getSizeDisplay(1024, "b", 0)).toEqual("1KB")
    expect(getSizeDisplay(1024, "b", 3)).toEqual("1.000KB")
  })

  test("rounding up unit", async () => {
    expect(getSizeDisplay(500, "b")).toEqual("500.0B")
    expect(getSizeDisplay(800, "b")).toEqual("0.8KB")
    expect(getSizeDisplay(501, "gb")).toEqual("501.0GB")
  })
})

describe("sizeConverter", () => {
  test("Converts up", async () => {
    expect(sizeConverter(0.5, FileSizes.KiloByte, FileSizes.MegaByte)).toEqual(
      0.5 / 1024
    )
    expect(sizeConverter(1024, FileSizes.Byte, FileSizes.KiloByte)).toEqual(1)
    expect(
      sizeConverter(1024 ** 2, FileSizes.KiloByte, FileSizes.GigaByte)
    ).toEqual(1)
    expect(sizeConverter(1, FileSizes.MegaByte, FileSizes.GigaByte)).toEqual(
      1 / 1024
    )
  })

  test("Converts down", async () => {
    expect(sizeConverter(0.5, FileSizes.GigaByte, FileSizes.MegaByte)).toEqual(
      512
    )
    expect(
      sizeConverter(1024, FileSizes.GigaByte, FileSizes.KiloByte)
    ).toEqual(1024 ** 3)
    expect(
      sizeConverter(1024 ** 2, FileSizes.MegaByte, FileSizes.KiloByte)
    ).toEqual(1024 ** 3)
    expect(sizeConverter(1, FileSizes.KiloByte, FileSizes.Byte)).toEqual(1024)
  })

  test("unusual cases", async () => {
    expect(sizeConverter(1024, FileSizes.Byte, FileSizes.Byte)).toEqual(1024)
    expect(() =>
      sizeConverter(-1, FileSizes.GigaByte, FileSizes.GigaByte)
    ).toThrowError()
  })
})
