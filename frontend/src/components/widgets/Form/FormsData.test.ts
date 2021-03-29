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

import { FormsData } from "./FormsData"

const FORMS_DATA = new FormsData()
  .setPendingForms(new Set(["one", "two"]))
  .setFormsWithUploads(new Set(["three", "four"]))

describe("FormsData", () => {
  it("implements hasPendingChanges", () => {
    expect(FORMS_DATA.hasPendingChanges("one")).toBe(true)
    expect(FORMS_DATA.hasPendingChanges("two")).toBe(true)
    expect(FORMS_DATA.hasPendingChanges("three")).toBe(false)
    expect(FORMS_DATA.hasPendingChanges("four")).toBe(false)
  })

  it("implements hasInProgressUpload", () => {
    expect(FORMS_DATA.hasInProgressUpload("one")).toBe(false)
    expect(FORMS_DATA.hasInProgressUpload("two")).toBe(false)
    expect(FORMS_DATA.hasInProgressUpload("three")).toBe(true)
    expect(FORMS_DATA.hasInProgressUpload("four")).toBe(true)
  })

  it("returns new instance from setPendingForms", () => {
    const newData = FORMS_DATA.setPendingForms(new Set(["five", "six"]))
    expect(newData).not.toBe(FORMS_DATA)

    expect(FORMS_DATA.hasPendingChanges("five")).toBe(false)
    expect(FORMS_DATA.hasPendingChanges("six")).toBe(false)
    expect(newData.hasPendingChanges("five")).toBe(true)
    expect(newData.hasPendingChanges("six")).toBe(true)
  })

  it("returns new instance from setFormsWithUploads", () => {
    const newData = FORMS_DATA.setFormsWithUploads(new Set(["five", "six"]))
    expect(newData).not.toBe(FORMS_DATA)

    expect(FORMS_DATA.hasInProgressUpload("five")).toBe(false)
    expect(FORMS_DATA.hasInProgressUpload("six")).toBe(false)
    expect(newData.hasInProgressUpload("five")).toBe(true)
    expect(newData.hasInProgressUpload("six")).toBe(true)
  })
})
