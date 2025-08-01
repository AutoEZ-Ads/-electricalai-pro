import mondaySdk from 'monday-sdk-js';

class MondayService {
  constructor() {
    this.monday = null;
    this.initialized = false;
  }

  initialize(mondayInstance) {
    this.monday = mondayInstance;
    this.initialized = true;
    console.log('🔧 MondayService initialized successfully');
  }

  _ensureInitialized() {
    if (!this.initialized || !this.monday) {
      throw new Error('MondayService not initialized. Call initialize() first.');
    }
  }

  /**
   * Get item details by ID
   * @param {string} itemId - Monday item ID
   * @returns {Promise<Object>} Item data
   */
  async getItem(itemId) {
    this._ensureInitialized();
    
    try {
      console.log(`📊 Getting item data for ID: ${itemId}`);
      
      const query = `
        query {
          items(ids: [${itemId}]) {
            id
            name
            state
            created_at
            updated_at
            board {
              id
              name
            }
            group {
              id
              title
            }
            column_values {
              id
              title
              text
              type
              value
            }
            assets {
              id
              name
              url
              file_extension
              created_at
            }
          }
        }
      `;

      const response = await this.monday.api(query);
      
      if (response.errors) {
        throw new Error(`Monday API Error: ${response.errors[0].message}`);
      }

      const item = response.data.items[0];
      if (!item) {
        throw new Error(`Item with ID ${itemId} not found`);
      }

      console.log('✅ Item data retrieved successfully');
      return item;

    } catch (error) {
      console.error('❌ Failed to get item:', error);
      throw error;
    }
  }

  /**
   * Get board columns
   * @param {string} boardId - Monday board ID
   * @returns {Promise<Array>} Board columns
   */
  async getBoardColumns(boardId) {
    this._ensureInitialized();
    
    try {
      console.log(`📋 Getting board columns for ID: ${boardId}`);
      
      const query = `
        query {
          boards(ids: [${boardId}]) {
            id
            name
            columns {
              id
              title
              type
              settings_str
            }
          }
        }
      `;

      const response = await this.monday.api(query);
      
      if (response.errors) {
        throw new Error(`Monday API Error: ${response.errors[0].message}`);
      }

      const board = response.data.boards[0];
      if (!board) {
        throw new Error(`Board with ID ${boardId} not found`);
      }

      console.log('✅ Board columns retrieved successfully');
      return board.columns;

    } catch (error) {
      console.error('❌ Failed to get board columns:', error);
      throw error;
    }
  }

  /**
   * Update item column values
   * @param {string} itemId - Monday item ID
   * @param {Object} columnValues - Column values to update
   * @returns {Promise<Object>} Updated item data
   */
  async updateItemColumns(itemId, columnValues) {
    this._ensureInitialized();
    
    try {
      console.log(`📝 Updating item columns for ID: ${itemId}`, columnValues);
      
      // Convert column values to Monday format
      const formattedValues = this._formatColumnValues(columnValues);
      
      const mutation = `
        mutation {
          change_multiple_column_values(
            item_id: ${itemId},
            board_id: null,
            column_values: "${JSON.stringify(formattedValues).replace(/"/g, '\\"')}"
          ) {
            id
            name
            column_values {
              id
              title
              text
              value
            }
          }
        }
      `;

      const response = await this.monday.api(mutation);
      
      if (response.errors) {
        throw new Error(`Monday API Error: ${response.errors[0].message}`);
      }

      console.log('✅ Item columns updated successfully');
      return response.data.change_multiple_column_values;

    } catch (error) {
      console.error('❌ Failed to update item columns:', error);
      throw error;
    }
  }

  /**
   * Upload file to Monday item
   * @param {File} file - File to upload
   * @param {string} itemId - Monday item ID
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(file, itemId) {
    this._ensureInitialized();
    
    try {
      console.log(`📎 Uploading file "${file.name}" to item ${itemId}`);
      
      const formData = new FormData();
      formData.append('query', `
        mutation add_file($file: File!) {
          add_file_to_column(
            item_id: ${itemId},
            column_id: "files",
            file: $file
          ) {
            id
            name
            url
            file_extension
            created_at
          }
        }
      `);
      formData.append('variables[file]', file);

      const response = await fetch('https://api.monday.com/v2/file', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.monday.get('token')}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`Upload Error: ${result.errors[0].message}`);
      }

      console.log('✅ File uploaded successfully');
      return result.data.add_file_to_column;

    } catch (error) {
      console.error('❌ File upload failed:', error);
      throw error;
    }
  }

  /**
   * Create new item in board
   * @param {string} boardId - Monday board ID
   * @param {string} itemName - Name for the new item
   * @param {Object} columnValues - Initial column values
   * @returns {Promise<Object>} Created item data
   */
  async createItem(boardId, itemName, columnValues = {}) {
    this._ensureInitialized();
    
    try {
      console.log(`➕ Creating new item "${itemName}" in board ${boardId}`);
      
      const formattedValues = this._formatColumnValues(columnValues);
      
      const mutation = `
        mutation {
          create_item(
            board_id: ${boardId},
            item_name: "${itemName}",
            column_values: "${JSON.stringify(formattedValues).replace(/"/g, '\\"')}"
          ) {
            id
            name
            created_at
            column_values {
              id
              title
              text
              value
            }
          }
        }
      `;

      const response = await this.monday.api(mutation);
      
      if (response.errors) {
        throw new Error(`Monday API Error: ${response.errors[0].message}`);
      }

      console.log('✅ Item created successfully');
      return response.data.create_item;

    } catch (error) {
      console.error('❌ Failed to create item:', error);
      throw error;
    }
  }

  /**
   * Get board items with filters
   * @param {string} boardId - Monday board ID
   * @param {Object} options - Query options (limit, page, etc.)
   * @returns {Promise<Array>} Board items
   */
  async getBoardItems(boardId, options = {}) {
    this._ensureInitialized();
    
    try {
      console.log(`📋 Getting board items for ID: ${boardId}`);
      
      const { limit = 50, page = 1 } = options;
      
      const query = `
        query {
          boards(ids: [${boardId}]) {
            id
            name
            items(limit: ${limit}, page: ${page}) {
              id
              name
              state
              created_at
              updated_at
              group {
                id
                title
              }
              column_values {
                id
                title
                text
                type
                value
              }
            }
          }
        }
      `;

      const response = await this.monday.api(query);
      
      if (response.errors) {
        throw new Error(`Monday API Error: ${response.errors[0].message}`);
      }

      const board = response.data.boards[0];
      if (!board) {
        throw new Error(`Board with ID ${boardId} not found`);
      }

      console.log('✅ Board items retrieved successfully');
      return board.items;

    } catch (error) {
      console.error('❌ Failed to get board items:', error);
      throw error;
    }
  }

  /**
   * Add update to item
   * @param {string} itemId - Monday item ID
   * @param {string} updateText - Update text content
   * @returns {Promise<Object>} Created update
   */
  async addItemUpdate(itemId, updateText) {
    this._ensureInitialized();
    
    try {
      console.log(`💬 Adding update to item ${itemId}`);
      
      const mutation = `
        mutation {
          create_update(
            item_id: ${itemId},
            body: "${updateText.replace(/"/g, '\\"')}"
          ) {
            id
            body
            created_at
            creator {
              id
              name
            }
          }
        }
      `;

      const response = await this.monday.api(mutation);
      
      if (response.errors) {
        throw new Error(`Monday API Error: ${response.errors[0].message}`);
      }

      console.log('✅ Update added successfully');
      return response.data.create_update;

    } catch (error) {
      console.error('❌ Failed to add update:', error);
      throw error;
    }
  }

  /**
   * Get current user information
   * @returns {Promise<Object>} User data
   */
  async getCurrentUser() {
    this._ensureInitialized();
    
    try {
      console.log('👤 Getting current user information');
      
      const query = `
        query {
          me {
            id
            name
            email
            photo_original
            created_at
            time_zone_identifier
            is_admin
          }
        }
      `;

      const response = await this.monday.api(query);
      
      if (response.errors) {
        throw new Error(`Monday API Error: ${response.errors[0].message}`);
      }

      console.log('✅ User information retrieved successfully');
      return response.data.me;

    } catch (error) {
      console.error('❌ Failed to get user information:', error);
      throw error;
    }
  }

  /**
   * Search items across boards
   * @param {string} searchTerm - Search term
   * @param {Array} boardIds - Board IDs to search in (optional)
   * @returns {Promise<Array>} Search results
   */
  async searchItems(searchTerm, boardIds = []) {
    this._ensureInitialized();
    
    try {
      console.log(`🔍 Searching for items: "${searchTerm}"`);
      
      let boardFilter = '';
      if (boardIds.length > 0) {
        boardFilter = `board_ids: [${boardIds.join(',')}],`;
      }
      
      const query = `
        query {
          items(
            ${boardFilter}
            limit: 25
          ) {
            id
            name
            board {
              id
              name
            }
            column_values {
              id
              title
              text
              value
            }
          }
        }
      `;

      const response = await this.monday.api(query);
      
      if (response.errors) {
        throw new Error(`Monday API Error: ${response.errors[0].message}`);
      }

      // Filter results by search term (Monday API doesn't have built-in search)
      const filteredItems = response.data.items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.column_values.some(col => 
          col.text && col.text.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );

      console.log(`✅ Found ${filteredItems.length} matching items`);
      return filteredItems;

    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  /**
   * Format column values for Monday API
   * @param {Object} columnValues - Raw column values
   * @returns {Object} Formatted column values
   * @private
   */
  _formatColumnValues(columnValues) {
    const formatted = {};
    
    Object.keys(columnValues).forEach(key => {
      const value = columnValues[key];
      
      // Handle different column types
      if (typeof value === 'string') {
        formatted[key] = value;
      } else if (typeof value === 'number') {
        formatted[key] = value.toString();
      } else if (typeof value === 'boolean') {
        formatted[key] = { checked: value };
      } else if (Array.isArray(value)) {
        formatted[key] = { tags: value };
      } else if (value && typeof value === 'object') {
        formatted[key] = value;
      }
    });
    
    return formatted;
  }

  /**
   * Get webhook events for the app
   * @returns {Promise<Array>} Webhook events
   */
  async getWebhooks() {
    this._ensureInitialized();
    
    try {
      console.log('🔗 Getting webhook events');
      
      const query = `
        query {
          webhooks {
            id
            board_id
            url
            event
            config
          }
        }
      `;

      const response = await this.monday.api(query);
      
      if (response.errors) {
        throw new Error(`Monday API Error: ${response.errors[0].message}`);
      }

      console.log('✅ Webhooks retrieved successfully');
      return response.data.webhooks;

    } catch (error) {
      console.error('❌ Failed to get webhooks:', error);
      throw error;
    }
  }

  /**
   * Test Monday API connectivity
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    this._ensureInitialized();
    
    try {
      console.log('🔍 Testing Monday API connection');
      
      const query = `query { me { id name } }`;
      const response = await this.monday.api(query);
      
      if (response.errors) {
        throw new Error(`Connection failed: ${response.errors[0].message}`);
      }

      console.log('✅ Monday API connection successful');
      return true;

    } catch (error) {
      console.error('❌ Monday API connection failed:', error);
      return false;
    }
  }
}

// Export singleton instance
const mondayService = new MondayService();
export { mondayService as MondayService };