import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  SafeAreaView,
  Image,
  TextInput,
  Switch
} from 'react-native';
import { 
  Camera,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Zap,
  FileText,
  Settings,
  Download,
  Upload,
  Wifi,
  WifiOff
} from 'lucide-react-native';

const ElectricalFieldApp = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [currentProject, setCurrentProject] = useState(null);
  const [activePhase, setActivePhase] = useState('rough-in');
  const [completedTasks, setCompletedTasks] = useState(new Set());

  // Sample project data
  const project = {
    name: "Metro Tech Office - 3rd Floor",
    id: "MTG-2025-001",
    phase: "Rough-In Work",
    completion: 67,
    location: "Grid B3 + (6.5\", -2.0\")",
    lastUpdate: "2 hours ago"
  };

  const phases = [
    {
      id: 'rough-in',
      name: 'Rough-In Work',
      status: 'in-progress',
      completion: 67,
      tasks: [
        { id: 1, name: 'Install Main Distribution Panel', location: 'Grid D4 + (0", 0")', completed: true, safety: 'high' },
        { id: 2, name: 'Office Outlet Circuits A1-A16', location: 'Grid A1-C5', completed: true, safety: 'medium' },
        { id: 3, name: 'Lighting Circuits Installation', location: 'All zones', completed: false, safety: 'high' },
        { id: 4, name: 'Fire Alarm System Components', location: 'Per FA-3 plan', completed: false, safety: 'critical' }
      ]
    },
    {
      id: 'trim-out',
      name: 'Trim-Out Work',
      status: 'pending',
      completion: 0,
      tasks: [
        { id: 5, name: 'Install Office Outlets & USB Stations', location: 'All offices', completed: false, safety: 'medium' },
        { id: 6, name: 'Lighting Control Switches', location: 'Each room', completed: false, safety: 'medium' },
        { id: 7, name: 'Conference Room AV Outlets', location: 'Rooms A, B, C', completed: false, safety: 'low' }
      ]
    },
    {
      id: 'final',
      name: 'Final & Testing',
      status: 'pending',
      completion: 0,
      tasks: [
        { id: 8, name: 'Panel Schedule Setup', location: 'E3-3F Panel', completed: false, safety: 'high' },
        { id: 9, name: 'Circuit Testing & Documentation', location: 'All circuits', completed: false, safety: 'high' },
        { id: 10, name: 'Final Inspection Prep', location: 'Entire floor', completed: false, safety: 'medium' }
      ]
    }
  ];

  const safetyLevels = {
    low: { color: '#10B981', icon: '●' },
    medium: { color: '#F59E0B', icon: '▲' },
    high: { color: '#EF4444', icon: '■' },
    critical: { color: '#7C2D12', icon: '♦' }
  };

  const toggleTaskCompletion = (taskId) => {
    const newCompleted = new Set(completedTasks);
    if (newCompleted.has(taskId)) {
      newCompleted.delete(taskId);
    } else {
      newCompleted.add(taskId);
    }
    setCompletedTasks(newCompleted);
  };

  const getCurrentPhase = () => {
    return phases.find(phase => phase.id === activePhase) || phases[0];
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.appTitle}>ElectricalAI Field</Text>
        <View style={styles.statusContainer}>
          {isOnline ? (
            <Wifi size={16} color="#10B981" />
          ) : (
            <WifiOff size={16} color="#EF4444" />
          )}
          <Text style={[styles.statusText, { color: isOnline ? '#10B981' : '#EF4444' }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
      
      <View style={styles.projectInfo}>
        <Text style={styles.projectName}>{project.name}</Text>
        <Text style={styles.projectId}>Project: {project.id}</Text>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>{project.completion}% Complete</Text>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { width: `${project.completion}%` }]} 
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderPhaseSelector = () => (
    <View style={styles.phaseSelector}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {phases.map((phase) => (
          <TouchableOpacity
            key={phase.id}
            style={[
              styles.phaseButton,
              activePhase === phase.id && styles.phaseButtonActive
            ]}
            onPress={() => setActivePhase(phase.id)}
          >
            <Text style={[
              styles.phaseButtonText,
              activePhase === phase.id && styles.phaseButtonTextActive
            ]}>
              {phase.name}
            </Text>
            <Text style={[
              styles.phaseCompletion,
              activePhase === phase.id && styles.phaseCompletionActive
            ]}>
              {phase.completion}%
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderTaskItem = (task) => {
    const isCompleted = completedTasks.has(task.id) || task.completed;
    const safetyInfo = safetyLevels[task.safety];
    
    return (
      <TouchableOpacity
        key={task.id}
        style={[styles.taskItem, isCompleted && styles.taskItemCompleted]}
        onPress={() => toggleTaskCompletion(task.id)}
      >
        <View style={styles.taskHeader}>
          <View style={styles.taskStatus}>
            <CheckCircle 
              size={20} 
              color={isCompleted ? '#10B981' : '#9CA3AF'} 
              fill={isCompleted ? '#10B981' : 'transparent'}
            />
            <View style={styles.taskInfo}>
              <Text style={[styles.taskName, isCompleted && styles.taskNameCompleted]}>
                {task.name}
              </Text>
              <View style={styles.taskDetails}>
                <MapPin size={12} color="#6B7280" />
                <Text style={styles.taskLocation}>{task.location}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.safetyIndicator}>
            <Text style={[styles.safetyIcon, { color: safetyInfo.color }]}>
              {safetyInfo.icon}
            </Text>
          </View>
        </View>
        
        <View style={styles.taskActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Camera size={16} color="#6B7280" />
            <Text style={styles.actionText}>Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <FileText size={16} color="#6B7280" />
            <Text style={styles.actionText}>Guide</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <AlertTriangle size={16} color="#6B7280" />
            <Text style={styles.actionText}>Report</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCurrentPhase = () => {
    const currentPhase = getCurrentPhase();
    
    return (
      <View style={styles.phaseContent}>
        <View style={styles.phaseHeader}>
          <Text style={styles.phaseTitle}>{currentPhase.name}</Text>
          <Text style={styles.phaseStatus}>
            {currentPhase.tasks.filter(t => t.completed || completedTasks.has(t.id)).length} of {currentPhase.tasks.length} tasks complete
          </Text>
        </View>
        
        <ScrollView style={styles.tasksList}>
          {currentPhase.tasks.map(renderTaskItem)}
        </ScrollView>
      </View>
    );
  };

  const renderQuickActions = () => (
    <View style={styles.quickActions}>
      <TouchableOpacity style={styles.quickActionButton}>
        <Download size={20} color="#3B82F6" />
        <Text style={styles.quickActionText}>Sync Data</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.quickActionButton}>
        <Zap size={20} color="#F59E0B" />
        <Text style={styles.quickActionText}>Safety Check</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.quickActionButton}>
        <FileText size={20} color="#10B981" />
        <Text style={styles.quickActionText}>Daily Report</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.quickActionButton}>
        <Settings size={20} color="#6B7280" />
        <Text style={styles.quickActionText}>Settings</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderPhaseSelector()}
      {renderCurrentPhase()}
      {renderQuickActions()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  
  // Header Styles
  header: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  projectInfo: {
    gap: 4,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  projectId: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressText: {
    fontSize: 12,
    color: '#D1D5DB',
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  
  // Phase Selector Styles
  phaseSelector: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  phaseButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    minWidth: 100,
  },
  phaseButtonActive: {
    backgroundColor: '#3B82F6',
  },
  phaseButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  phaseButtonTextActive: {
    color: '#FFFFFF',
  },
  phaseCompletion: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 2,
  },
  phaseCompletionActive: {
    color: '#DBEAFE',
  },
  
  // Phase Content Styles
  phaseContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  phaseHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  phaseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  phaseStatus: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  
  // Tasks List Styles
  tasksList: {
    flex: 1,
  },
  taskItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  taskItemCompleted: {
    backgroundColor: '#F0FDF4',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  taskNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#6B7280',
  },
  taskDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskLocation: {
    fontSize: 12,
    color: '#6B7280',
  },
  safetyIndicator: {
    alignItems: 'center',
  },
  safetyIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Task Actions Styles
  taskActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
  },
  actionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  
  // Quick Actions Styles
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quickActionButton: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickActionText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
});

export default ElectricalFieldApp;