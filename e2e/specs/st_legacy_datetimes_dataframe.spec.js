describe("st._legacy_dataframe", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
    cy.get(".element-container .stDataFrame")
      .find(".ReactVirtualized__Grid__innerScrollContainer")
      .find("[data-testid='StyledDataFrameDataCell']")
      .as("cells");
  });

  it("displays datetimes correctly", () => {
    const datetimeString = "2020-04-14T00:00:00";

    // Assert that notz and yaytz render as desired.
    //
    // We can't just assert "have.text" against a hardcoded string, because the
    // timezone we want displayed depends on whatever timezone the test is
    // being run in.  So we use moment to dynamically generate the correct
    // string.
    //
    // This feels a little like "tautologically copying the code we're trying
    // to test into the test itself," but we're still contingently testing the
    // actual important thing, the notz/yaytz logic.

    // notz column should show datetime in current timezone
    cy.getIndexed("@cells", 1).should(
      "have.text",
      Cypress.moment(datetimeString).format()
    );

    // yaytz column should show datetime in provided timezone
    cy.getIndexed("@cells", 2).should(
      "have.text",
      Cypress.moment.parseZone(`${datetimeString}+03:00`).format()
    );
  });
});
