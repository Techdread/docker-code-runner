# Docker Code Runner

A React application for managing Docker containers that execute code in multiple programming languages.

## Features

- Execute code in Java, JavaScript, Python, and C++
- Clean and intuitive UI with syntax highlighting
- Real-time container status monitoring
- Secure code execution in isolated containers
- Automatic process termination for infinite loops
- Output buffering and truncation for large outputs
- Stop button functionality for long-running code

## Technologies Used
- Node.js
- Express
- Docker
- JavaScript
- Java
- Python
- C++

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

3. Start the backend server:
   ```bash
   cd server
   npm install
   node server.js
   ```
   The server will run on port 3001 by default.

4. Start the frontend development server:
   ```bash
   # In a new terminal, from the project root
   npm run dev
   ```
   The frontend will run on port 5173 by default.

5. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

## Project Structure

```
docker-code-runner/
├── src/                    # Frontend React application
│   ├── components/
│   │   ├── CodeEditor.jsx  # Code editor with execution controls
│   │   └── ContainerDashboard.jsx
│   ├── services/
│   └── App.jsx
├── server/                 # Backend Node.js server
│   └── server.js          # API endpoints and container management
├── docker/                 # Docker configurations
│   ├── Dockerfile.python
│   ├── Dockerfile.javascript
│   ├── Dockerfile.java
│   └── Dockerfile.cpp
└── README.md
```

## Code Execution Limits

- Maximum execution time: 5 seconds
- Maximum output buffer: 10KB
- Automatic container recycling after each execution
- Force termination available via stop button

## Security Considerations

- All code execution happens in isolated Docker containers
- Non-root users are used in containers
- Resource limits are enforced
- Network access is restricted
- Containers are recycled after each execution
- Output buffering prevents memory exhaustion

## Troubleshooting

If you encounter any issues:

1. Ensure Docker Desktop is running
2. Check both frontend and backend server logs
3. If a container becomes unresponsive:
   ```bash
   docker ps  # List running containers
   docker kill <container-id>  # Force stop a container
   ```
4. Restart the backend server if needed

## License

MIT
