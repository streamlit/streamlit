describe("components.html", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("sets `srcDoc` correctly", () => {
    cy.get("iframe").should(
      "have.attr",
      "srcDoc",
      "<h1>Hello, Streamlit!</h1>"
    );
  });

  it("sets `width` correctly", () => {
    cy.get("iframe").should("have.attr", "width", "200");
  });

  it("sets `height` correctly", () => {
    cy.get("iframe").should("have.attr", "height", "500");
  });

  it("disables scrolling", () => {
    cy.get("iframe").should("have.attr", "scrolling", "no");
  });
});
