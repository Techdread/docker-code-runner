FROM node:20-slim

WORKDIR /app

# Install common engineering libraries
RUN npm install -g \
    jest \
    axios \
    express \
    mathjs \
    lodash

# Create a non-root user with a different UID
RUN useradd -m -u 1001 coderunner
USER coderunner

# Copy the execution script
COPY --chown=coderunner:coderunner runner.js .

CMD ["node", "runner.js"]
