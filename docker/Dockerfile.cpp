FROM gcc:latest

WORKDIR /app

# Install common engineering libraries and tools
RUN apt-get update && apt-get install -y \
    cmake \
    make \
    libboost-all-dev \
    googletest \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user with a different UID
RUN useradd -m -u 1001 coderunner
USER coderunner

# Copy the execution script
COPY --chown=coderunner:coderunner runner.cpp .

CMD ["g++", "-o", "runner", "runner.cpp", "&&", "./runner"]
