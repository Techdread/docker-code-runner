import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Box, 
  TextField, 
  Button, 
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Collapse
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { dockerService } from '../services/dockerService';

const languageMap = {
  'javascript': 'javascript',
  'python': 'python',
  'java': 'java',
  'cpp': 'cpp'
};

export default function CodeEditor() {
  const [code, setCode] = useState('');
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [language, setLanguage] = useState('javascript');
  const [input, setInput] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const maxOutputLength = 5000; // Maximum number of characters to display
  const outputRef = useRef({ stdout: '', stderr: '' });

  const truncateOutput = (text) => {
    if (text.length > maxOutputLength) {
      return text.substring(0, maxOutputLength) + '\n... Output truncated. Program is still running but output is limited ...';
    }
    return text;
  };

  useEffect(() => {
    if (output?.stdout) {
      // Prism.highlightAll();
    }
  }, [output, language]);

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Please enter some code to execute');
      return;
    }

    setError(null);
    setLoading(true);
    setIsRunning(true);
    setOutput(null);
    outputRef.current = { stdout: '', stderr: '' };

    try {
      // Start the container if it's not running
      await dockerService.startContainer(language);

      // Execute the code
      const result = await dockerService.executeCode(language, code, input);
      
      setOutput({
        stdout: truncateOutput(result.stdout || ''),
        stderr: result.stderr || '',
        executionTime: result.executionTime || ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    try {
      await dockerService.stopExecution(language);
      setIsRunning(false);
      setLoading(false);
      
      // Clear any remaining output buffer
      if (outputRef.current.stdout) {
        setOutput(prev => ({
          ...prev,
          stdout: truncateOutput(outputRef.current.stdout) + '\n[Program execution stopped by user]',
          executionTime: 'Stopped by user'
        }));
      } else {
        setError('Program execution stopped by user');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Language</InputLabel>
        <Select
          value={language}
          label="Language"
          onChange={(e) => setLanguage(e.target.value)}
          disabled={loading}
        >
          <MenuItem value="javascript">JavaScript</MenuItem>
          <MenuItem value="python">Python</MenuItem>
          <MenuItem value="java">Java</MenuItem>
          <MenuItem value="cpp">C++</MenuItem>
        </Select>
      </FormControl>

      <Box sx={{ mb: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Editor
          height="400px"
          defaultLanguage="javascript"
          language={language}
          value={code}
          onChange={setCode}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14
          }}
        />
      </Box>

      <TextField
        fullWidth
        multiline
        rows={5}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter input here..."
        sx={{ mb: 2 }}
        InputProps={{
          style: { 
            fontFamily: 'monospace',
            fontSize: '14px'
          }
        }}
        disabled={loading}
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || isRunning}
          startIcon={<PlayArrowIcon />}
        >
          Run Code
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleStop}
          disabled={!isRunning}
          startIcon={<StopIcon />}
        >
          Stop
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {output && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Output
          </Typography>
          
          <Box sx={{
            maxHeight: '300px',
            overflowY: 'auto',
            borderRadius: 1,
            bgcolor: '#1e1e1e'
          }}>
            {output.stdout ? (
              <SyntaxHighlighter
                language={"text"}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '1rem',
                  fontSize: '16px',
                  backgroundColor: 'transparent'
                }}
              >
                {output.stdout}
              </SyntaxHighlighter>
            ) : (
              <Box sx={{ p: 2, color: 'grey.500' }}>
                No output
              </Box>
            )}
          </Box>
          
          {output.stderr && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <Typography variant="h6" sx={{ flex: 1 }}>
                  Debug Trace
                </Typography>
                <IconButton 
                  onClick={() => setShowDebug(!showDebug)}
                  size="small"
                >
                  {showDebug ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                </IconButton>
              </Box>
              <Collapse in={showDebug}>
                <Box sx={{
                  p: 2,
                  bgcolor: '#1e1e1e',
                  borderRadius: 1,
                  color: '#f44336',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {output.stderr}
                </Box>
              </Collapse>
            </>
          )}

          {output.executionTime && (
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              Execution time: {output.executionTime}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
