// Regression test for issue #4836
describe("widget state under heavy load", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("doesn't loose state", () => {
    // Rapidly click many (40) times
    cy.get(".stNumberInput button.step-down")
      .first()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click()
      .click();

    // Has not lost any clicks due to state resetting
    cy.get(".stMarkdown").should("have.text", "60");
  });
});
