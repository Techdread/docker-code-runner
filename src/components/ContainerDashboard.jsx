import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';
import TerminalIcon from '@mui/icons-material/Terminal';
import { dockerService } from '../services/dockerService';

const SUPPORTED_LANGUAGES = ['JavaScript', 'Python', 'Java', 'C++'];

const ContainerDashboard = () => {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [logs, setLogs] = useState('');
  const [logsOpen, setLogsOpen] = useState(false);

  const fetchContainers = async () => {
    try {
      setLoading(true);
      const data = await dockerService.getContainers();
      setContainers(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch containers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleStartContainer = async (language) => {
    try {
      setLoading(true);
      await dockerService.startContainer(language);
      fetchContainers();
      setError(null);
    } catch (err) {
      setError(`Failed to start ${language} container`);
    } finally {
      setLoading(false);
    }
  };

  const handleStopContainer = async (containerId) => {
    try {
      setLoading(true);
      await dockerService.stopContainer(containerId);
      fetchContainers();
      setError(null);
    } catch (err) {
      setError(`Failed to stop container`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLogs = async (container) => {
    try {
      setSelectedContainer(container);
      const logs = await dockerService.getContainerLogs(container.id);
      setLogs(logs);
      setLogsOpen(true);
    } catch (err) {
      setError('Failed to fetch container logs');
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'error';
      case 'starting':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" component="h2">
          Container Status
        </Typography>
        <IconButton onClick={fetchContainers} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Container ID</TableCell>
              <TableCell>Language</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Uptime</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">Loading...</TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} align="center" style={{ color: 'red' }}>{error}</TableCell>
              </TableRow>
            ) : containers && Array.isArray(containers) && containers.length > 0 ? (
              containers.map((container) => (
                <TableRow key={container.language}>
                  <TableCell>{container.id}</TableCell>
                  <TableCell>{container.language}</TableCell>
                  <TableCell>
                    <Chip
                      label={container.status}
                      color={getStatusColor(container.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{container.uptime || '0m'}</TableCell>
                  <TableCell>
                    {container.status === 'running' ? (
                      <IconButton
                        onClick={() => handleStopContainer(container.id)}
                        disabled={loading || container.id === '-'}
                        color="error"
                        size="small"
                      >
                        <StopIcon />
                      </IconButton>
                    ) : (
                      <IconButton
                        onClick={() => handleStartContainer(container.language)}
                        disabled={loading}
                        color="success"
                        size="small"
                      >
                        <PlayArrowIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center">No containers found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Container Logs - {selectedContainer?.language}
        </DialogTitle>
        <DialogContent>
          <Paper
            sx={{
              p: 2,
              bgcolor: 'grey.900',
              color: 'grey.100',
              fontFamily: 'monospace',
              maxHeight: '400px',
              overflow: 'auto'
            }}
          >
            <pre style={{ margin: 0 }}>{logs}</pre>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContainerDashboard;
