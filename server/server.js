const express = require('express');
const cors = require('cors');
const Docker = require('dockerode');

const app = express();
const docker = new Docker();

// Middleware
app.use(cors());
app.use(express.json());

// Container name prefix
const CONTAINER_PREFIX = 'code-runner-';

// Routes
app.get('/api/containers', async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    const codeRunnerContainers = containers
      .filter(container => container.Names.some(name => name.startsWith('/' + CONTAINER_PREFIX)))
      .map(container => ({
        id: container.Id,
        name: container.Names[0].replace('/' + CONTAINER_PREFIX, ''),
        status: container.State === 'running' ? 'running' : 'stopped',
        uptime: container.Status,
        language: container.Names[0].replace('/' + CONTAINER_PREFIX, '')
      }));

    // If no containers found, return default list with stopped status
    if (codeRunnerContainers.length === 0) {
      const defaultContainers = ['javascript', 'python', 'java', 'cpp'].map(lang => ({
        id: '-',
        name: lang,
        status: 'stopped',
        uptime: '0m',
        language: lang
      }));
      return res.json(defaultContainers);
    }

    res.json(codeRunnerContainers);
  } catch (error) {
    console.error('Error listing containers:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/containers/start', async (req, res) => {
  const { language } = req.body;
  if (!language) {
    return res.status(400).json({ error: 'Language is required' });
  }

  const containerName = `${CONTAINER_PREFIX}${language}`;
  const imageName = `code-runner-${language}`;

  try {
    // Check if container exists
    const containers = await docker.listContainers({ all: true });
    const existingContainer = containers.find(container => 
      container.Names.includes('/' + containerName)
    );

    if (existingContainer) {
      if (existingContainer.State !== 'running') {
        const container = docker.getContainer(existingContainer.Id);
        await container.start();
      }
    } else {
      // Create and start new container
      await docker.createContainer({
        Image: imageName,
        name: containerName,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        OpenStdin: true,
        StdinOnce: false
      });

      const container = docker.getContainer(containerName);
      await container.start();
    }

    res.json({ status: 'success', message: `Container ${containerName} is running` });
  } catch (error) {
    console.error('Error starting container:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/containers/stop', async (req, res) => {
  const { containerId } = req.body;
  if (!containerId) {
    return res.status(400).json({ error: 'Container ID is required' });
  }

  try {
    const container = docker.getContainer(containerId);
    await container.stop();
    res.json({ status: 'success', message: 'Container stopped' });
  } catch (error) {
    console.error('Error stopping container:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/execute', async (req, res) => {
  const { language, code } = req.body;
  if (!language || !code) {
    return res.status(400).json({ error: 'Language and code are required' });
  }

  const containerName = `${CONTAINER_PREFIX}${language}`;

  try {
    const container = docker.getContainer(containerName);
    
    // Create execution command based on language
    let cmd;
    switch (language) {
      case 'python':
        cmd = ['python', '-c', code];
        break;
      case 'javascript':
        cmd = ['node', '-e', code];
        break;
      case 'java':
        // For Java, we use our Runner class to handle compilation and execution
        // Escape the code string for Java
        const escapedCode = code
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        
        // Pass the code as a properly quoted string argument
        cmd = ['java', '-cp', '.', 'Runner', `"${escapedCode}"`];
        break;
      case 'cpp':
        // For C++, we need to compile and run
        cmd = ['sh', '-c', `echo '${code}' > main.cpp && g++ main.cpp -o main && ./main`];
        break;
      default:
        return res.status(400).json({ error: 'Unsupported language' });
    }

    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true
    });

    const start = Date.now();
    const stream = await exec.start();
    
    let stdout = '';
    let stderr = '';

    stream.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    stream.on('error', (chunk) => {
      stderr += chunk.toString();
    });

    stream.on('end', () => {
      const executionTime = `${(Date.now() - start) / 1000}s`;
      res.json({
        stdout,
        stderr,
        executionTime,
        status: stderr ? 'error' : 'success'
      });
    });
  } catch (error) {
    console.error('Error executing code:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
