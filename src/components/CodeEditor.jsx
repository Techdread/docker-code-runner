import { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Typography,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { dockerService } from '../services/dockerService';

const SUPPORTED_LANGUAGES = ['javascript', 'python', 'java', 'cpp'];

const CodeEditor = () => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Please enter some code to execute');
      return;
    }

    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      // Start the container for the selected language
      await dockerService.startContainer(language);

      // Execute the code
      const result = await dockerService.executeCode(language, code);
      
      setOutput({
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        executionTime: result.executionTime || '0s',
        status: result.stderr ? 'failure' : 'success'
      });
    } catch (error) {
      console.error('Error executing code:', error);
      setError(error.message || 'An error occurred while executing the code');
      setOutput({
        stdout: '',
        stderr: error.message,
        executionTime: '0s',
        status: 'failure'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Code Editor
      </Typography>
      
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Language</InputLabel>
        <Select
          value={language}
          label="Language"
          onChange={(e) => setLanguage(e.target.value)}
          disabled={loading}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <MenuItem key={lang} value={lang}>
              {lang.charAt(0).toUpperCase() + lang.slice(1)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        fullWidth
        multiline
        rows={10}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter your code here..."
        sx={{ mb: 2 }}
        InputProps={{
          style: { 
            fontFamily: 'monospace',
            fontSize: '14px'
          }
        }}
        disabled={loading}
      />

      <Button
        variant="contained"
        color="primary"
        onClick={handleSubmit}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
        sx={{ mb: 2 }}
      >
        {loading ? 'Running...' : 'Run Code'}
      </Button>

      {output && (
        <Paper sx={{ p: 2, mt: 2, backgroundColor: '#1e1e1e', color: '#fff' }}>
          <Typography variant="h6" gutterBottom sx={{ color: '#fff' }}>
            Output {output.status === 'success' && '✓'}
          </Typography>
          
          <Box sx={{ 
            fontFamily: 'monospace', 
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '14px',
            backgroundColor: '#2d2d2d',
            p: 2,
            borderRadius: 1,
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {output.stdout}
          </Box>
          
          {output.stderr && (
            <Box sx={{ 
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '14px',
              color: '#ff6b6b',
              mt: 2 
            }}>
              {output.stderr}
            </Box>
          )}
          
          <Typography variant="body2" sx={{ mt: 1, color: '#888' }}>
            Execution time: {output.executionTime}
          </Typography>
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default CodeEditor;
