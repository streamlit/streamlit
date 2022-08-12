describe("st.set_page_config", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("sets the page favicon with ico file", () => {
    cy.get("link[rel='shortcut icon']")
      .should("have.attr", "href")
      .should(
        "contain",
        "d1e92a291d26c1e0cb9b316a93c929b3be15899677ef3bc6e3bf3573.png"
      );
  });
});
