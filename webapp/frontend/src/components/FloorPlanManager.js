import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Image, 
  Zap, 
  Ruler, 
  MapPin, 
  Download, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2,
  Grid,
  Settings,
  Play,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Target
} from 'lucide-react';

const FloorPlanManager = ({ projectId }) => {
  const [floorPlans, setFloorPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [markups, setMarkups] = useState([]);
  const [activeLayer, setActiveLayer] = useState('all');
  const [markupMode, setMarkupMode] = useState(null);
  const [constructionGuide, setConstructionGuide] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [canvasContext, setCanvasContext] = useState(null);
  const [imageElement, setImageElement] = useState(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Markup tools and symbols
  const markupTools = {
    'electrical_element': {
      name: 'Electrical Elements',
      icon: Zap,
      color: '#3B82F6',
      symbols: [
        { type: 'outlet', label: '15A Outlet', symbol: '○', color: '#10B981' },
        { type: 'gfci_outlet', label: 'GFCI Outlet', symbol: '◎', color: '#F59E0B' },
        { type: 'switch', label: 'Switch', symbol: 'S', color: '#8B5CF6' },
        { type: 'three_way_switch', label: '3-Way Switch', symbol: 'S₃', color: '#8B5CF6' },
        { type: 'dimmer', label: 'Dimmer', symbol: 'D', color: '#EC4899' },
        { type: 'fixture', label: 'Light Fixture', symbol: '⊕', color: '#F97316' },
        { type: 'recessed_light', label: 'Recessed Light', symbol: '⊖', color: '#F97316' },
        { type: 'panel', label: 'Panel', symbol: '■', color: '#EF4444' },
        { type: 'junction_box', label: 'Junction Box', symbol: '□', color: '#6B7280' }
      ]
    },
    'measurement': {
      name: 'Measurements',
      icon: Ruler,
      color: '#10B981',
      tools: ['dimension', 'area', 'distance']
    },
    'axis_point': {
      name: 'Grid & Axis',
      icon: Grid,
      color: '#6B7280',
      tools: ['horizontal_axis', 'vertical_axis', 'reference_point']
    },
    'note': {
      name: 'Notes',
      icon: FileText,
      color: '#F59E0B',
      tools: ['text_note', 'callout', 'instruction']
    }
  };

  const constructionPhases = [
    { id: 'rough_in', name: 'Rough-In', color: '#EF4444', icon: Settings },
    { id: 'trim_out', name: 'Trim-Out', color: '#F59E0B', icon: Zap },
    { id: 'final', name: 'Final', color: '#10B981', icon: CheckCircle },
    { id: 'testing', name: 'Testing', color: '#8B5CF6', icon: Target }
  ];

  // Load floor plans on component mount
  useEffect(() => {
    if (projectId) {
      loadFloorPlans();
    }
  }, [projectId]);

  // Initialize canvas when plan is selected
  useEffect(() => {
    if (selectedPlan && canvasRef.current) {
      initializeCanvas();
      loadMarkups();
    }
  }, [selectedPlan]);

  const loadFloorPlans = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/floorplans/project/${projectId}`);
      const data = await response.json();
      
      if (data.success) {
        setFloorPlans(data.data);
      }
    } catch (error) {
      console.error('Error loading floor plans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('floorplans', file);
    });

    try {
      setIsLoading(true);
      setUploadProgress(0);

      const response = await fetch(`/api/floorplans/upload/${projectId}`, {
        method: 'POST',
        body: formData,
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      const data = await response.json();
      
      if (data.success) {
        await loadFloorPlans();
        if (data.data.length > 0 && !selectedPlan) {
          setSelectedPlan(data.data[0]);
        }
      }
    } catch (error) {
      console.error('Error uploading floor plans:', error);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    setCanvasContext(ctx);

    // Load and display the floor plan image
    if (selectedPlan.file_type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => {
        // Resize canvas to fit image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Calculate initial scale to fit container
        const containerWidth = canvas.parentElement.clientWidth;
        const containerHeight = canvas.parentElement.clientHeight;
        const scaleX = containerWidth / img.width;
        const scaleY = containerHeight / img.height;
        const initialScale = Math.min(scaleX, scaleY, 1);
        
        setScale(initialScale);
        setImageElement(img);
        redrawCanvas(ctx, img, initialScale, { x: 0, y: 0 });
      };
      img.src = `/api/floorplans/image/${selectedPlan.id}`;
    }
  };

  const redrawCanvas = (ctx, img, currentScale, currentPan, currentMarkups = markups) => {
    if (!ctx || !img) return;

    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Save context state
    ctx.save();
    
    // Apply transformations
    ctx.scale(currentScale, currentScale);
    ctx.translate(currentPan.x, currentPan.y);
    
    // Draw floor plan image
    ctx.drawImage(img, 0, 0);
    
    // Draw markups
    drawMarkups(ctx, currentMarkups);
    
    // Restore context state
    ctx.restore();
  };

  const drawMarkups = (ctx, markupsToRender) => {
    markupsToRender.forEach(markup => {
      if (!markup.visible || (activeLayer !== 'all' && markup.markup_type !== activeLayer)) {
        return;
      }

      const coords = JSON.parse(markup.coordinates);
      const data = JSON.parse(markup.markup_data);
      const style = markup.style ? JSON.parse(markup.style) : {};

      ctx.save();

      switch (markup.markup_type) {
        case 'electrical_element':
          drawElectricalElement(ctx, coords, data, style);
          break;
        case 'measurement':
          drawMeasurement(ctx, coords, data, style);
          break;
        case 'axis_point':
          drawAxisPoint(ctx, coords, data, style);
          break;
        case 'note':
          drawNote(ctx, coords, data, style);
          break;
        default:
          drawGenericMarkup(ctx, coords, data, style);
      }

      ctx.restore();
    });
  };

  const drawElectricalElement = (ctx, coords, data, style) => {
    const symbol = markupTools.electrical_element.symbols.find(s => s.type === data.element_type);
    if (!symbol) return;

    ctx.fillStyle = symbol.color;
    ctx.strokeStyle = style.borderColor || '#000000';
    ctx.lineWidth = style.borderWidth || 2;
    ctx.font = style.fontSize ? `${style.fontSize}px Arial` : '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw symbol background
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, 12, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Draw symbol text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(symbol.symbol, coords.x, coords.y);

    // Draw label if present
    if (data.label) {
      ctx.fillStyle = '#000000';
      ctx.fillText(data.label, coords.x, coords.y + 20);
    }

    // Draw specifications
    if (data.voltage && data.amperage) {
      ctx.font = '10px Arial';
      ctx.fillText(`${data.voltage}V ${data.amperage}A`, coords.x, coords.y + 32);
    }
  };

  const drawMeasurement = (ctx, coords, data, style) => {
    ctx.strokeStyle = style.color || '#10B981';
    ctx.lineWidth = style.lineWidth || 2;
    ctx.setLineDash(style.lineDash || [5, 5]);

    if (coords.x2 !== undefined && coords.y2 !== undefined) {
      // Draw measurement line
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.lineTo(coords.x2, coords.y2);
      ctx.stroke();

      // Draw arrowheads
      drawArrowhead(ctx, coords.x, coords.y, coords.x2, coords.y2);
      drawArrowhead(ctx, coords.x2, coords.y2, coords.x, coords.y);

      // Draw measurement value
      const midX = (coords.x + coords.x2) / 2;
      const midY = (coords.y + coords.y2) / 2;
      
      ctx.fillStyle = style.textColor || '#000000';
      ctx.font = style.fontSize ? `${style.fontSize}px Arial` : '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${data.value} ${data.unit || 'ft'}`, midX, midY - 10);
    }

    ctx.setLineDash([]);
  };

  const drawAxisPoint = (ctx, coords, data, style) => {
    ctx.strokeStyle = style.color || '#6B7280';
    ctx.fillStyle = style.fillColor || '#F3F4F6';
    ctx.lineWidth = style.lineWidth || 1;

    // Draw axis point marker
    ctx.beginPath();
    ctx.rect(coords.x - 8, coords.y - 8, 16, 16);
    ctx.fill();
    ctx.stroke();

    // Draw axis label
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.label || 'A1', coords.x, coords.y);

    // Draw axis lines if specified
    if (data.axis_type === 'horizontal') {
      ctx.beginPath();
      ctx.moveTo(0, coords.y);
      ctx.lineTo(ctx.canvas.width, coords.y);
      ctx.stroke();
    } else if (data.axis_type === 'vertical') {
      ctx.beginPath();
      ctx.moveTo(coords.x, 0);
      ctx.lineTo(coords.x, ctx.canvas.height);
      ctx.stroke();
    }
  };

  const drawNote = (ctx, coords, data, style) => {
    ctx.fillStyle = style.backgroundColor || '#FEF3C7';
    ctx.strokeStyle = style.borderColor || '#F59E0B';
    ctx.lineWidth = style.borderWidth || 1;

    // Measure text to size note box
    ctx.font = style.fontSize ? `${style.fontSize}px Arial` : '12px Arial';
    const textMetrics = ctx.measureText(data.text || 'Note');
    const padding = 8;
    const width = textMetrics.width + padding * 2;
    const height = 24;

    // Draw note background
    ctx.beginPath();
    ctx.rect(coords.x - width/2, coords.y - height/2, width, height);
    ctx.fill();
    ctx.stroke();

    // Draw note text
    ctx.fillStyle = style.textColor || '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.text || 'Note', coords.x, coords.y);
  };

  const drawGenericMarkup = (ctx, coords, data, style) => {
    ctx.fillStyle = style.color || '#3B82F6';
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, 6, 0, 2 * Math.PI);
    ctx.fill();
  };

  const drawArrowhead = (ctx, fromX, fromY, toX, toY) => {
    const headSize = 8;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headSize * Math.cos(angle - Math.PI/6),
      toY - headSize * Math.sin(angle - Math.PI/6)
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headSize * Math.cos(angle + Math.PI/6),
      toY - headSize * Math.sin(angle + Math.PI/6)
    );
    ctx.stroke();
  };

  const loadMarkups = async () => {
    if (!selectedPlan) return;

    try {
      const response = await fetch(`/api/floorplans/${selectedPlan.id}/markups`);
      const data = await response.json();
      
      if (data.success) {
        setMarkups(data.data);
      }
    } catch (error) {
      console.error('Error loading markups:', error);
    }
  };

  const handleCanvasClick = async (event) => {
    if (!markupMode || !canvasContext) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale - pan.x;
    const y = (event.clientY - rect.top) / scale - pan.y;

    // Create markup based on selected tool
    const markupData = createMarkupData(markupMode, { x, y });
    
    try {
      const response = await fetch(`/api/floorplans/${selectedPlan.id}/markup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          markupType: markupMode.type,
          coordinates: { x, y },
          data: markupData,
          description: markupData.description
        })
      });

      const data = await response.json();
      
      if (data.success) {
        await loadMarkups();
      }
    } catch (error) {
      console.error('Error adding markup:', error);
    }
  };

  const createMarkupData = (mode, coordinates) => {
    switch (mode.type) {
      case 'electrical_element':
        return {
          element_type: mode.subtype,
          voltage: 120,
          amperage: 15,
          label: mode.label,
          description: `${mode.label} at (${coordinates.x.toFixed(1)}, ${coordinates.y.toFixed(1)})`
        };
      case 'measurement':
        return {
          measurement_type: mode.subtype,
          value: 0,
          unit: 'ft',
          description: `${mode.subtype} measurement`
        };
      case 'axis_point':
        return {
          axis_type: mode.subtype,
          label: mode.label || 'A1',
          description: `${mode.subtype} axis point`
        };
      case 'note':
        return {
          text: mode.text || 'Note',
          description: 'Floor plan note'
        };
      default:
        return { description: 'Generic markup' };
    }
  };

  const generateConstructionGuide = async () => {
    if (!selectedPlan) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/floorplans/${selectedPlan.id}/construction-guide`);
      const data = await response.json();
      
      if (data.success) {
        setConstructionGuide(data.data);
      }
    } catch (error) {
      console.error('Error generating construction guide:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const autoDetectElements = async () => {
    if (!selectedPlan) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/floorplans/${selectedPlan.id}/auto-detect`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadMarkups();
      }
    } catch (error) {
      console.error('Error auto-detecting elements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Floor Plan Manager</h1>
          
          <div className="flex items-center gap-4">
            {selectedPlan && (
              <>
                <button
                  onClick={autoDetectElements}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  <Target size={16} />
                  Auto-Detect
                </button>
                
                <button
                  onClick={generateConstructionGuide}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <FileText size={16} />
                  Generate Guide
                </button>
              </>
            )}
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Upload size={16} />
              Upload Plans
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.dwg,.dxf"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Floor Plans List */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold mb-3">Floor Plans</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {floorPlans.map(plan => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`p-3 rounded-lg cursor-pointer border ${
                    selectedPlan?.id === plan.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Image size={20} className="text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {plan.plan_name || plan.original_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {plan.electrical_elements} elements • {plan.measurements} measurements
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Markup Tools */}
          {selectedPlan && (
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold mb-3">Markup Tools</h3>
              <div className="space-y-3">
                {Object.entries(markupTools).map(([key, tool]) => (
                  <div key={key}>
                    <button
                      onClick={() => setMarkupMode(markupMode?.type === key ? null : { type: key })}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border ${
                        markupMode?.type === key
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <tool.icon size={20} style={{ color: tool.color }} />
                      <span className="text-sm font-medium">{tool.name}</span>
                    </button>
                    
                    {markupMode?.type === key && tool.symbols && (
                      <div className="mt-2 ml-6 space-y-1">
                        {tool.symbols.map(symbol => (
                          <button
                            key={symbol.type}
                            onClick={() => setMarkupMode({
                              type: key,
                              subtype: symbol.type,
                              label: symbol.label
                            })}
                            className={`w-full text-left p-2 text-xs rounded hover:bg-gray-100 ${
                              markupMode?.subtype === symbol.type ? 'bg-blue-100' : ''
                            }`}
                          >
                            <span style={{ color: symbol.color }}>{symbol.symbol}</span> {symbol.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Layer Controls */}
          {selectedPlan && (
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold mb-3">Layers</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveLayer('all')}
                  className={`w-full text-left p-2 rounded ${
                    activeLayer === 'all' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <Eye size={16} className="inline mr-2" />
                  All Layers
                </button>
                
                {Object.entries(markupTools).map(([key, tool]) => (
                  <button
                    key={key}
                    onClick={() => setActiveLayer(activeLayer === key ? 'all' : key)}
                    className={`w-full text-left p-2 rounded ${
                      activeLayer === key ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    {activeLayer === key ? <Eye size={16} /> : <EyeOff size={16} />}
                    <span className="ml-2">{tool.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Construction Phases */}
          {constructionGuide && (
            <div className="p-4 flex-1 overflow-y-auto">
              <h3 className="text-lg font-semibold mb-3">Construction Phases</h3>
              <div className="space-y-3">
                {constructionGuide.instructions.map((phase, index) => (
                  <div key={phase.phase} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: constructionPhases.find(p => p.id === phase.phase)?.color }}
                      />
                      <h4 className="font-medium">{phase.title}</h4>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{phase.description}</p>
                    <div className="text-xs text-gray-500">
                      {phase.steps.length} steps
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col">
          {selectedPlan ? (
            <>
              {/* Canvas Controls */}
              <div className="bg-white border-b border-gray-200 px-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      {selectedPlan.original_name}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setScale(Math.min(scale * 1.2, 5))}
                        className="p-1 text-gray-600 hover:text-gray-900"
                      >
                        <Plus size={16} />
                      </button>
                      <span className="text-xs text-gray-500 min-w-12">
                        {Math.round(scale * 100)}%
                      </span>
                      <button
                        onClick={() => setScale(Math.max(scale / 1.2, 0.1))}
                        className="p-1 text-gray-600 hover:text-gray-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {markupMode && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {markupMode.label || markupTools[markupMode.type]?.name} Mode
                      </span>
                    )}
                    <span>{markups.length} markups</span>
                  </div>
                </div>
              </div>

              {/* Canvas */}
              <div className="flex-1 overflow-hidden relative bg-gray-100">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="absolute inset-0 cursor-crosshair"
                  style={{
                    transform: `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`,
                    transformOrigin: '0 0'
                  }}
                />
                
                {isLoading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span>Processing...</span>
                      </div>
                      {uploadProgress > 0 && (
                        <div className="mt-3">
                          <div className="w-48 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Image size={64} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Floor Plan Selected</h3>
                <p className="text-gray-600 mb-4">Upload a floor plan to get started</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Upload Floor Plan
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Construction Guide Panel */}
        {constructionGuide && (
          <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Construction Guide</h2>
                <button
                  onClick={() => {
                    const markdown = generateConstructionMarkdown(constructionGuide);
                    downloadFile(markdown, `${selectedPlan.original_name}_guide.md`, 'text/markdown');
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Download size={16} />
                  Download
                </button>
              </div>

              {/* Project Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Project Information</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Project: {constructionGuide.floorPlan.project_name}</div>
                  <div>Plan: {constructionGuide.floorPlan.filename}</div>
                  <div>Type: {constructionGuide.floorPlan.building_type}</div>
                  <div>Generated: {new Date(constructionGuide.generatedAt).toLocaleString()}</div>
                </div>
              </div>

              {/* Phases */}
              {constructionGuide.instructions.map((phase, phaseIndex) => (
                <div key={phase.phase} className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: constructionPhases.find(p => p.id === phase.phase)?.color }}
                    />
                    <h3 className="text-lg font-semibold">{phase.title}</h3>
                  </div>
                  
                  <p className="text-gray-600 mb-4">{phase.description}</p>
                  
                  <div className="space-y-3">
                    {phase.steps.map((step, stepIndex) => (
                      <div key={stepIndex} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
                            {step.step}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium mb-2">{step.description}</p>
                            
                            {step.specifications && Object.keys(step.specifications).length > 0 && (
                              <div className="mb-3">
                                <h5 className="text-sm font-medium text-gray-700 mb-1">Specifications:</h5>
                                <div className="text-xs text-gray-600 space-y-1">
                                  {Object.entries(step.specifications).map(([key, value]) => (
                                    <div key={key}>{key}: {value}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {step.tools_required && step.tools_required.length > 0 && (
                              <div className="mb-3">
                                <h5 className="text-sm font-medium text-gray-700 mb-1">Tools Required:</h5>
                                <div className="text-xs text-gray-600">
                                  {step.tools_required.join(', ')}
                                </div>
                              </div>
                            )}
                            
                            {step.safety_notes && step.safety_notes.length > 0 && (
                              <div className="mb-3">
                                <h5 className="text-sm font-medium text-orange-700 mb-1">Safety Notes:</h5>
                                <ul className="text-xs text-orange-600 list-disc list-inside space-y-1">
                                  {step.safety_notes.map((note, noteIndex) => (
                                    <li key={noteIndex}>{note}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {step.inspection_points && step.inspection_points.length > 0 && (
                              <div>
                                <h5 className="text-sm font-medium text-green-700 mb-1">Inspection Points:</h5>
                                <ul className="text-xs text-green-600 list-disc list-inside space-y-1">
                                  {step.inspection_points.map((point, pointIndex) => (
                                    <li key={pointIndex}>{point}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Material Takeoff */}
              {constructionGuide.materialTakeoff && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Material Takeoff</h3>
                  <div className="space-y-2">
                    {Object.entries(constructionGuide.materialTakeoff.summary).map(([type, details]) => (
                      <div key={type} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <span className="font-medium">{type.replace('_', ' ')}</span>
                          <span className="text-gray-600 ml-2">({details.count})</span>
                        </div>
                        <span className="text-green-600 font-medium">
                          ${details.estimated_cost.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Total Estimated Cost</span>
                      <span className="text-green-600">
                        ${constructionGuide.materialTakeoff.total_estimated_cost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Safety Notes */}
              {constructionGuide.safetyNotes && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 text-orange-700">Safety Requirements</h3>
                  <ul className="text-sm text-orange-600 list-disc list-inside space-y-1">
                    {constructionGuide.safetyNotes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quality Checklist */}
              {constructionGuide.qualityChecklist && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-green-700">Quality Checklist</h3>
                  {constructionGuide.qualityChecklist.map((category, index) => (
                    <div key={index} className="mb-4">
                      <h4 className="text-sm font-medium text-green-700 mb-2">{category.category}</h4>
                      <ul className="text-sm text-green-600 list-disc list-inside space-y-1 ml-4">
                        {category.items.map((item, itemIndex) => (
                          <li key={itemIndex}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to generate construction guide markdown
const generateConstructionMarkdown = (guide) => {
  let markdown = `# Electrical Construction Guide\n\n`;
  markdown += `**Project:** ${guide.floorPlan.project_name}\n`;
  markdown += `**Floor Plan:** ${guide.floorPlan.filename}\n`;
  markdown += `**Building Type:** ${guide.floorPlan.building_type}\n`;
  markdown += `**Generated:** ${new Date(guide.generatedAt).toLocaleString()}\n\n`;

  // Axis System
  if (guide.axisSystem && guide.axisSystem.reference_point) {
    markdown += `## Coordinate System\n\n`;
    markdown += `**Reference Point:** (${guide.axisSystem.reference_point.x}, ${guide.axisSystem.reference_point.y})\n\n`;
    
    if (guide.axisSystem.horizontal.length > 0) {
      markdown += `**Horizontal Axes:**\n`;
      guide.axisSystem.horizontal.forEach(axis => {
        markdown += `- ${axis.label}: Y=${axis.y_position} - ${axis.description}\n`;
      });
      markdown += `\n`;
    }
    
    if (guide.axisSystem.vertical.length > 0) {
      markdown += `**Vertical Axes:**\n`;
      guide.axisSystem.vertical.forEach(axis => {
        markdown += `- ${axis.label}: X=${axis.x_position} - ${axis.description}\n`;
      });
      markdown += `\n`;
    }
  }

  // Installation Instructions
  guide.instructions.forEach((phase, phaseIndex) => {
    markdown += `## ${phase.title}\n\n`;
    markdown += `${phase.description}\n\n`;
    
    phase.steps.forEach((step, stepIndex) => {
      markdown += `### Step ${step.step}: ${step.description}\n\n`;
      
      if (step.specifications && Object.keys(step.specifications).length > 0) {
        markdown += `**Specifications:**\n`;
        Object.entries(step.specifications).forEach(([key, value]) => {
          markdown += `- ${key}: ${value}\n`;
        });
        markdown += `\n`;
      }
      
      if (step.tools_required && step.tools_required.length > 0) {
        markdown += `**Tools Required:** ${step.tools_required.join(', ')}\n\n`;
      }
      
      if (step.safety_notes && step.safety_notes.length > 0) {
        markdown += `**⚠️ Safety Notes:**\n`;
        step.safety_notes.forEach(note => {
          markdown += `- ${note}\n`;
        });
        markdown += `\n`;
      }
      
      if (step.inspection_points && step.inspection_points.length > 0) {
        markdown += `**✅ Inspection Points:**\n`;
        step.inspection_points.forEach(point => {
          markdown += `- ${point}\n`;
        });
        markdown += `\n`;
      }
      
      markdown += `---\n\n`;
    });
  });

  // Material Takeoff
  if (guide.materialTakeoff) {
    markdown += `## Material Takeoff\n\n`;
    markdown += `| Item | Quantity | Estimated Cost |\n`;
    markdown += `|------|----------|----------------|\n`;
    
    Object.entries(guide.materialTakeoff.summary).forEach(([type, details]) => {
      markdown += `| ${type.replace('_', ' ')} | ${details.count} | $${details.estimated_cost.toFixed(2)} |\n`;
    });
    
    markdown += `| **Total** | | **$${guide.materialTakeoff.total_estimated_cost.toFixed(2)}** |\n\n`;
    
    if (guide.materialTakeoff.notes) {
      markdown += `**Notes:**\n`;
      guide.materialTakeoff.notes.forEach(note => {
        markdown += `- ${note}\n`;
      });
      markdown += `\n`;
    }
  }

  // Safety Requirements
  if (guide.safetyNotes) {
    markdown += `## ⚠️ Safety Requirements\n\n`;
    guide.safetyNotes.forEach(note => {
      markdown += `- ${note}\n`;
    });
    markdown += `\n`;
  }

  // Quality Checklist
  if (guide.qualityChecklist) {
    markdown += `## ✅ Quality Checklist\n\n`;
    guide.qualityChecklist.forEach(category => {
      markdown += `### ${category.category}\n\n`;
      category.items.forEach(item => {
        markdown += `- [ ] ${item}\n`;
      });
      markdown += `\n`;
    });
  }

  return markdown;
};

// Helper function to download file
const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default FloorPlanManager;