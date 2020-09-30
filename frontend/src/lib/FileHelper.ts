import { CancelTokenSource } from "axios"

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

const sizeUnitSequence = ["gb", "mb", "kb", "b"]
const BYTE_CONVERSION_SIZE = 1024

function mkenum<T extends { [index: string]: U }, U extends string>(x: T) {
  return x
}
export const FileSizes = mkenum({
  GigaByte: "gb",
  KiloByte: "kb",
  MegaByte: "mb",
  Byte: "b",
})
type FileSizes = typeof FileSizes[keyof typeof FileSizes]

export const getSizeDisplay = (
  size: number,
  unit: string,
  rounding = 1
): string => {
  if (!unit) unit = "b"

  if (rounding < 0) rounding = 0

  if (size < 0) throw new Error("Size must be greater than or equal to 0")

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
  const inputLevel = sizeUnitSequence.findIndex(unit => unit === inputUnit)
  const outputLevel = sizeUnitSequence.findIndex(unit => unit === outputUnit)

  if (inputLevel === -1 || outputLevel === -1)
    throw "Unexpected byte unit provided"

  const levelsBetween = Math.abs(inputLevel - outputLevel)
  const byteDifference = Math.pow(BYTE_CONVERSION_SIZE, levelsBetween)

  if (inputLevel > outputLevel) {
    // Going from smaller to bigger
    return size / byteDifference
  } else {
    // Going from bigger to smaller
    return size * byteDifference
  }
}
