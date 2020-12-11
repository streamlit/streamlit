import { CancelTokenSource } from "axios"
import { isFromWindows } from "lib/utils"

export interface ExtendedFile extends File {
  id?: string
  status?: string
  errorMessage?: string
  cancelToken?: CancelTokenSource
  progress?: number
}

export enum FileStatuses {
  ERROR = "ERROR",
  DELETING = "DELETING",
  READY = "READY",
  UPLOADING = "UPLOADING",
  UPLOADED = "UPLOADED",
}

export enum FileSizes {
  GigaByte = "gb",
  KiloByte = "kb",
  MegaByte = "mb",
  Byte = "b",
}

// There is a shift towards displaying storage in base 10 vs base 2
// but Windows is still displaying things in base 2. This does not handle
// all cases but for simplicity general rule is to use base 2 for Windows.
export const BYTE_CONVERSION_SIZE = isFromWindows() ? 1024 : 1000
const sizeUnitSequence = [
  FileSizes.GigaByte,
  FileSizes.MegaByte,
  FileSizes.KiloByte,
  FileSizes.Byte,
]

export const getSizeDisplay = (
  size: number,
  unit: FileSizes,
  rounding = 1
): string => {
  if (!unit) {
    unit = FileSizes.Byte
  }

  if (rounding < 0) {
    rounding = 0
  }

  if (size < 0) {
    throw new Error("Size must be greater than or equal to 0")
  }

  const sizeIndex = sizeUnitSequence.indexOf(unit)
  const nextUnitSize = size / BYTE_CONVERSION_SIZE
  if (sizeIndex && size > BYTE_CONVERSION_SIZE / 2) {
    return getSizeDisplay(
      nextUnitSize,
      sizeUnitSequence[sizeIndex - 1],
      rounding
    )
  }
  return `${size.toFixed(rounding)}${unit.toUpperCase()}`
}

export const sizeConverter = (
  size: number,
  inputUnit: FileSizes,
  outputUnit: FileSizes
): number => {
  if (size < 0) {
    throw Error("Size must be 0 or greater")
  }

  const inputLevel = sizeUnitSequence.findIndex(unit => unit === inputUnit)
  const outputLevel = sizeUnitSequence.findIndex(unit => unit === outputUnit)

  if (inputLevel === -1 || outputLevel === -1) {
    // Should not ever occur
    throw Error("Unexpected byte unit provided")
  }

  if (inputLevel === outputLevel) {
    return size
  }

  const levelsBetween = Math.abs(inputLevel - outputLevel)
  const byteDifference = BYTE_CONVERSION_SIZE ** levelsBetween

  if (inputLevel > outputLevel) {
    // Going from smaller to bigger
    return size / byteDifference
  }
  // Going from bigger to smaller
  return size * byteDifference
}
