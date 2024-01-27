# Playwright e2e Tests

As we transition from Cypress to Playwright for end-to-end (e2e) testing, this guide will help you understand the structure and execution of Playwright tests. All Playwright tests are stored in the `e2e_playwright` directory. Each test includes a corresponding Streamlit app script (for instance, `st_dataframe.py`) and a Playwright Pytest file (like `st_dataframe_test.py`). During the test run, the Pytest file will execute the Streamlit script automatically. All the `_test` files are executed automatically in our CI pipeline on every Pull Request (PR).

## Running test locally

To execute all e2e tests locally, use the following command:

> **Note**:
> If you have implemented changes in the frontend, you might also need to run `make frontend-fast` before running the e2e tests.

```bash
make playwright
```

This command runs all tests in the `e2e_playwright` directory concurrently. Screenshot tests will only operate against your local operating system version, typically found in the `e2e_playwright/__snapshots__/darwin/` folder. This is because our CI pipeline runs on Ubuntu, which may generate slightly different snapshots. To update screenshots locally, simply delete outdated snapshots in `e2e_playwright/__snapshots__/darwin/` and run `make playwright` once. The initial run may fail due to the absence of screenshots.

## Executing a single test locally

Before running a single test, ensure you have executed `make playwright` at least once and installed all necessary test dependencies. Follow the commands below to run an individual test:

```bash
cd e2e_playwright
pytest name_of_the_test.py -s
```

> **Note**:
> If you have implemented changes in the frontend, you might also need to run `make frontend-fast` before running an e2e test. Otherwise, it might use old frontend assets.

## Debugging tests

You can record traces and videos upon failures via:

```bash
cd e2e_playwright
pytest name_of_the_test.py -s --video retain-on-failure --tracing retain-on-failure
```

You can find additional CLI options [here](https://playwright.dev/python/docs/test-runners#cli-arguments). Playwright also offers an [interactive debugging mode](https://playwright.dev/python/docs/debug) which can be triggered by running `PWDEBUG=1`:

```bash
cd e2e_playwright
PWDEBUG=1 pytest name_of_the_test.py -s
```

## Accessing local test results

All screenshots are stored in a test-specific folder under `e2e_playwright/__snapshots__/<os>/`. Any missing screenshots will be generated in this location. For any failed e2e tests, additional resources such as videos, differential screenshots, and traces will be stored in `e2e_playwright/test_results/`. The `snapshot_updates` folder contains all screenshots updated during the test run.

## Accessing GitHub test results

Upon completion of every [Playwright E2E Tests workflow](https://github.com/streamlit/streamlit/actions/workflows/playwright.yml), test results will be uploaded and can be accessed from the Artifacts section of the workflow run summary.

<img src="https://github.com/streamlit/streamlit/assets/2852129/2b53b856-2fce-45d1-9a6d-6996719976ad" width="700"/>

The `playwright_test_results` folder, uploaded only when tests fail, contains data such as videos, differential screenshots as well as all updated screenshots within the `snapshot_updates` folder.

## Updating screenshots

To update screenshots, delete all outdated screenshots locally and push the changes to your PR. After the CI workflow completes, you can obtain all updated screenshots from the uploaded workflow artifacts. If the updated screenshots are as expected, push them back to your branch.

## Utility methods & fixtures

The following **utility methods** are available within `conftest.py`:

| Function | Description |
|----------|-------------|
| `wait_for_app_run(app: Page)` | Wait for an app run to finish. |
| `wait_for_app_loaded(app: Page)` | Wait for the app to fully load during its first execution. |
| `rerun_app(app: Page)` | Triggers an app rerun and waits for the run to be finished. |

The following pytest **fixtures** are available within `conftest.py`:

| Fixtures | Description |
|----------|-------------|
| `app: Page` | Loads the Streamlit app with light mode. |
| `themed_app: Page` | Loads the Streamlit app with light & dark mode. |
| `assert_snapshot` | For screenshot testing of elements (locator objects). E.g.: `assert_snapshot(element, name="name-of-snapshot")` <br><br> The suggested naming schema for snapshots that are related to a command: `st_command-test_description` |
| `app_with_query_params` | Loads the Streamlit app with a configured set of query parameters. |

## Three Rules of Playwright

1. Leverage the [**`expect`** method](https://playwright.dev/python/docs/test-assertions) for assertions wherever possible. **`assert`** is **evil** 😈 (causes flakiness), please don't use it!
2. Use [**`get_by_test_id`**](https://playwright.dev/python/docs/api/class-page#page-get-by-test-id) to locate elements wherever possible. Use `.locator` only for aspects that are not accessible via a test-id!
3. Don't use `assert`!

## Other Tips & Tricks

- If a test isn't compatible with a specific browser, you can use the `@pytest.mark.skip_browser("firefox")` decorator to skip it.
- `assert_snapshot` is a none-waiting assertion. This can potentially lead to some flakiness if an element hasn't fully loaded yet. Make sure that you have some waiting checks before calling `assert_snapshot` if necessary (this depends on a case by case basis).
- Every dedicated test file requires to start a new Streamlit app server during our CI run. Therefore, it is more time efficient to **group tests into more high-level test scripts** (e.g. based on a command) instead of splitting it into many smaller test scripts.
- **Minimize the number of pixels to test** for better time efficiency and less flakiness. E.g instead of doing fullscreen tests, only screenshot the relevant part. And try to not add redundant screenshot tests for that are just testing the same scenarios.
- If you want to run tests in slow-motion, you can specify the [`--slowmo` parameter](https://playwright.dev/python/docs/test-runners#configure-slow-mo). Useful so that you can see what is going on. E.g., to run a test locally in slow-mo with video recording
    ```bash
    cd e2e_playwright
    pytest name_of_the_test.py -s --video on --slowmo 500
    ```
- You can run your test with **specific Streamlit config options** by adding and using a module-scoped fixture marked with `@pytest.mark.early` in your test file:
  ```python
  @pytest.fixture(scope="module")
  @pytest.mark.early
  def configure_options():
      """Configure Streamlit config options."""
      os.environ["STREAMLIT_SERVER_MAX_MESSAGE_SIZE"] = "3"
      yield
      del os.environ["STREAMLIT_SERVER_MAX_MESSAGE_SIZE"]

  def test_something(app: Page, configure_options):
      # Test code
  ```
