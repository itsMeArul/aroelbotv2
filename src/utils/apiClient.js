require('dotenv').config();
const fetch = require('node-fetch');
const { PelindaJS } = require('pelindajs');

const API_TIMEOUT = 5000;
const API_BASE = 'https://pandadevelopment.net/api';

class ApiClient {
  constructor() {
    this.apiKey = process.env.API_KEY;
    this.pelinda = null;
  }

  async initializePelinda() {
    if (!this.pelinda) {
      this.pelinda = await PelindaJS.new(this.apiKey);
    }
    return this.pelinda;
  }

  async makeRequest(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  async getUserKey(userId) {
    try {
      const keyResult = await this.fetchKeyWithFallback(userId);

      if (!keyResult.success || !keyResult.keyInfo) {
        return null;
      }

      const keyInfo = keyResult.keyInfo;
      return {
        key: keyInfo.value || keyInfo.id || keyInfo.key,
        userId: keyInfo.note || userId,
        isPremium: keyInfo.isPremium || false,
        expiresAt: keyInfo.expiresAt ? new Date(keyInfo.expiresAt).toLocaleDateString() : null,
        createdAt: keyInfo.createdAt ? new Date(keyInfo.createdAt).toLocaleDateString() : null,
        hwid: keyInfo.hwid || null,
        endpoint: keyResult.endpoint
      };
    } catch (error) {
      console.error('❌ Error getting user key:', error);
      return null;
    }
  }

  async fetchKeyWithFallback(keyOrUserId) {
    try {
      const activeKeyUrl = `${API_BASE}/key/fetch?apiKey=${this.apiKey}&fetch=${keyOrUserId}`;
      let activeKeyResponse;

      try {
        activeKeyResponse = await this.makeRequest(activeKeyUrl);
      } catch (error) {
        console.log('🔄 Active key not found, trying generated key...');
      }

      if (activeKeyResponse && (activeKeyResponse.key || (activeKeyResponse.data && activeKeyResponse.data.key))) {
        return {
          success: true,
          endpoint: 'active',
          keyInfo: activeKeyResponse.key || activeKeyResponse.data.key
        };
      }

      const generatedKeyUrl = `${API_BASE}/generated-key/fetch?apiKey=${this.apiKey}&fetch=${keyOrUserId}`;
      const generatedKeyResponse = await this.makeRequest(generatedKeyUrl);

      if (generatedKeyResponse && (generatedKeyResponse.generatedKey || (generatedKeyResponse.data && generatedKeyResponse.data.generatedKey))) {
        return {
          success: true,
          endpoint: 'generated',
          keyInfo: generatedKeyResponse.generatedKey || generatedKeyResponse.data.generatedKey
        };
      }

      return {
        success: false,
        error: 'No key found'
      };
    } catch (error) {
      console.error('❌ Error in fetchKeyWithFallback:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateLicenseKey(options) {
    try {
      const pelinda = await this.initializePelinda();

      const result = await pelinda.generateKey({
        expire: options.expireDate,
        note: options.userId,
        count: 1,
        isPremium: true,
        expiresByDaysKey: true,
        daysKeys: options.days
      });

      if (result.success && result.generatedKeys && result.generatedKeys[0]) {
        return {
          success: true,
          key: result.generatedKeys[0].value
        };
      }

      return {
        success: false,
        error: result.message || 'Failed to generate key'
      };
    } catch (error) {
      console.error('❌ Error generating license key:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async extendLicense(options) {
    try {
      const currentKey = await this.getUserKey(options.userId);
      if (!currentKey) {
        return {
          success: false,
          error: 'No existing key found'
        };
      }

      const totalDays = currentKey.endpoint === 'generated' ?
        options.additionalDays :
        (parseInt(currentKey.expiresAt) || 0) + options.additionalDays;

      const updateUrl = currentKey.endpoint === 'generated' ?
        `${API_BASE}/generated-key/edit` :
        `${API_BASE}/key/edit`;

      const updateBody = {
        apiKey: this.apiKey,
        keyValue: options.keyValue,
        expiresByDaysKey: true,
        daysKey: totalDays,
        note: options.userId,
        isPremium: true
      };

      const response = await this.makeRequest(updateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      });

      const newExpireDate = new Date();
      newExpireDate.setDate(newExpireDate.getDate() + totalDays);

      return {
        success: true,
        totalDays,
        newExpiryDate: newExpireDate.toLocaleDateString()
      };
    } catch (error) {
      console.error('❌ Error extending license:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async resetHWID(keyValue) {
    try {
      const url = `${API_BASE}/reset-hwid?service=aroelhub&key=${keyValue}`;
      const response = await this.makeRequest(url);

      if (response.error && response.error.includes('Cooldown active')) {
        const cooldownMatch = response.error.match(/(\d+(?:\.\d+)?)\s+minutes/);
        if (cooldownMatch) {
          const cooldownMinutes = parseFloat(cooldownMatch[1]);
          const cooldownHours = Math.floor(cooldownMinutes / 60);
          const remainingMinutes = Math.round(cooldownMinutes % 60);

          let cooldownText = '';
          if (cooldownHours > 0) {
            cooldownText = `${cooldownHours}h ${remainingMinutes}m`;
          } else {
            cooldownText = `${remainingMinutes} minutes`;
          }

          return {
            success: false,
            cooldown: true,
            cooldownText
          };
        }
      }

      return {
        success: true,
        cooldown: false
      };
    } catch (error) {
      console.error('❌ Error resetting HWID:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getExecutionCount() {
    try {
      const url = `${API_BASE}/execution-count?apiKey=${this.apiKey}`;
      const response = await this.makeRequest(url);
      return response.executionCount || 0;
    } catch (error) {
      console.error('❌ Error getting execution count:', error);
      return 0;
    }
  }
}

module.exports = new ApiClient();