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

import { createFormsData, FormsData, FormsManager } from "./FormsManager"

describe("FormsManager", () => {
  let formsData: FormsData
  let formsMgr: FormsManager
  let onFormsDataChanged: jest.Mock

  beforeEach(() => {
    onFormsDataChanged = jest.fn(newData => {
      formsData = newData
    })

    formsData = createFormsData()
    formsMgr = new FormsManager(formsData, onFormsDataChanged)
  })

  it("updates pendingForms", () => {
    formsMgr.setPendingForms(new Set(["one", "two"]))
    expect(onFormsDataChanged).toHaveBeenCalledTimes(1)
    expect(formsData.formsWithPendingChanges.has("one")).toBe(true)
    expect(formsData.formsWithPendingChanges.has("two")).toBe(true)
    expect(formsData.formsWithPendingChanges.has("three")).toBe(false)
    expect(formsData.formsWithPendingChanges.has("four")).toBe(false)
  })

  it("updates formsWithUploads", () => {
    formsMgr.setFormsWithUploads(new Set(["three", "four"]))
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
    formsMgr.setPendingForms(new Set(["one", "two"]))
    expect(Object.isFrozen(formsData.formsWithPendingChanges)).toBe(true)
  })
})
