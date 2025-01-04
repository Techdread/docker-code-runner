FROM gcc:latest

# Install common engineering libraries and tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    make \
    libboost-all-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m -u 1001 coderunner

# Set up directories and permissions
WORKDIR /app
RUN mkdir -p /tmp/workspace && \
    chown -R coderunner:coderunner /tmp/workspace && \
    chmod 777 /tmp/workspace

# Copy and set up the runner
COPY --chown=coderunner:coderunner runner.cpp /app/
RUN g++ -o /app/runner /app/runner.cpp && \
    chown coderunner:coderunner /app/runner && \
    chmod 755 /app/runner

# Switch to non-root user
USER coderunner
WORKDIR /tmp/workspace

CMD ["/app/runner"]
