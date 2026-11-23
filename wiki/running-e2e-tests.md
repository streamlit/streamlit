# Running e2e tests and updating snapshots

This guide will help you understand the structure and execution of Playwright tests. All Playwright tests are stored in the `e2e_playwright` directory. Each test includes a corresponding Streamlit app script (for instance, `st_dataframe.py`) and a Playwright Pytest file (like `st_dataframe_test.py`). During the test run, the Pytest file will execute the Streamlit script automatically. All the `_test` files are executed automatically in our CI pipeline on every Pull Request (PR).

## Executing a single test locally

Before running a single test, ensure you have installed all necessary test dependencies. Follow the commands below to run an individual test:

> **Note**:
> If you have implemented changes in the frontend, you might also need to run `make frontend-fast` before running an e2e test. Otherwise, it might use old frontend assets.

```bash
make run-e2e-test e2e_playwright/name_of_the_test.py
```

Screenshot tests compare against `e2e_playwright/__snapshots__/<os>/` for the machine running the test (`darwin` on macOS, `linux` in CI). CI checks the committed `linux` snapshots, which can differ from a local OS, so a green local run does not update the images CI uses. A missing snapshot is written into that OS folder and the test still fails once, so one run can generate every missing image.

## Debugging tests

You can run the test in the [interactive debugging mode](https://playwright.dev/python/docs/debug) via:

```bash
make debug-e2e-test e2e_playwright/name_of_the_test.py
```

You can find additional CLI options [here](https://playwright.dev/python/docs/test-runners#cli-arguments) for other ways of debugging playwright tests such as recording traces or videos and activating slowmo or headed mode.

## Running tests against an externally hosted app (external app mode)

By default, e2e tests start a local Streamlit server for the app script that
corresponds to the test file. In some environments, you may want to run tests
against an already-running app (for example, when the app is hosted behind SSO
or embedded in a host page).

When external app mode is enabled, **only tests marked with**
`@pytest.mark.external_test` are executed. All other tests are skipped.

Available options (also configurable via environment variables):

- `--external-app-url` / `STREAMLIT_E2E_EXTERNAL_APP_URL`: Absolute HTTP(S) URL
  for the app (for example, `https://example.com/app`).
- `--external-host-url` / `STREAMLIT_E2E_EXTERNAL_HOST_URL`: Optional absolute
  HTTP(S) URL for a host page that embeds the app (for example, Snowsight).
- `--external-iframe-selector` / `STREAMLIT_E2E_EXTERNAL_IFRAME_SELECTOR`: CSS
  selector for the iframe element within the host page (defaults to `iframe`).
- `--browser-state-path` / `STREAMLIT_E2E_BROWSER_STATE_PATH`: Path to a
  Playwright storage state JSON file (useful for authenticated sessions).

## Accessing local test results

Committed screenshots live under `e2e_playwright/__snapshots__/linux/`. A local run also writes missing screenshots under `e2e_playwright/__snapshots__/<os>/` for that machine. Failed tests store videos, traces, and diff images under `e2e_playwright/test-results/`. Updated images for mismatches and missing snapshots are under `e2e_playwright/test-results/snapshot-updates/`.

## Accessing GitHub test results

Upon completion of every [Playwright E2E Tests workflow](../.github/workflows/playwright.yml), test results will be uploaded and can be accessed from the Artifacts section of the workflow run summary.

<img width="700" alt="image" src="https://github.com/streamlit/streamlit/assets/2852129/3c7f7739-7ced-4d93-b131-9628c83bc49e">

Each Playwright run uploads `playwright_test_results_` plus the first 6 characters of the head SHA (the pull request head on a PR). When tests fail, that artifact contains videos, differential screenshots, and a `snapshot-updates` folder for missing or mismatched snapshots.

## Updating screenshots

CI checks the `linux` snapshots. On a pull request, add the `update-snapshots` label before the Playwright run or after it has failed. When that run fails because snapshots are missing or mismatched, [Snapshot Autofix](../.github/workflows/snapshot-autofix.yml) opens a pull request with the updated `linux` images. A pass, or a failure that produced no snapshot updates, removes the label. Review that pull request before merging it.

To pull the same images into your checkout, push your branch and run `make update-snapshots`. The script looks up the Playwright run for your local `HEAD`. If that run failed, it merges the artifact's `snapshot-updates` folder into `e2e_playwright/__snapshots__/`. If the run passed, or there is no run for that commit yet, it exits. It waits while the run is still in progress. `make update-snapshots-changed` does the same for the changed-files workflow.

`make update-snapshots` does not regenerate snapshots for your local OS. Re-run the test locally to write missing images under `__snapshots__/<os>/`. Only `__snapshots__/linux/` is committed. Other OS folders are gitignored. On Linux, a local run writes into that committed folder, so prefer the images CI produces.

After either path, commit only the snapshots you expect to change. Flaky tests can change unrelated images.

> **Note**: If you cloned the repository using `https` with a token, the script should work out of the box. If you cloned via `ssh`, the script will prompt you for a Personal Access Token (PAT). You can create one [here](https://github.com/settings/tokens/new) (only requires the `repo/public_repo` scope). Alternatively, you can provide the token via command-line arguments: `uv run python scripts/update_e2e_snapshots.py --token MY_TOKEN`

## Utility methods & fixtures

The following **utility methods** are available within `conftest.py`:

| Function                              | Description                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| `wait_for_app_run(app: Page)`         | Wait for an app run to finish.                                                          |
| `wait_for_app_loaded(app: Page)`      | Wait for the app to fully load during its first execution.                               |
| `rerun_app(app: Page)`                | Triggers an app rerun and waits for the run to be finished.                              |
| `wait_until(app: Page, fn: callable)` | Run a test function in a loop until it evaluates to `True` or times out.                 |
| `build_app_url(...)`                  | URL builder to compose paths/query/fragment from `app_base_url`. Use instead of string concatenation. |

The following pytest **fixtures** are available within `conftest.py`:

| Fixtures                | Description                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app: Page`             | Loads the Streamlit app with light mode.                                                                                                                                                                                        |
| `themed_app: Page`      | Loads the Streamlit app with light & dark mode.                                                                                                                                                                                 |
| `app_target: AppTarget` | App interaction wrapper that abstracts whether the app DOM is at the top-level (`Page`) or inside a host page (`FrameLocator`). Prefer over bare `Page` for external test compatibility.                                        |
| `app_base_url: str`     | Base URL for app navigation (external or localhost). Use with `build_app_url(...)` instead of hardcoding localhost URLs.                                                                                                         |
| `assert_snapshot`       | For screenshot testing of elements (locator objects). E.g.: `assert_snapshot(element, name="name-of-snapshot")` <br><br> The suggested naming schema for snapshots that are related to a command: `st_command-test_description` |
| `app_with_query_params` | Loads the Streamlit app with a configured set of query parameters.                                                                                                                                                              |

## Three Rules of Playwright

1. Leverage the [**`expect`** method](https://playwright.dev/python/docs/test-assertions) for assertions wherever possible. **`assert`** can cause flakiness in Playwright tests (due to lack of auto-waiting), please use `expect` instead!
2. Use [**`get_by_test_id`**](https://playwright.dev/python/docs/api/class-page#page-get-by-test-id) to locate elements wherever possible. Use `.locator` only for aspects that are not accessible via a test-id!
3. Don't use `assert`! But `expect` doesn't work with my case? Use the `wait_until` utility method instead.

## Common ways to reduce flakiness

Adding additional `except(element).to_X` checks often reduces flakiness. Especially before running any interaction on the element. Sometimes, increasing and adding timeouts can also help to reduce flakiness but its more of an anti-pattern that hides flakiness instead of actually fully solving it.

If there isn't an obvious fix for the flakiness and the flakiness does not indicate a reproducible bug, you can use:

- `pytest.mark.skip_browser`: This is a good option if the flakiness is only specific to a single browser.
- `pytest.mark.flaky(reruns=3)`: This significantly reduces the potential for the test causing a CI failure.

## Other Tips & Tricks

- If a test isn't compatible with a specific browser, you can use the `@pytest.mark.skip_browser("firefox")` decorator to skip it.
- `assert_snapshot` is a non-waiting assertion. This can potentially lead to some flakiness if an element hasn't fully loaded yet. Make sure that you have some waiting checks before calling `assert_snapshot` if necessary (this depends on a case by case basis).
- From [playwright docs](https://playwright.dev/python/docs/api/class-page#page-wait-for-timeout): "**Never use `wait_for_timeout` in production**. Tests that wait for time are inherently flaky. Use Locator actions and web assertions that wait automatically."
- Every dedicated test file requires to start a new Streamlit app server during our CI run. Therefore, it is more time efficient to **group tests into more high-level test scripts** (e.g. based on a command) instead of splitting it into many smaller test scripts.
- **Minimize the number of pixels to test** for better time efficiency and less flakiness. E.g instead of doing fullscreen tests, only screenshot the relevant part. And try to not add redundant screenshot tests that are just testing the same scenarios.
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

- If you want to run tests in slow-motion, you can specify the [`--slowmo` parameter](https://playwright.dev/python/docs/test-runners#configure-slow-mo). Useful so that you can see what is going on. E.g., to run a test locally in slow-mo with video recording

  ```bash
  cd e2e_playwright
  uv run pytest name_of_the_test.py -s --video on --slowmo 500
  ```

- The [`--headed` flag](https://playwright.dev/docs/running-tests#run-tests-in-headed-mode) can be used to watch the test being executed, as a browser window will be opened. There you can also open the DevTools to inspect elements etc. In order to follow what's going on more easily, you can combine it with the `--slowmo` flag.
- Screenshots of elements within the main container should be under 640px (700px screen height - 60px header height) to avoid being cut off from the top header.

![Views](https://api.views-badge.org/badge/st-wiki-e2etests)
