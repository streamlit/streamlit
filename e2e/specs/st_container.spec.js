describe("st.container", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("permits multiple out-of-order elements", () => {
    cy.getIndexed(".stMarkdown p", 0).contains("Line 2");
    cy.getIndexed(".stMarkdown p", 1).contains("Line 3");
    cy.getIndexed(".stMarkdown p", 2).contains("Line 1");
    cy.getIndexed(".stMarkdown p", 3).contains("Line 4");
  });

  it("persists widget state across reruns", () => {
    cy.get(".stCheckbox").click({ multiple: true });
    cy.get("h1").contains("Checked!");

    cy.get(".stButton button").click();
    cy.get("h2").contains("Pressed!");
    cy.get(".stCheckbox input").should("have.attr", "aria-checked", "true");
  });
});
