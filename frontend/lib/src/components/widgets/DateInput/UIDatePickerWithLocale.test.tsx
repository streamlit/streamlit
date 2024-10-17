/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React from "react"

import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { UIDatePickerWithLocale } from "@streamlit/lib/src/components/widgets/DateInput/UIDatePickerWithLocale"
import { render } from "@streamlit/lib/src/components/shared/ElementFullscreen/testUtils"

describe("UIDatePickerWithLocale", () => {
  const value = new Date("2024-07-10")

  describe("with an LTR locale", () => {
    const locale = "de"

    it("renders expected localized dates", async () => {
      const user = userEvent.setup()
      render(
        <UIDatePickerWithLocale value={value} />,
        {},
        { baseWebTheme: "light", libContextProps: { locale } }
      )

      await user.click(await screen.findByLabelText("Select a date."))

      expect(await screen.findByLabelText("Previous month.")).toBeVisible()
      expect(
        await screen.findByRole("button", {
          // Note here that `Juli` is the German word for July
          name: "Juli",
        })
      ).toBeVisible()
    })
  })

  describe("with an RTL locale", () => {
    const locale = "ar"

    it("renders expected localized dates", async () => {
      const user = userEvent.setup()
      render(
        <UIDatePickerWithLocale value={value} />,
        {},
        { baseWebTheme: "light", libContextProps: { locale } }
      )

      await user.click(await screen.findByLabelText("Select a date."))

      expect(await screen.findByLabelText("Previous month.")).toBeVisible()
      expect(
        await screen.findByRole("button", {
          // Note here that `يوليو` is the Arabic word for July
          name: "يوليو",
        })
      ).toBeVisible()
    })
  })

  describe("with an invalid locale", () => {
    const locale = "does-not-exist"

    it("falls back to en locale", async () => {
      const user = userEvent.setup()
      render(
        <UIDatePickerWithLocale value={value} />,
        {},
        { baseWebTheme: "light", libContextProps: { locale } }
      )

      await user.click(await screen.findByLabelText("Select a date."))

      expect(await screen.findByLabelText("Previous month.")).toBeVisible()
      expect(await screen.findByRole("button", { name: "July" })).toBeVisible()
    })
  })
})
