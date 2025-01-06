# Docker Code Runner

A web-based code execution environment that supports multiple programming languages using Docker containers.

## Prerequisites

1. Windows 10 Pro
2. Visual Studio Code
3. Node.js (v14 or higher)
4. Docker Desktop for Windows
5. WSL2 enabled

## Setup Instructions

1. **Start Docker Desktop**
   - Make sure Docker Desktop is running
   - Ensure it's using the WSL2 backend (Settings -> General -> Use WSL2 based engine)

2. **Build and Start Containers**
   ```bash
   # Build all containers
   docker-compose build

   # Start all containers in the background
   docker-compose up -d
   ```

3. **Install Dependencies**
   ```bash
   # Install server dependencies
   npm install
   ```

4. **Start the Application**
   ```bash
   # Start the server (in one terminal)
   cd server
   npm run server

   # Start the frontend (in another terminal)
   cd .. 
   npm start
   ```

5. **Verify Container Status**
   ```bash
   # Check if all containers are running
   docker ps
   ```
   You should see four containers running:
   - code-runner-java
   - code-runner-python
   - code-runner-javascript
   - code-runner-cpp

## Usage

1. Open your browser and navigate to `http://localhost:5173/`
2. Select a programming language from the dropdown
3. Write your code in the editor
4. Click "Run Code" to execute
5. View the output below the editor

## Troubleshooting

1. **Containers Not Starting**
   ```bash
   # Stop all containers
   docker-compose down

   # Remove all containers and rebuild
   docker-compose down --rmi all
   docker-compose up -d --build
   ```

2. **Container Logs**
   ```bash
   # View logs for a specific container (replace java with python/javascript/cpp)
   docker logs code-runner-java
   ```

3. **Server Issues**
   ```bash
   # Check if server is running
   curl http://localhost:3001/health
   ```

## Features

- Multi-language support (Java, Python, JavaScript, C++)
- Real-time code execution
- Syntax highlighting
- Input support
- Debug trace with toggle
- Code execution interruption
- Secure containerized execution

## Security Notes

- Each language runs in its own isolated container
- Execution timeout of 30 seconds
- Memory and CPU limits enforced by Docker
- No network access from code containers
- Input sanitization for all code execution
