describe("components.iframe", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("sets src correctly", () => {
    cy.get("iframe").should("have.attr", "src", "http://not.a.real.url");
  });

  it("sets width correctly", () => {
    cy.get("iframe").should("have.attr", "width", "200");
  });

  it("sets height correctly", () => {
    cy.get("iframe").should("have.attr", "height", "500");
  });

  it("sets scrolling correctly", () => {
    cy.get("iframe").should("have.attr", "scrolling", "auto");
  });
});
