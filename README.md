# Docker Code Runner

A React application for managing Docker containers that execute code in multiple programming languages.

## Features

- Execute code in Java, JavaScript, Python, and C++
- Clean and intuitive UI
- Real-time container status monitoring
- Secure code execution in isolated containers
- Support for future testing framework integration

## Prerequisites

- Node.js (v16 or later)
- Docker Desktop for Windows
- Windows 10 Pro
- Visual Studio Code (recommended)

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build Docker images:
   ```bash
   cd docker
   docker build -t code-runner-python -f Dockerfile.python .
   docker build -t code-runner-javascript -f Dockerfile.javascript .
   docker build -t code-runner-java -f Dockerfile.java .
   docker build -t code-runner-cpp -f Dockerfile.cpp .
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
docker-code-runner/
├── src/
│   ├── components/
│   │   ├── CodeEditor.jsx
│   │   └── ContainerDashboard.jsx
│   ├── services/
│   └── App.jsx
├── docker/
│   ├── Dockerfile.python
│   ├── Dockerfile.javascript
│   ├── Dockerfile.java
│   └── Dockerfile.cpp
└── README.md
```

## Adding New Languages

To add support for a new programming language:

1. Create a new Dockerfile in the `docker/` directory
2. Add the language option in `src/components/CodeEditor.jsx`
3. Update the container management logic in the backend

## Security Considerations

- All code execution happens in isolated Docker containers
- Non-root users are used in containers
- Resource limits are enforced
- Network access is restricted

## License

MIT
