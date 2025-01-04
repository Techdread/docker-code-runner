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

// Track container states
const containerStates = new Map();

// Container state constants
const CONTAINER_STATE = {
  IDLE: 'idle',
  RUNNING: 'running',
  CLEANING: 'cleaning'
};

// Track running executions
const runningExecutions = new Map();

// Maximum execution time (5 seconds)
const MAX_EXECUTION_TIME = 5000;

// Maximum output buffer size (10KB)
const MAX_OUTPUT_SIZE = 10 * 1024;

// Function to ensure container is ready
async function ensureContainerReady(containerName) {
  try {
    let container;
    try {
      container = docker.getContainer(containerName);
      const info = await container.inspect();
      
      if (!info.State.Running) {
        console.log(`Container ${containerName} exists but not running, starting it...`);
        await container.start();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait longer for container to be ready
      }
    } catch (err) {
      if (err.statusCode === 404) {
        console.log(`Container ${containerName} not found, creating new one...`);
        await restartContainer(containerName);
        return true;
      }
      throw err;
    }
    
    // Verify container is actually running
    const verifyInfo = await container.inspect();
    if (!verifyInfo.State.Running) {
      console.log(`Container ${containerName} failed to start, recreating...`);
      await restartContainer(containerName);
    }
    
    return true;
  } catch (error) {
    console.error(`Error ensuring container ${containerName} is ready:`, error);
    return false;
  }
}

// Function to ensure image exists
async function ensureImageExists(imageName) {
  try {
    console.log(`Checking if image ${imageName} exists...`);
    await docker.getImage(imageName).inspect();
    console.log(`Image ${imageName} found`);
    return true;
  } catch (error) {
    if (error.statusCode === 404) {
      console.log(`Image ${imageName} not found, building...`);
      try {
        // Build the image
        const language = imageName.replace('code-runner-', '');
        const stream = await docker.buildImage({
          context: './docker',
          src: [`Dockerfile.${language}`, 'runner.js']
        }, {
          t: imageName,
          dockerfile: `Dockerfile.${language}`
        });

        // Wait for the build to complete
        await new Promise((resolve, reject) => {
          docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
        });

        console.log(`Image ${imageName} built successfully`);
        return true;
      } catch (buildError) {
        console.error(`Error building image ${imageName}:`, buildError);
        return false;
      }
    }
    console.error(`Error checking image ${imageName}:`, error);
    return false;
  }
}

// Function to restart container
async function restartContainer(containerName) {
  try {
    if (containerStates.get(containerName) === CONTAINER_STATE.CLEANING) {
      console.log(`Container ${containerName} is already being cleaned up`);
      return;
    }

    containerStates.set(containerName, CONTAINER_STATE.CLEANING);
    console.log(`Restarting container ${containerName}...`);
    
    // Get image name
    const language = containerName.replace(CONTAINER_PREFIX, '');
    const imageName = `code-runner-${language}`;

    // Ensure image exists
    const imageExists = await ensureImageExists(imageName);
    if (!imageExists) {
      throw new Error(`Failed to ensure image ${imageName} exists`);
    }
    
    try {
      const container = docker.getContainer(containerName);
      await container.remove({ force: true });
    } catch (err) {
      // Ignore if container doesn't exist
      if (err.statusCode !== 404) {
        console.error(`Error removing container ${containerName}:`, err);
      }
    }
    
    console.log(`Creating new container ${containerName}...`);
    const newContainer = await docker.createContainer({
      Image: imageName,
      name: containerName,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
      WorkingDir: '/app',
      HostConfig: {
        AutoRemove: false,
        RestartPolicy: {
          Name: 'no'
        }
      }
    });

    console.log(`Starting container ${containerName}...`);
    await newContainer.start();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify container is running
    const info = await newContainer.inspect();
    if (!info.State.Running) {
      throw new Error(`Failed to start container ${containerName}`);
    }
    
    console.log(`Container ${containerName} is ready`);
    containerStates.set(containerName, CONTAINER_STATE.IDLE);
  } catch (error) {
    console.error(`Error in restartContainer for ${containerName}:`, error);
    containerStates.set(containerName, CONTAINER_STATE.IDLE);
    throw error;
  }
}

// Function to ensure container is clean
async function ensureCleanContainer(language) {
  const containerName = `${CONTAINER_PREFIX}${language}`;
  await restartContainer(containerName);
  return containerName;
}

// Function to escape code for Java
function escapeJavaCode(code) {
  return code
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
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
        StdinOnce: false,
        HostConfig: {
          AutoRemove: true,
          RestartPolicy: {
            Name: 'no'
          }
        }
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
    // Ensure container is ready before execution
    console.log(`Preparing container ${containerName} for execution...`);
    const isReady = await ensureContainerReady(containerName);
    if (!isReady) {
      throw new Error('Failed to prepare container for execution');
    }

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
      case 'java': {
        // For Java, we need to determine if the code contains a class definition
        const hasClassDef = /class\s+\w+/.test(code);
        const className = hasClassDef ? code.match(/class\s+(\w+)/)[1] : 'Main';
        const fullCode = hasClassDef ? code : `public class Main { public static void main(String[] args) { ${code} } }`;
        
        // Write code to file
        console.log('Writing Java code to file...');
        const writeCmd = await container.exec({
          Cmd: ['sh', '-c', `echo '${fullCode}' > ${className}.java`],
          WorkingDir: '/app',
          AttachStdout: true,
          AttachStderr: true
        });
        
        await new Promise((resolve, reject) => {
          writeCmd.start((err, stream) => {
            if (err) return reject(err);
            container.modem.demuxStream(stream, process.stdout, process.stderr);
            stream.on('end', resolve);
            stream.on('error', reject);
          });
        });
        
        // If input is provided, write it to a file
        if (input) {
          console.log('Writing input to file...');
          // Format input: add newline at the end to ensure Scanner can read it
          const formattedInput = input.trim() + '\n';
          const writeInputCmd = await container.exec({
            Cmd: ['sh', '-c', `printf '${formattedInput}' > input.txt`],
            WorkingDir: '/app',
            AttachStdout: true,
            AttachStderr: true
          });
          
          await new Promise((resolve, reject) => {
            writeInputCmd.start((err, stream) => {
              if (err) return reject(err);
              container.modem.demuxStream(stream, process.stdout, process.stderr);
              stream.on('end', resolve);
              stream.on('error', reject);
            });
          });
        }
        
        // Compile the code
        console.log('Compiling Java code...');
        const compileCmd = await container.exec({
          Cmd: ['javac', `${className}.java`],
          WorkingDir: '/app',
          AttachStdout: true,
          AttachStderr: true
        });
        
        await new Promise((resolve, reject) => {
          compileCmd.start((err, stream) => {
            if (err) return reject(err);
            container.modem.demuxStream(stream, process.stdout, process.stderr);
            stream.on('end', resolve);
            stream.on('error', reject);
          });
        });
        
        // Run the code with input redirection if provided
        console.log('Running Java code...');
        if (input) {
          cmd = ['sh', '-c', `cat input.txt | java ${className}`];
        } else {
          cmd = ['java', className];
        }
        break;
      }
      default:
        return res.status(400).json({ error: 'Unsupported language' });
    }

    // Execute the code
    console.log(`Executing ${language} code...`);
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/app',
      Tty: false
    });

    const start = Date.now();
    
    // Store the execution for potential termination
    runningExecutions.set(containerName, { exec, container, start });

    // Create a promise to handle the execution
    const execPromise = new Promise((resolve, reject) => {
      let isTerminated = false;
      let stdout = '';
      let stderr = '';
      
      exec.start((err, stream) => {
        if (err) {
          return reject(err);
        }

        container.modem.demuxStream(stream, {
          write: (chunk) => {
            if (stdout.length + chunk.length <= MAX_OUTPUT_SIZE) {
              stdout += chunk.toString('utf8');
            } else if (!isTerminated) {
              stdout += '\n... Output limit exceeded. Stopping execution ...\n';
              isTerminated = true;
              resolve({ stdout, stderr, outputExceeded: true });
            }
          }
        }, {
          write: (chunk) => {
            if (stderr.length + chunk.length <= MAX_OUTPUT_SIZE) {
              stderr += chunk.toString('utf8');
            }
          }
        });

        // Set timeout to prevent infinite execution
        const timeoutId = setTimeout(() => {
          if (!isTerminated) {
            isTerminated = true;
            stderr += '\n... Execution timed out (5 seconds limit) ...\n';
            resolve({ stdout, stderr, timedOut: true });
          }
        }, MAX_EXECUTION_TIME);

        stream.on('end', () => {
          clearTimeout(timeoutId);
          if (!isTerminated) {
            resolve({ stdout, stderr });
          }
        });

        stream.on('error', (error) => {
          clearTimeout(timeoutId);
          if (!isTerminated) {
            isTerminated = true;
            reject(error);
          }
        });
      });
    });

    const { stdout, stderr, timedOut, outputExceeded } = await execPromise;
    const executionTime = Date.now() - start;

    // Clean up
    runningExecutions.delete(containerName);

    // Clean up input file if it exists
    if (input) {
      try {
        await container.exec({
          Cmd: ['rm', 'input.txt'],
          WorkingDir: '/app'
        }).start();
      } catch (error) {
        console.error('Error cleaning up input file:', error);
      }
    }

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
    runningExecutions.delete(containerName);
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
