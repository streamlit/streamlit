# Run this on a big and fast machine (even then it will still takes hours):
#   docker build -t streamlit/streamlit:cuda9.1-cudnn7-tensorflow1.12.0 -f Dockerfile .
FROM nvidia/cuda:9.1-cudnn7-devel-ubuntu16.04 as build

RUN apt-get update -y
RUN apt-get install -y python3-dev python3-pip
RUN pip3 install pip six numpy wheel setuptools mock future>=0.17.1 keras_applications==1.0.6 --no-deps keras_preprocessing==1.0.5 --no-deps

RUN apt-get install -y openjdk-8-jdk git curl
RUN curl -OL https://github.com/bazelbuild/bazel/releases/download/0.18.1/bazel-0.18.1-installer-linux-x86_64.sh
RUN chmod 755 bazel-0.18.1-installer-linux-x86_64.sh

RUN apt-get install -y unzip
RUN ./bazel-0.18.1-installer-linux-x86_64.sh

RUN git clone https://github.com/tensorflow/tensorflow.git
RUN cd tensorflow && git checkout v1.12.0

RUN apt-get install -y --allow-change-held-packages libnccl2

RUN cd tensorflow && \
    TF_ENABLE_XLA=0 \
    PYTHON_BIN_PATH=/usr/bin/python3 \
    USE_DEFAULT_PYTHON_LIB_PATH=1 \
    TF_NEED_OPENCL_SYCL=0 \
    TF_NEED_ROCM=0 \
    TF_NEED_CUDA=1 \
    TF_NEED_TENSORRT=0 \
    TF_CUDA_VERSION=9.1 \
    TF_CUDNN_VERSION=7 \
    CUDNN_INSTALL_PATH=/usr/local/cuda \
    CUDA_TOOLKIT_PATH=/usr/local/cuda \
    TF_CUDA_COMPUTE_CAPABILITIES=3.0,3.5,3.7,5.2,6.0 \
    TF_SET_ANDROID_WORKSPACE=0 \
    TF_CUDA_CLANG=0 \
    GCC_HOST_COMPILER_PATH=/usr/bin/gcc \
    TF_NEED_MPI=0 \
    TF_NEED_IGNITE=0 \
    TF_NCCL_VERSION=2.2 \
    CC_OPT_FLAGS="-O2" \
    ./configure

# tensorflow looks for python not python3
RUN ln -fs /usr/bin/python3 /usr/bin/python
# If youre not on GPU machine, use the stub.
RUN ln -fs /usr/local/cuda/lib64/stubs/libcuda.so /usr/lib/libcuda.so.1

WORKDIR /tensorflow
RUN bazel build --config=opt --config=cuda //tensorflow/tools/pip_package:build_pip_package
RUN ./bazel-bin/tensorflow/tools/pip_package/build_pip_package /tmp/tensorflow_pkg
RUN rm -f /usr/lib/libcuda.so.1

FROM scratch
COPY --from=build /tmp/tensorflow_pkg/*.whl /
