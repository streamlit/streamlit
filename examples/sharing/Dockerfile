ARG STREAMLIT_VERSION
FROM streamlit/streamlit:${STREAMLIT_VERSION}

# Install a system dependency
RUN apt-get update && apt-get install -y --no-install-recommends \
    htop \
    && rm -rf /var/lib/apt/lists/*

# Install pip dependencies
RUN pip3 install tensorflow

# To copy a directory of data:
#COPY path/to/data_dir/. /data_dir/

# Copy code
COPY benchmark.py /benchmark.py

EXPOSE 8501

ENTRYPOINT ["streamlit", "run", "/benchmark.py", "cpu", "10000"]
