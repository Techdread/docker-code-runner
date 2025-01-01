import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api'; // Update this with your actual backend URL

export const dockerService = {
  async getContainers() {
    try {
      const response = await axios.get(`${API_BASE_URL}/containers`);
      return response.data;
    } catch (error) {
      console.error('Error fetching containers:', error);
      throw error;
    }
  },

  async startContainer(language) {
    try {
      const response = await axios.post(`${API_BASE_URL}/containers/start`, { language });
      return response.data;
    } catch (error) {
      console.error('Error starting container:', error);
      throw error;
    }
  },

  async stopContainer(containerId) {
    try {
      const response = await axios.post(`${API_BASE_URL}/containers/stop`, { containerId });
      return response.data;
    } catch (error) {
      console.error('Error stopping container:', error);
      throw error;
    }
  },

  async getContainerLogs(containerId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/containers/${containerId}/logs`);
      return response.data;
    } catch (error) {
      console.error('Error fetching container logs:', error);
      throw error;
    }
  },

  async executeCode(language, code, input = '') {
    try {
      const response = await axios.post(`${API_BASE_URL}/execute`, {
        language,
        code,
        input,
        outputBufferLimit: 10000 // Limit output buffer on server side
      });
      return response.data;
    } catch (error) {
      console.error('Error executing code:', error);
      if (error.response?.status === 413) {
        throw new Error('Output exceeded buffer limit. Program stopped.');
      }
      throw error;
    }
  },

  async stopExecution(language) {
    try {
      const response = await axios.post(`${API_BASE_URL}/execute/stop`, {
        language,
        clearBuffer: true // Tell server to clear output buffer
      });
      return response.data;
    } catch (error) {
      console.error('Error stopping code execution:', error);
      throw error;
    }
  }
};
