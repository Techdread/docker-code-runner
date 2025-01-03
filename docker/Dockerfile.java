FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

# Install necessary tools
RUN apt-get update && apt-get install -y \
    maven \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m -u 1001 coderunner && \
    chown -R coderunner:coderunner /app

# Copy and compile the runner file
COPY --chown=coderunner:coderunner docker/Runner.java /app/
RUN javac Runner.java

# Switch to non-root user
USER coderunner

# Keep container running
CMD ["tail", "-f", "/dev/null"]
