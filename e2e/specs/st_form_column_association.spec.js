const buttonSelector = ".stButton button";
const markdownSelector = "[data-testid='stMarkdownContainer'] p code";

// form id -> whether a checkbox is inside a form.
const checkboxInsideForm = {
  form_0: true,
  form_1: false,
  form_2: false,
  form_3: true,
  form_4: true,
  form_5: false,
  form_6: true,
  form_7: true,
  form_8: true,
  form_9: true
};

describe("Form/column association", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  Object.entries(checkboxInsideForm).forEach(
    ([formId, isCheckboxInsideForm], index) => {
      const message = isCheckboxInsideForm
        ? `checks that a checkbox is inside ${formId}`
        : `checks that a checkbox is outside ${formId}`;

      it(message, () => {
        isCheckboxInsideForm
          ? testCheckboxInsideForm(index)
          : testCheckboxOutsideForm(index);
      });
    }
  );
});

function changeCheckboxValue(index) {
  cy.getIndexed(".stCheckbox", index).click();
}

function testCheckboxInsideForm(index) {
  // Check that the form has no pending changes.
  cy.getIndexed(buttonSelector, index).should(
    "have.attr",
    "kind",
    "formSubmit"
  );
  cy.getIndexed(markdownSelector, index).should("have.text", "False");

  // Toggle checkbox.
  changeCheckboxValue(index);

  // Check that the checkbox value hasn't been changed,
  // and that there the form has pending changes now.
  cy.getIndexed(buttonSelector, index).should(
    "have.attr",
    "kind",
    "formSubmit"
  );
  cy.getIndexed(markdownSelector, index).should("have.text", "False");

  // Submit the form.
  cy.getIndexed(buttonSelector, index).click();

  // Check that the checkbox value has been updated.
  cy.getIndexed(markdownSelector, index).should("have.text", "True");
}

function testCheckboxOutsideForm(index) {
  // Check that the form has no pending changes.
  cy.getIndexed(buttonSelector, index).should(
    "have.attr",
    "kind",
    "formSubmit"
  );
  cy.getIndexed(markdownSelector, index).should("have.text", "False");

  // Toggle checkbox.
  changeCheckboxValue(index);

  // Check the checkbox value has been updated without a form submission.
  cy.getIndexed(buttonSelector, index).should(
    "have.attr",
    "kind",
    "formSubmit"
  );
  cy.getIndexed(markdownSelector, index).should("have.text", "True");
}
