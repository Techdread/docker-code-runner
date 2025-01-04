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

// Track active executions
const activeExecutions = new Map();

// Function to kill a specific execution
async function killExecution(containerId, execId) {
  try {
    const container = docker.getContainer(containerId);
    await container.exec({
      Cmd: ['pkill', '-f', 'java'],
      AttachStdout: true,
      AttachStderr: true
    });
    activeExecutions.delete(execId);
  } catch (error) {
    console.error('Error killing execution:', error);
  }
}

// Function to restart container
async function restartContainer(containerName) {
  try {
    const container = docker.getContainer(containerName);
    await container.kill({ signal: 'SIGKILL' });
    await container.remove({ force: true });
    
    // Recreate the container
    const language = containerName.replace(CONTAINER_PREFIX, '');
    const imageName = `code-runner-${language}`;
    
    await docker.createContainer({
      Image: imageName,
      name: containerName,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
      HostConfig: {
        AutoRemove: true,
        RestartPolicy: {
          Name: 'no'
        }
      }
    });
    
    const newContainer = docker.getContainer(containerName);
    await newContainer.start();
  } catch (error) {
    console.error('Error restarting container:', error);
    throw error;
  }
}

// Function to ensure container is clean
async function ensureCleanContainer(language) {
  const containerName = `${CONTAINER_PREFIX}${language}`;
  await restartContainer(containerName);
  return containerName;
}

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
  const { language, code, input } = req.body;
  if (!language || !code) {
    return res.status(400).json({ error: 'Language and code are required' });
  }

  const containerName = `${CONTAINER_PREFIX}${language}`;
  try {
    let container;
    try {
      container = docker.getContainer(containerName);
      await container.inspect();
    } catch (error) {
      // Container doesn't exist or can't be inspected, create new one
      await docker.createContainer({
        Image: `code-runner-${language}`,
        name: containerName,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        OpenStdin: true,
        StdinOnce: false,
        HostConfig: {
          AutoRemove: false
        }
      });
      container = docker.getContainer(containerName);
      await container.start();
    }

    // Create execution command based on language
    let cmd;
    switch (language) {
      case 'java':
        const escapedCode = code
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        cmd = ['timeout', '5s', 'java', '-cp', '.', 'Runner', `"${escapedCode}"`, input || ''];
        break;
      case 'python':
        cmd = ['python', '-c', code];
        break;
      case 'javascript':
        cmd = ['node', '-e', code];
        break;
      case 'cpp':
        cmd = ['sh', '-c', `echo '${code}' > main.cpp && g++ main.cpp -o main && ./main`];
        break;
      default:
        return res.status(400).json({ error: 'Unsupported language' });
    }

    // Execute the code
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true
    });

    // Track this execution
    const execId = exec.id;
    activeExecutions.set(execId, {
      containerId: container.id,
      startTime: Date.now()
    });

    // Set timeout to prevent infinite execution
    const timeoutId = setTimeout(async () => {
      if (activeExecutions.has(execId)) {
        await killExecution(container.id, execId);
        stderr += '\n... Execution timed out (5 seconds limit) ...\n';
      }
    }, 5000);

    const start = Date.now();

    // Create a promise to handle the execution
    const execPromise = new Promise((resolve, reject) => {
      let isTerminated = false;
      
      const cleanup = async () => {
        if (!isTerminated) {
          isTerminated = true;
          try {
            // Force kill the container and recreate it
            await restartContainer(containerName);
          } catch (err) {
            console.error('Error during cleanup:', err);
          }
        }
      };

      exec.start({ hijack: true, stdin: true }, (err, stream) => {
        if (err) {
          cleanup();
          return reject(err);
        }
        
        let stdout = '';
        let stderr = '';
        let outputExceeded = false;

        // Handle the multiplexed streams
        container.modem.demuxStream(stream, {
          write: (chunk) => {
            if (stdout.length + chunk.length <= 10 * 1024) {
              stdout += chunk.toString('utf8');
            } else if (!outputExceeded) {
              stdout += '\n... Output limit exceeded. Stopping execution ...\n';
              outputExceeded = true;
              cleanup();
              resolve({ stdout, stderr, outputExceeded: true });
            }
          }
        }, {
          write: (chunk) => {
            if (stderr.length + chunk.length <= 10 * 1024) {
              stderr += chunk.toString('utf8');
            }
          }
        });

        // Set timeout to prevent infinite execution
        const timeoutId = setTimeout(async () => {
          stderr += '\n... Execution timed out (5 seconds limit) ...\n';
          await cleanup();
          resolve({ stdout, stderr, timedOut: true });
        }, 5000);

        stream.on('end', () => {
          clearTimeout(timeoutId);
          resolve({ stdout, stderr });
        });

        stream.on('error', async (error) => {
          clearTimeout(timeoutId);
          await cleanup();
          reject(error);
        });
      });
    });

    const { stdout, stderr, timedOut, outputExceeded } = await execPromise;
    const executionTime = Date.now() - start;

    // Clean up
    activeExecutions.delete(execId);

    // Send response
    res.json({
      stdout: stdout || '',
      stderr: stderr || '',
      executionTime: timedOut ? 'Timed out (5s limit)' : 
                   outputExceeded ? 'Stopped (output limit exceeded)' : 
                   `${executionTime}ms`
    });

  } catch (error) {
    console.error('Error executing code:', error);
    // Ensure cleanup even on error
    if (containerName) {
      try {
        await restartContainer(containerName);
      } catch (err) {
        console.error('Error during error cleanup:', err);
      }
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/execute/stop', async (req, res) => {
  const { language } = req.body;
  if (!language) {
    return res.status(400).json({ error: 'Language is required' });
  }

  const containerName = `${CONTAINER_PREFIX}${language}`;
  
  try {
    // Force restart the container to kill any running processes
    await restartContainer(containerName);
    res.json({ status: 'success', message: 'Execution stopped' });
  } catch (error) {
    console.error('Error stopping execution:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
