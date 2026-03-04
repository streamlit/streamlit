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

import {
  BYTE_CONVERSION_SIZE,
  FileSize,
  formatTypeForDisplay,
  getSizeDisplay,
  isFileTypeAllowed,
  isMimeType,
  sizeConverter,
} from "./FileHelper"

describe("getSizeDisplay", () => {
  it("shows unit", () => {
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

  it("has unusual values", () => {
    expect(() => getSizeDisplay(-100, FileSize.Byte)).toThrow(
      "Size must be greater than or equal to 0"
    )
    expect(getSizeDisplay(0, FileSize.Byte, -1)).toEqual("0B")
  })

  it("truncates to the right amount of decimals", () => {
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

  it("rounds up to the next unit", () => {
    expect(getSizeDisplay(500, FileSize.Byte)).toEqual("500.0B")
    expect(getSizeDisplay(800, FileSize.Byte)).toEqual("0.8KB")
    expect(getSizeDisplay(501, FileSize.Gigabyte)).toEqual("501.0GB")
  })
})

describe("sizeConverter", () => {
  it("converts up to the bigger unit", () => {
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

  it("converts down to the smaller unit", () => {
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

  it("handles unusual cases", () => {
    expect(
      sizeConverter(BYTE_CONVERSION_SIZE, FileSize.Byte, FileSize.Byte)
    ).toEqual(BYTE_CONVERSION_SIZE)
    expect(() =>
      sizeConverter(-1, FileSize.Gigabyte, FileSize.Gigabyte)
    ).toThrow("Size must be 0 or greater")
  })
})

describe("formatTypeForDisplay", () => {
  it("formats MIME wildcards by removing /*", () => {
    expect(formatTypeForDisplay("image/*")).toEqual("image")
    expect(formatTypeForDisplay("audio/*")).toEqual("audio")
    expect(formatTypeForDisplay("video/*")).toEqual("video")
    expect(formatTypeForDisplay("text/*")).toEqual("text")
  })

  it("keeps full MIME types as is", () => {
    expect(formatTypeForDisplay("image/jpeg")).toEqual("image/jpeg")
    expect(formatTypeForDisplay("application/pdf")).toEqual("application/pdf")
    expect(formatTypeForDisplay("text/plain")).toEqual("text/plain")
  })

  it("formats extensions by removing dot and uppercasing", () => {
    expect(formatTypeForDisplay(".jpg")).toEqual("JPG")
    expect(formatTypeForDisplay(".pdf")).toEqual("PDF")
    expect(formatTypeForDisplay(".tar.gz")).toEqual("TAR.GZ")
    expect(formatTypeForDisplay("png")).toEqual("PNG")
  })
})

describe("isMimeType", () => {
  it("returns true for MIME types with slash", () => {
    expect(isMimeType("image/jpeg")).toBe(true)
    expect(isMimeType("image/*")).toBe(true)
    expect(isMimeType("application/pdf")).toBe(true)
    expect(isMimeType("audio/mpeg")).toBe(true)
  })

  it("returns false for extensions", () => {
    expect(isMimeType(".jpg")).toBe(false)
    expect(isMimeType("pdf")).toBe(false)
    expect(isMimeType(".tar.gz")).toBe(false)
  })
})

describe("isFileTypeAllowed", () => {
  const createFile = (name: string, type = ""): File => {
    const file = new File([""], name, { type })
    return file
  }

  it("allows all files when no types specified", () => {
    const file = createFile("test.xyz", "application/octet-stream")
    expect(isFileTypeAllowed(file, [])).toBe(true)
    expect(isFileTypeAllowed(file, undefined)).toBe(true)
  })

  describe("MIME type matching", () => {
    it("matches exact MIME types", () => {
      const jpegFile = createFile("photo.jpg", "image/jpeg")
      expect(isFileTypeAllowed(jpegFile, ["image/jpeg"])).toBe(true)
      expect(isFileTypeAllowed(jpegFile, ["image/png"])).toBe(false)
    })

    it("matches MIME wildcards", () => {
      const jpegFile = createFile("photo.jpg", "image/jpeg")
      const pngFile = createFile("photo.png", "image/png")
      const audioFile = createFile("song.mp3", "audio/mpeg")

      expect(isFileTypeAllowed(jpegFile, ["image/*"])).toBe(true)
      expect(isFileTypeAllowed(pngFile, ["image/*"])).toBe(true)
      expect(isFileTypeAllowed(audioFile, ["image/*"])).toBe(false)
      expect(isFileTypeAllowed(audioFile, ["audio/*"])).toBe(true)
    })

    it("is case insensitive for MIME types", () => {
      const file = createFile("photo.jpg", "IMAGE/JPEG")
      expect(isFileTypeAllowed(file, ["image/jpeg"])).toBe(true)
      expect(isFileTypeAllowed(file, ["IMAGE/*"])).toBe(true)
    })
  })

  describe("extension matching", () => {
    it("matches extensions with dot", () => {
      const file = createFile("document.pdf")
      expect(isFileTypeAllowed(file, [".pdf"])).toBe(true)
      expect(isFileTypeAllowed(file, [".txt"])).toBe(false)
    })

    it("matches extensions without dot", () => {
      const file = createFile("document.pdf")
      expect(isFileTypeAllowed(file, ["pdf"])).toBe(true)
      expect(isFileTypeAllowed(file, ["txt"])).toBe(false)
    })

    it("is case insensitive for extensions", () => {
      const file = createFile("document.PDF")
      expect(isFileTypeAllowed(file, [".pdf"])).toBe(true)
      expect(isFileTypeAllowed(file, ["PDF"])).toBe(true)
    })

    it("matches multi-part extensions like .tar.gz", () => {
      const tarGzFile = createFile("archive.tar.gz")
      expect(isFileTypeAllowed(tarGzFile, [".tar.gz"])).toBe(true)
      expect(isFileTypeAllowed(tarGzFile, ["tar.gz"])).toBe(true)
      expect(isFileTypeAllowed(tarGzFile, [".gz"])).toBe(true)
      expect(isFileTypeAllowed(tarGzFile, [".tar"])).toBe(false)
      expect(isFileTypeAllowed(tarGzFile, [".zip"])).toBe(false)
    })

    it("matches csv.gz and similar compound extensions", () => {
      const csvGzFile = createFile("data.csv.gz")
      expect(isFileTypeAllowed(csvGzFile, [".csv.gz"])).toBe(true)
      expect(isFileTypeAllowed(csvGzFile, ["csv.gz"])).toBe(true)
      expect(isFileTypeAllowed(csvGzFile, [".gz"])).toBe(true)
    })
  })

  describe("mixed types (MIME + extensions)", () => {
    it("allows file matching MIME pattern even if extension doesn't match", () => {
      // This is the key bug fix test case
      const jpegFile = createFile("photo.jpg", "image/jpeg")
      expect(isFileTypeAllowed(jpegFile, ["image/*", ".json"])).toBe(true)
    })

    it("allows file matching extension when MIME doesn't match", () => {
      const jsonFile = createFile("data.json", "application/json")
      expect(isFileTypeAllowed(jsonFile, ["image/*", ".json"])).toBe(true)
    })

    it("allows file matching either MIME or extension", () => {
      const pngFile = createFile("image.png", "image/png")
      expect(isFileTypeAllowed(pngFile, ["image/*", ".json"])).toBe(true)

      const jsonFile = createFile("data.json", "application/json")
      expect(isFileTypeAllowed(jsonFile, ["image/*", ".json"])).toBe(true)
    })

    it("rejects file matching neither MIME nor extension", () => {
      // File with audio MIME type and .gif extension
      const file = createFile("audio.gif", "audio/mpeg")
      expect(isFileTypeAllowed(file, ["image/*", ".json"])).toBe(false)
    })
  })

  describe("directory upload scenarios", () => {
    it("allows image files with image/* type", () => {
      // Simulates directory upload filtering
      const files = [
        createFile("photo1.jpg", "image/jpeg"),
        createFile("photo2.png", "image/png"),
        createFile("readme.txt", "text/plain"),
      ]

      const imageTypes = ["image/*"]
      const allowed = files.filter(f => isFileTypeAllowed(f, imageTypes))

      expect(allowed).toHaveLength(2)
      expect(allowed.map(f => f.name)).toEqual(["photo1.jpg", "photo2.png"])
    })

    it("allows files with shortcut types (via normalized MIME)", () => {
      // When user specifies type="image", backend normalizes to "image/*"
      const normalizedTypes = ["image/*"]
      const jpegFile = createFile("photo.jpg", "image/jpeg")
      expect(isFileTypeAllowed(jpegFile, normalizedTypes)).toBe(true)
    })
  })
})
