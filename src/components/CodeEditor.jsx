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
  CircularProgress
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
          style: { fontFamily: 'monospace' }
        }}
        disabled={loading}
      />

      <Button
        variant="contained"
        color="primary"
        onClick={handleSubmit}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
        sx={{ mb: 2 }}
        disabled={loading}
      >
        {loading ? 'Running...' : 'Run Code'}
      </Button>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {output && (
        <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.900' }}>
          <Typography variant="h6" gutterBottom>
            Output {output.status === 'success' ? '✅' : '❌'}
          </Typography>
          <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {output.stdout || output.stderr}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Execution time: {output.executionTime}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default CodeEditor;
