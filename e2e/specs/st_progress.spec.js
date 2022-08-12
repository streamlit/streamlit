describe("st.progress", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays a progress bar", () => {
    cy.get(".stProgress [role='progressbar']").should(
      "have.attr",
      "aria-valuenow",
      "50"
    );

    cy.get(".stProgress [role='progressbar']").matchThemedSnapshots(
      "progressbar"
    );
  });
});
