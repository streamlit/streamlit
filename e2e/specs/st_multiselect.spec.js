
/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

function selectForKthMultiselect(optionText, k, closeAfterSelecting) {
  cy.getIndexed(".stMultiSelect", k)
    .find("input")
    .click();
  cy
    .get("li")
    .contains(optionText)
    .click();
  if (closeAfterSelecting) {
    cy.getIndexed(".stMultiSelect", k)
      .find("input")
      .click();
  }
}

function delFromKthMultiselect(optionText, k) {
  cy.getIndexed('.stMultiSelect', k)
    .get('span[data-baseweb="tag"] span')
    .contains(optionText)
    // the actual x
    .get('span[role="presentation"]')
    .first()
    .click();
}

describe("st.multiselect", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  describe("when first loaded", () => {
    it("should show widget correctly", () => {
      cy.get(".stMultiSelect").should("have.length", 12);

      cy.get(".stMultiSelect").each((el, idx) => {
        return cy.wrap(el).matchThemedSnapshots("multiselect" + idx);
      });
    });

    it("should show the correct text", () => {
      cy.get("[data-testid='stText']")
        .should(
          "have.text",
          "value 1: []" +
            "value 2: []" +
            "value 3: []" +
            "value 4: ['tea', 'water']" +
            "value 5: []" +
            "value 6: []" +
            "value 7: []" +
            "value 8: []" +
            "value 9: []" +
            "value 10: []" +
            "value 11: []" +
            "multiselect changed: False"
        );
    });

    describe("when there are valid options", () => {
      it("should show the correct placeholder", () => {
        cy.get(".stMultiSelect")
          .first()
          .should("have.text", "multiselect 1Choose an optionopen");
      });
    });

    describe("when there are no valid options", () => {
      it("should show the correct placeholder", () => {
        cy.getIndexed(".stMultiSelect", 2).should(
          "have.text",
          "multiselect 3No options to select.open"
        );
      });
    });

  describe("when clicking on the input", () => {
    it("should show values correctly in the dropdown menu", () => {
      cy.getIndexed(".stMultiSelect", 0)
        .find("input")
        .click()
        .get("li")
        .should("have.length", 2)
        .should("have.text", "malefemale")
        .each((el, idx) => {
          return cy
            .wrap(el)
            .matchImageSnapshot("multiselect-dropdown-" + idx);
        });
      });
    });

    it("should show long values correctly (with ellipses) in the dropdown menu", () => {
      cy.getIndexed(".stMultiSelect", 4)
        .find("input")
        .click()
        .get("li")
        .should("have.length", 5)
        .each((el, idx) => {
          return cy
            .wrap(el)
            .matchImageSnapshot("multiselect-dropdown-long-label-" + idx);
      });
    });

  describe("when the user makes a selection", () => {
    beforeEach(() => selectForKthMultiselect("Female", 1, true));

    it("sets the value correctly", () => {
      cy.getIndexed(".stMultiSelect span", 1).should("have.text", "Female");

      // Wait for 'data-stale' attr to go away, so the snapshot looks right.
      cy.getIndexed(".stMultiSelect", 1)
        .parent()
        .should("have.attr", "data-stale", "false")
        .invoke("css", "opacity", "1");

      cy.getIndexed(
        ".stMultiSelect",
        1
      ).matchThemedSnapshots("multiselect-selection", { focus: "input" });
    });

    it("outputs the correct value", () => {
      cy.get("[data-testid='stText']")
        .should(
          "contain.text",
            "value 2: ['female']"
        );
    });

    describe("when the user picks a second option", () => {
      beforeEach(() => selectForKthMultiselect("Male", 1, true));

      it("outputs the correct value", () => {
        cy.get("[data-testid='stText']")
          .should(
            "contain.text",
              "value 2: ['female', 'male']"
          );
      });

      describe("when the user deselects the first option", () => {
        beforeEach(() => {
          delFromKthMultiselect("Female", 1)
        });

        it("outputs the correct value", () => {
          cy.get("[data-testid='stText']")
            .should(
              "contain.text",
                "value 2: ['male']"
            );
        });
      });

      describe("when the user click the clear button", () => {
        beforeEach(() => {
          cy.getIndexed('.stMultiSelect [role="button"][aria-label="Clear all"]', 0)
            .click();
        });

        it("outputs the correct value", () => {
          cy.get("[data-testid='stText']")
            .should(
              "have.text",
              "value 1: []" +
                "value 2: []" +
                "value 3: []" +
                "value 4: ['tea', 'water']" +
                "value 5: []" +
                "value 6: []" +
                "value 7: []" +
                "value 8: []" +
                "value 9: []" +
                "value 10: []" +
                "value 11: []" +
                "multiselect changed: False"
            );
        });
      });
    });

    it("calls callback if one is registered", () => {
      cy.getIndexed(".stMultiSelect", 10)
        .find("input")
        .click();
      cy.getIndexed("li", 0)
        .click();
      cy.get("[data-testid='stText']")
        .should(
          "contain.text",
            "value 11: ['male']" +
            "multiselect changed: True"
        );
    });
  });

  describe("when using max_selections for st.multiselect", () => {
    describe("test out of a form", () => {
      afterEach(() => {
        delFromKthMultiselect("male", 8)
      });

      it("should show the correct text when maxSelections is reached and closing after selecting", () => {
        selectForKthMultiselect("male", 8, true)
          cy.getIndexed(".stMultiSelect", 8)
            .find("input")
            .click()
            .get("li")
            .should("have.text", "You can only select up to 1 option. Remove an option first.")
        });

      it("should show the correct text when maxSelections is reached and not closing after selecting", () => {
        selectForKthMultiselect("male", 8, false)
        cy.getIndexed(".stMultiSelect", 8)
          .getIndexed("li", 0)
          .should("have.text", "You can only select up to 1 option. Remove an option first.")
      });
    });

    describe("test in a form", () => {
      afterEach(() => {
        delFromKthMultiselect("male", 9)
      });

      it("should show the correct text when maxSelections is reached when closing after selecting", () => {
        selectForKthMultiselect("male", 9, true)
        cy.getIndexed(".stMultiSelect", 9)
          .find("input")
          .click()
          .get("li")
          .should("have.text", "You can only select up to 1 option. Remove an option first.")
      });

      it("should show the correct text when maxSelections is reached without closing after selecting", () => {
        selectForKthMultiselect("male", 9, false)
        cy.getIndexed(".stMultiSelect", 9)
          .getIndexed("li", 0)
          .should("have.text", "You can only select up to 1 option. Remove an option first.")
      });
    })

    it("should display an error when options > max selections set during session state", () => {
      cy.get(".stCheckbox")
        .first()
        // For whatever reason both click() and click({ force: true }) don't want
        // to work here, so we use {multiple: true}
        .click({ multiple: true });

      cy.get(".element-container .stException").should(
        "contain.text",
        `Multiselect has 2 options selected but max_selections\nis set to 1.`
      );
    });

    })
  });
});
