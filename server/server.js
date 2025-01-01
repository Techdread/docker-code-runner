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
  const { language, code, input } = req.body;
  if (!language || !code) {
    return res.status(400).json({ error: 'Language and code are required' });
  }

  console.log('[DEBUG] Executing code for language:', language);
  console.log('[DEBUG] Code:', code);
  console.log('[DEBUG] User input:', input || 'none');

  const containerName = `${CONTAINER_PREFIX}${language}`;
  console.log('[DEBUG] Container name:', containerName);

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
        
        console.log('[DEBUG] Escaped Java code:', escapedCode);
        
        // Pass the code as a quoted string, but input without quotes
        cmd = ['java', '-cp', '.', 'Runner', `"${escapedCode}"`, input || ''];
        break;
      case 'cpp':
        // For C++, we need to compile and run
        cmd = ['sh', '-c', `echo '${code}' > main.cpp && g++ main.cpp -o main && ./main`];
        break;
      default:
        return res.status(400).json({ error: 'Unsupported language' });
    }

    console.log('[DEBUG] Execution command:', cmd);

    // Execute the code
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true
    });

    const start = Date.now();
    console.log('[DEBUG] Starting execution at:', start);

    // Create a promise to handle the execution
    const execPromise = new Promise((resolve, reject) => {
      exec.start({ hijack: true, stdin: true }, (err, stream) => {
        if (err) {
          console.error('[DEBUG] Exec start error:', err);
          return reject(err);
        }
        
        console.log('[DEBUG] Stream created successfully');
        
        let stdout = '';
        let stderr = '';

        // Handle the multiplexed streams
        container.modem.demuxStream(stream, {
          write: (chunk) => {
            const data = chunk.toString('utf8');
            console.log('[DEBUG] stdout chunk:', data);
            stdout += data;
          }
        }, {
          write: (chunk) => {
            const data = chunk.toString('utf8');
            console.log('[DEBUG] stderr chunk:', data);
            stderr += data;
          }
        });

        stream.on('end', () => {
          console.log('[DEBUG] Stream ended');
          console.log('[DEBUG] Final stdout length:', stdout.length);
          console.log('[DEBUG] Final stderr length:', stderr.length);
          resolve({ stdout, stderr });
        });

        stream.on('error', (err) => {
          console.error('[DEBUG] Stream error:', err);
          reject(err);
        });
      });
    });

    // Wait for execution to complete
    console.log('[DEBUG] Waiting for execution to complete');
    const { stdout, stderr } = await execPromise;
    const executionTime = ((Date.now() - start) / 1000).toFixed(3);
    console.log('[DEBUG] Execution completed in:', executionTime, 'seconds');

    // Clean the output by removing control characters
    const cleanOutput = (str) => str
      .replace(/\u0001\u0000\u0000\u0000\u0000\u0000\u0000/g, '')
      .replace(/[\x00-\x08\x0B-\x1F\x7F-\x9F]/g, '');

    const cleanedStdout = cleanOutput(stdout);
    const cleanedStderr = cleanOutput(stderr);

    console.log('[DEBUG] Cleaned stdout length:', cleanedStdout.length);
    console.log('[DEBUG] Cleaned stderr length:', cleanedStderr.length);

    res.json({
      stdout: cleanedStdout,
      stderr: cleanedStderr,
      executionTime: `${executionTime}s`,
      status: stderr ? 'failure' : 'success'
    });

  } catch (error) {
    console.error('[DEBUG] Error executing code:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
