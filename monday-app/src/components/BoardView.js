import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Box,
  Flex,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Loader,
  Text,
  Heading,
  Badge,
  IconButton,
  SearchBar,
  Dropdown,
  Card,
  ProgressBar,
  Avatar,
  Tooltip
} from '@vibe/core';
import {
  Add,
  Refresh,
  Filter,
  Export,
  Eye,
  Calculator,
  CheckCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  FileText,
  Users
} from '@vibe/core/icons';

import { useAppContext } from '../contexts/AppContext';
import { MondayService } from '../services/MondayService';
import { N8NService } from '../services/N8NService';
import { formatCurrency, formatDate, getStatusColor } from '../utils/helpers';

const BoardView = ({ context, settings, monday }) => {
  const { user } = useAppContext();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Get board items with real-time updates
  const { 
    data: boardItems = [], 
    isLoading: itemsLoading, 
    error: itemsError,
    refetch: refetchItems 
  } = useQuery(
    ['board-items', context?.boardId, statusFilter],
    () => MondayService.getBoardItems(context.boardId, { limit: 100 }),
    {
      enabled: !!context?.boardId,
      staleTime: 30000, // 30 seconds
      refetchInterval: 60000, // Refresh every minute
      onError: (error) => {
        console.error('Failed to load board items:', error);
      }
    }
  );

  // Get board columns for dynamic rendering
  const { data: boardColumns = [] } = useQuery(
    ['board-columns', context?.boardId],
    () => MondayService.getBoardColumns(context.boardId),
    {
      enabled: !!context?.boardId,
      staleTime: 300000 // 5 minutes
    }
  );

  // Batch estimation mutation
  const batchEstimationMutation = useMutation(
    async (itemIds) => {
      setBatchProcessing(true);
      
      const workflows = itemIds.map(itemId => ({
        id: itemId,
        type: 'estimation',
        payload: {
          projectId: itemId,
          projectType: 'residential', // Default, can be enhanced
          source: 'monday-batch-board-view'
        }
      }));

      const results = await N8NService.triggerBatchWorkflows(workflows);
      return results;
    },
    {
      onSuccess: (results) => {
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`✅ Batch estimation completed: ${successful} successful, ${failed} failed`);
        
        // Refresh board items to show updates
        refetchItems();
        
        // Reset selection
        setSelectedItems([]);
      },
      onError: (error) => {
        console.error('❌ Batch estimation failed:', error);
      },
      onSettled: () => {
        setBatchProcessing(false);
      }
    }
  );

  // Create new estimation item mutation
  const createItemMutation = useMutation(
    async (itemData) => {
      const newItem = await MondayService.createItem(
        context.boardId,
        itemData.name,
        {
          status: { label: 'New Project' },
          text: itemData.description || '',
          person: { personsAndTeams: [{ id: user.id, kind: 'person' }] },
          date: new Date().toISOString().split('T')[0]
        }
      );
      
      return newItem;
    },
    {
      onSuccess: () => {
        console.log('✅ New estimation project created');
        refetchItems();
      },
      onError: (error) => {
        console.error('❌ Failed to create project:', error);
      }
    }
  );

  // Filter items based on search and status
  const filteredItems = boardItems.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.column_values.some(col => 
        col.text && col.text.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesStatus = statusFilter === 'all' || 
      getItemStatus(item) === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Helper function to get item status
  const getItemStatus = (item) => {
    const statusColumn = item.column_values.find(col => col.type === 'color');
    if (statusColumn && statusColumn.text) {
      return statusColumn.text.toLowerCase();
    }
    return 'unknown';
  };

  // Helper function to get item cost
  const getItemCost = (item) => {
    const costColumn = item.column_values.find(col => col.type === 'numeric');
    if (costColumn && costColumn.text) {
      return parseFloat(costColumn.text.replace(/[^0-9.-]+/g, '')) || 0;
    }
    return 0;
  };

  // Helper function to check if item has estimation data
  const hasEstimationData = (item) => {
    return item.column_values.some(col => 
      col.id === 'numbers' && col.text && parseFloat(col.text) > 0
    );
  };

  const handleItemSelection = (itemId, selected) => {
    if (selected) {
      setSelectedItems(prev => [...prev, itemId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(item => item.id));
    }
  };

  const handleBatchEstimation = () => {
    if (selectedItems.length > 0) {
      batchEstimationMutation.mutate(selectedItems);
    }
  };

  const handleCreateProject = () => {
    const projectName = `Electrical Project ${new Date().toLocaleDateString()}`;
    createItemMutation.mutate({
      name: projectName,
      description: 'New electrical estimation project'
    });
  };

  const exportResults = () => {
    const exportData = filteredItems.map(item => ({
      id: item.id,
      name: item.name,
      status: getItemStatus(item),
      cost: getItemCost(item),
      created: item.created_at,
      updated: item.updated_at
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `board-export-${Date.now()}.json`;
    a.click();
  };

  if (itemsLoading) {
    return (
      <Box padding="large">
        <Flex direction="column" align="center" gap="medium">
          <Loader size="large" />
          <Text>Loading board data...</Text>
        </Flex>
      </Box>
    );
  }

  if (itemsError) {
    return (
      <Box padding="large">
        <Card>
          <Box padding="large">
            <Flex direction="column" align="center" gap="medium">
              <AlertTriangle size="large" color="negative" />
              <Heading size="medium">Failed to Load Board</Heading>
              <Text color="secondary">{itemsError.message}</Text>
              <Button onClick={refetchItems} leftIcon={Refresh}>
                Retry
              </Button>
            </Flex>
          </Box>
        </Card>
      </Box>
    );
  }

  return (
    <Box padding="large">
      {/* Header Section */}
      <Flex justify="space-between" align="center" marginBottom="large">
        <Box>
          <Heading size="large">⚡ Estimation Dashboard</Heading>
          <Text color="secondary">
            {filteredItems.length} projects • {selectedItems.length} selected
          </Text>
        </Box>
        
        <Flex gap="small">
          <Button
            size="small"
            kind="secondary"
            leftIcon={Export}
            onClick={exportResults}
          >
            Export
          </Button>
          <Button
            size="small"
            leftIcon={Add}
            onClick={handleCreateProject}
            loading={createItemMutation.isLoading}
          >
            New Project
          </Button>
        </Flex>
      </Flex>

      {/* Controls Section */}
      <Card marginBottom="medium">
        <Box padding="medium">
          <Flex gap="medium" align="center">
            <Box flex="2">
              <SearchBar
                placeholder="Search projects..."
                value={searchTerm}
                onSearchChange={setSearchTerm}
                size="small"
              />
            </Box>
            
            <Box flex="1">
              <Dropdown
                placeholder="Filter by status"
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'new project', label: 'New Projects' },
                  { value: 'in progress', label: 'In Progress' },
                  { value: 'estimated', label: 'Estimated' },
                  { value: 'completed', label: 'Completed' }
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
                size="small"
              />
            </Box>
            
            <IconButton
              icon={Refresh}
              onClick={refetchItems}
              size="small"
              tooltip="Refresh data"
            />
          </Flex>
        </Box>
      </Card>

      {/* Batch Actions */}
      {selectedItems.length > 0 && (
        <Card marginBottom="medium">
          <Box padding="medium">
            <Flex gap="medium" align="center">
              <Text weight="bold">
                {selectedItems.length} items selected
              </Text>
              
              <Button
                size="small"
                leftIcon={Calculator}
                onClick={handleBatchEstimation}
                loading={batchProcessing}
              >
                Generate Estimates
              </Button>
              
              <Button
                size="small"
                kind="secondary"
                onClick={() => setSelectedItems([])}
              >
                Clear Selection
              </Button>
            </Flex>
          </Box>
        </Card>
      )}

      {/* Main Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <input
                  type="checkbox"
                  checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                  onChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cost Estimate</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {filteredItems.map((item) => {
              const status = getItemStatus(item);
              const cost = getItemCost(item);
              const hasEstimation = hasEstimationData(item);
              const isSelected = selectedItems.includes(item.id);
              
              // Get owner from person column
              const ownerColumn = item.column_values.find(col => col.type === 'multiple-person');
              const owner = ownerColumn?.text || 'Unassigned';
              
              return (
                <TableRow key={item.id} selected={isSelected}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleItemSelection(item.id, e.target.checked)}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Flex direction="column" gap="xs">
                      <Text weight="bold">{item.name}</Text>
                      <Text size="small" color="secondary">
                        ID: {item.id}
                      </Text>
                    </Flex>
                  </TableCell>
                  
                  <TableCell>
                    <Badge color={getStatusColor(status)}>
                      {status}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <Flex align="center" gap="xs">
                      <DollarSign size="small" />
                      <Text weight={hasEstimation ? "bold" : "normal"}>
                        {cost > 0 ? formatCurrency(cost) : '—'}
                      </Text>
                      {hasEstimation && (
                        <CheckCircle size="small" color="positive" />
                      )}
                    </Flex>
                  </TableCell>
                  
                  <TableCell>
                    <ProgressBar
                      value={hasEstimation ? 75 : status === 'in progress' ? 25 : 0}
                      size="small"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Flex align="center" gap="xs">
                      <Avatar size="small" text={owner} />
                      <Text size="small">{owner}</Text>
                    </Flex>
                  </TableCell>
                  
                  <TableCell>
                    <Text size="small" color="secondary">
                      {formatDate(item.updated_at)}
                    </Text>
                  </TableCell>
                  
                  <TableCell>
                    <Flex gap="xs">
                      <Tooltip content="View details">
                        <IconButton
                          icon={Eye}
                          size="small"
                          onClick={() => {
                            // Navigate to item view
                            window.open(`/item-view?itemId=${item.id}`, '_blank');
                          }}
                        />
                      </Tooltip>
                      
                      {!hasEstimation && (
                        <Tooltip content="Generate estimate">
                          <IconButton
                            icon={Calculator}
                            size="small"
                            onClick={() => {
                              batchEstimationMutation.mutate([item.id]);
                            }}
                          />
                        </Tooltip>
                      )}
                    </Flex>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        {filteredItems.length === 0 && (
          <Box padding="large">
            <Flex direction="column" align="center" gap="medium">
              <FileText size="large" color="secondary" />
              <Heading size="medium">No Projects Found</Heading>
              <Text color="secondary">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Create your first estimation project to get started'
                }
              </Text>
              {!searchTerm && statusFilter === 'all' && (
                <Button leftIcon={Add} onClick={handleCreateProject}>
                  Create First Project
                </Button>
              )}
            </Flex>
          </Box>
        )}
      </Card>

      {/* Summary Stats */}
      <Box marginTop="large">
        <Flex gap="medium">
          <Card flex="1">
            <Box padding="medium">
              <Flex align="center" gap="small">
                <FileText color="primary" />
                <Box>
                  <Text size="small" color="secondary">Total Projects</Text>
                  <Heading size="medium">{boardItems.length}</Heading>
                </Box>
              </Flex>
            </Box>
          </Card>
          
          <Card flex="1">
            <Box padding="medium">
              <Flex align="center" gap="small">
                <CheckCircle color="positive" />
                <Box>
                  <Text size="small" color="secondary">Estimated</Text>
                  <Heading size="medium">
                    {boardItems.filter(hasEstimationData).length}
                  </Heading>
                </Box>
              </Flex>
            </Box>
          </Card>
          
          <Card flex="1">
            <Box padding="medium">
              <Flex align="center" gap="small">
                <DollarSign color="warning" />
                <Box>
                  <Text size="small" color="secondary">Total Value</Text>
                  <Heading size="medium">
                    {formatCurrency(
                      boardItems.reduce((sum, item) => sum + getItemCost(item), 0)
                    )}
                  </Heading>
                </Box>
              </Flex>
            </Box>
          </Card>
          
          <Card flex="1">
            <Box padding="medium">
              <Flex align="center" gap="small">
                <Clock color="secondary" />
                <Box>
                  <Text size="small" color="secondary">Avg. Timeline</Text>
                  <Heading size="medium">2.3 days</Heading>
                </Box>
              </Flex>
            </Box>
          </Card>
        </Flex>
      </Box>
    </Box>
  );
};

export default BoardView;