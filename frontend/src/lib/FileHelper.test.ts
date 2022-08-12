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

    expect(getSizeDisplay(10, FileSize.Gigabyte)).toEqual("10.0GB")
    expect(getSizeDisplay(BYTE_CONVERSION_SIZE, FileSize.Megabyte)).toEqual(
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
    expect(getSizeDisplay(501, FileSize.Gigabyte)).toEqual("501.0GB")
  })
})

describe("sizeConverter", () => {
  test("it converts up to the bigger unit", async () => {
    expect(sizeConverter(0.5, FileSize.Kilobyte, FileSize.Megabyte)).toEqual(
      0.5 / BYTE_CONVERSION_SIZE
    )
    expect(
      sizeConverter(BYTE_CONVERSION_SIZE, FileSize.Byte, FileSize.Kilobyte)
    ).toEqual(1)
    expect(
      sizeConverter(
        BYTE_CONVERSION_SIZE ** 2,
        FileSize.Kilobyte,
        FileSize.Gigabyte
      )
    ).toEqual(1)
    expect(sizeConverter(1, FileSize.Megabyte, FileSize.Gigabyte)).toEqual(
      1 / BYTE_CONVERSION_SIZE
    )
  })

  test("it converts down to the smaller unit", async () => {
    expect(sizeConverter(0.5, FileSize.Gigabyte, FileSize.Megabyte)).toEqual(
      BYTE_CONVERSION_SIZE * 0.5
    )
    expect(
      sizeConverter(BYTE_CONVERSION_SIZE, FileSize.Gigabyte, FileSize.Kilobyte)
    ).toEqual(BYTE_CONVERSION_SIZE ** 3)
    expect(
      sizeConverter(
        BYTE_CONVERSION_SIZE ** 2,
        FileSize.Megabyte,
        FileSize.Kilobyte
      )
    ).toEqual(BYTE_CONVERSION_SIZE ** 3)
    expect(sizeConverter(1, FileSize.Kilobyte, FileSize.Byte)).toEqual(
      BYTE_CONVERSION_SIZE
    )
  })

  test("it handles unusual cases", async () => {
    expect(
      sizeConverter(BYTE_CONVERSION_SIZE, FileSize.Byte, FileSize.Byte)
    ).toEqual(BYTE_CONVERSION_SIZE)
    expect(() =>
      sizeConverter(-1, FileSize.Gigabyte, FileSize.Gigabyte)
    ).toThrowError()
  })
})
