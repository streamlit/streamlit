describe("info/success/warning/error boxes", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("show complex markdown beautifully", () => {
    cy.get(".stAlert")
      .should("have.length", 4)
      .each((el, i) => {
        return cy.get(el).matchThemedSnapshots(`stAlert-alert-${i}`);
      });
  });
});
