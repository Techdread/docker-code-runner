FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

# Create a non-root user
RUN useradd -m -u 1001 coderunner && \
    chown -R coderunner:coderunner /app

# Switch to non-root user
USER coderunner

# Keep container running
CMD ["tail", "-f", "/dev/null"]
