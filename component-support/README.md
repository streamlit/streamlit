# Streamlit Component Support

An npm package that provides support code for creating [Streamlit Components](https://docs.streamlit.io/en/stable/streamlit_components.html).

The fastest way to start writing a Streamlit Component is to use our [Component Template repo](https://github.com/streamlit/component-template), which contains templates and example code.

## Publishing a New Version

- If necessary, log into npm as "streamlit": `$ npm login`
- Optional: install the [np](https://github.com/sindresorhus/np) utility to use its nice publishing wizard
- If using `np`:
  - `$ np --any-branch` (we don't publish from `master`)
- Else:
  - Increment `version` inside `package.json`, using the [Semantic Versioning](https://semver.org/) convention.
  - `$ npm publish`
- Update the examples and templates in the [Component Template repo](https://github.com/streamlit/component-template) to use the new version.
