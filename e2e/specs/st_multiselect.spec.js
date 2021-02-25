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

describe("st.multiselect", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  describe("when first loaded", () => {
    it("should show widget correctly", () => {
      cy.get(".stMultiSelect").should("have.length", 5);

      cy.get(".stMultiSelect").each((el, idx) => {
        return cy.wrap(el).matchImageSnapshot("multiselect" + idx);
      });
    });

    it("should show the correct text", () => {
      cy.get("[data-testid='stText']")
        .should("have.length", 5)
        .should(
          "have.text",
          "value 1: []value 2: []value 3: []value 4: ['tea', 'water']value 5: []"
        );
    });

    describe("when there are valid options", () => {
      it("should show the correct placeholder", () => {
        cy.get(".stMultiSelect")
          .first()
          .should("have.text", "selectbox 1Choose an optionopen");
      });
    });
    describe("when there are no valid options", () => {
      it("should show the correct placeholder", () => {
        cy.get(".stMultiSelect")
          .eq(2)
          .should("have.text", "selectbox 3No options to select.open");
      });
    });
  });

  describe("when clicking on the input", () => {
    it("should show values correctly in the dropdown menu", () => {
      cy.get(".stMultiSelect")
        .eq(0)
        .then(el => {
          return cy
            .wrap(el)
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
      cy.get(".stMultiSelect")
        .eq(4)
        .then(el => {
          return cy
            .wrap(el)
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
    });
  });

  function selectOption(idx) {
    cy.get(".stMultiSelect")
      .should("have.length", 5)
      .eq(1)
      .find("input")
      .click();
    cy.get("li")
      .eq(idx)
      .click();
  }

  describe("when the user makes a selection", () => {
    beforeEach(() => selectOption(1));

    it("sets the value correctly", () => {
      cy.get(".stMultiSelect span")
        .eq(1)
        .should("have.text", "Female");

      // Wait for 'data-stale' attr to go away, so the snapshot looks right.
      cy.get(".stMultiSelect")
        .eq(1)
        .parent()
        .should("have.attr", "data-stale", "false")
        .invoke("css", "opacity", "1");

      cy.get(".stMultiSelect")
        .eq(1)
        .then(el => {
          cy.wrap(el).matchImageSnapshot("multiselect-selection");
        });
    });

    it("outputs the correct value", () => {
      cy.get("[data-testid='stText']")
        .should("have.length", 5)
        .should(
          "have.text",
          "value 1: []value 2: ['female']value 3: []value 4: ['tea', 'water']value 5: []"
        );
    });

    describe("when the user picks a second option", () => {
      beforeEach(() => selectOption(0));

      it("outputs the correct value", () => {
        cy.get("[data-testid='stText']")
          .should("have.length", 5)
          .should(
            "have.text",
            "value 1: []value 2: ['female', 'male']value 3: []value 4: ['tea', 'water']value 5: []"
          );
      });

      describe("when the user deselects the first option", () => {
        beforeEach(() => {
          // this is the 'close button' element for 'Male'
          cy.get('.stMultiSelect span[data-baseweb="tag"] span:last-child')
            .eq(0)
            .click();
        });
        it("outputs the correct value", () => {
          cy.get("[data-testid='stText']")
            .should("have.length", 5)
            .should(
              "have.text",
              "value 1: []value 2: ['male']value 3: []value 4: ['tea', 'water']value 5: []"
            );
        });
      });

      describe("when the user click the clear button", () => {
        beforeEach(() => {
          cy.get('.stMultiSelect [role="button"][aria-label="Clear all"]')
            .eq(0)
            .click();
        });
        it("outputs the correct value", () => {
          cy.get("[data-testid='stText']")
            .should("have.length", 5)
            .should(
              "have.text",
              "value 1: []value 2: []value 3: []value 4: ['tea', 'water']value 5: []"
            );
        });
      });
    });
  });
});
