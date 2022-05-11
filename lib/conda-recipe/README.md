# Streamlit conda-build recipe (5/10/2022)

## Prereqs

Install `conda` and `conda-build`:

```
$ brew install miniconda
$ conda install conda-build
$ conda config --add channels conda-forge  # Make conda-forge available to conda
```

## Building

1. Build the streamlit frontend first: `$ cd streamlit && make frontend`

2. Build this conda recipe

```
$ cd streamlit/lib/conda-recipe  # (this directory)
$ conda build .  # build the streamlit recipe
```

3. If this is successful, you'll get a tar.bz2 conda file in your conda build directory. Run `conda build --output .` from this directory to find out where the output file ends up.

## Troubleshooting

- Do meta.yaml's "requirements" section need to be updated? (These requirements are not auto-generated - they must be manually specified.)
