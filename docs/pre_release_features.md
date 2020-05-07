# Try pre-release features

At Streamlit, we like to move quick while keeping things stable. In our latest effort to move even faster without sacrificing stability, we're offering our bold and fearless users two ways to try out Streamlit's most bleeding edge features:

1. [Nightly releases](#nightly-releases)
2. [Beta and experimental namespaces](#beta-and-experimental-namespaces)

## Nightly releases

At the end of each day (at night 🌛), our bots run automated tests against the latest Streamlit code and, if everything looks good, it publishes them as the `streamlit-nightly` package. This means the nightly build includes all our latest features, bug fixes, and other enhancements on the same day they land on our codebase.

**How does this differ from official releases?**

Official Streamlit releases go not only through both automated tests but also rigorous manual testing, while nightly releases only have automated tests. It's important to keep in mind that new features introduced in nightly releases often lack polish. In our official releases, we always make double-sure all new features are ready for prime time.

**How do I use the nightly release?**

All you need to do is install the `streamlit-nightly` package:

```
pip uninstall streamlit
pip install streamlit-nightly --upgrade
```

```eval_rst
.. warning::

   You should never have both `streamlit` and `streamlit-nightly` installed in the same environment!
```

**Why should I use the nightly release?**

Because you can't wait for official releases, and you want to help us find bugs early!

**Why shouldn't I use the nightly release?**

While our automated tests have high coverage, there's still a significant likelihood that there will be some bugs in the nightly code.

**Can I choose which nightly release I want to install?**

If you'd like to use a specific version, you can find the version number in our [Release history](https://pypi.org/project/streamlit-nightly/#history). Just specify the desired version using `pip` as usual: `pip install streamlit-nightly==x.yy.zz-123456`.

**Can I compare changes between releases?**

If you'd like to review the changes for a nightly release, you can use the [comparison tool on GitHub](https://github.com/streamlit/streamlit/compare/0.57.3...0.57.4.dev20200412).

## Beta and Experimental Namespaces

In addition to nightly releases, we're also introducing two new namespaces for Streamlit features: `st.beta` and `st.experimental`. These are basically prefixes we attach to our function names to make sure their status is clear to everyone.

Here's a quick rundown of what you get from each namespace:

- **st**: this is where our core features like `st.write` and `st.dataframe` live. If we ever make backward-incompatible changes to these, they will take place gradually and with months of announcements and warnings.
- **st.beta**: this is where all new features land before they find their way to `st`. This gives you a chance to try the next big thing we're cooking up weeks or months before we're ready to stabilize its API.
- **st.experimental**: this is where we'll put features that may or may not ever make it into `st`. We don't know whether these features have a future, but we want you to have access to everything we're trying, and work with us to figure them out.

The main difference between `st.beta` and `st.experimental` is that beta features are expected to make it into the `st` namespace at some point soon, while experimental features may never make it.

### Beta

Features in the beta namespace are all scheduled to become part of `st`, or core Streamlit. While in beta, a feature's API and behaviors may not be stable, and it's possible they could change in ways that aren't backward-compatible.

**The lifecycle of a beta feature**

1. A feature is added to the beta namespace.
2. The feature's API stabilizes and the feature is _cloned_ into the `st` namespace, so it exists in both st and `st.beta`. At this point, users will see a warning when using the version of the feature that lives in the beta namespace -- but the `st.beta` feature will still work.
3. At some point, the feature is _removed_ from the `st.beta` namespace, but there will still be a stub in `st.beta` that shows an error with appropriate instructions.
4. Finally, at a later date the stub in `st.beta` is removed.

### Experimental

Features in the experimental namespace are things that we're still working on or trying to understand. If these features are successful, at some point they'll become part of core Streamlit, by moving to the `st.beta` namespace and then to `st`. If unsuccessful, these features are removed without much notice.

```eval_rst
.. warning::

   Experimental features and their APIs may change or be removed at any time.
```

**The lifecycle of an experimental feature**

1. A feature is added to the experimental namespace.
2. The feature is potentially tweaked over time, with possible API/behavior breakages.
3. At some point, we either move the feature into `st.beta` or remove it from `st.experimental`. Either way, we leave a stub in `st.experimental` that shows an error with instructions.

Let us know if you have any [questions or feedback](https://discuss.streamlit.io/) about the new namespaces!
