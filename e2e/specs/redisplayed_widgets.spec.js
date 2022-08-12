describe("redisplayed widgets", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("does not save widget state when widget is removed and redisplayed", () => {
    cy.getIndexed(".stCheckbox", 0).click();

    cy.wait(1000);

    cy.getIndexed(".stCheckbox", 1).click();

    cy.wait(1000);

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "hello");

    cy.getIndexed(".stCheckbox", 0).click();

    cy.wait(1000);

    cy.getIndexed(".stCheckbox", 0).click();

    cy.contains("hello").should("not.exist");
  });

  it("does not save state when widget is removed and redisplayed if widget is keyed", () => {
    cy.getIndexed(".stCheckbox", 0).click();

    cy.wait(1000);

    cy.getIndexed(".stCheckbox", 2).click();

    cy.wait(1000);

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "goodbye");

    cy.getIndexed(".stCheckbox", 0).click();

    cy.wait(1000);

    cy.getIndexed(".stCheckbox", 0).click();

    cy.contains("goodbye").should("not.exist");
  });
});
