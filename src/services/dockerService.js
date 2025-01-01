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

  async executeCode(language, code) {
    try {
      const response = await axios.post(`${API_BASE_URL}/execute`, {
        language,
        code
      });
      return response.data;
    } catch (error) {
      console.error('Error executing code:', error);
      throw error;
    }
  }
};
