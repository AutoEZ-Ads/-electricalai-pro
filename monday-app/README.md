# ElectricalAI Pro - Monday.com App

AI-powered electrical construction estimation with automated NEC compliance checking and real-time material cost tracking, integrated with N8N workflow automation.

## Features

### 🏠 **ItemView - Project Estimator**
- AI-powered electrical load calculations
- Floor plan analysis with OpenAI GPT-4V
- NEC 2023 compliance checking
- Real-time material cost tracking
- File upload support (PDF, DWG, images)
- Automated estimate generation

### 📊 **BoardView - Estimation Dashboard** 
- Batch estimation processing
- Project status tracking
- Cost analysis and reporting
- Progress monitoring
- Team collaboration tools
- Export capabilities

### ⚙️ **IntegrationView - Workflow Configuration**
- N8N instance configuration
- Workflow status monitoring
- Security settings management
- Performance analytics
- System health checks

## Technology Stack

- **Frontend**: React 18, Monday UI (Vibe), React Query
- **Backend Integration**: N8N workflow automation
- **APIs**: Monday.com GraphQL API, ElectricalAI Pro API
- **Authentication**: Monday.com OAuth 2.0
- **File Handling**: Multipart uploads, cloud storage
- **Real-time**: WebSocket subscriptions

## Architecture

```
Monday.com Board
       ↓
   React App (ItemView/BoardView/IntegrationView)
       ↓
   Service Layer (MondayService/N8NService/AuthService)
       ↓
   N8N Workflow Automation
       ↓
   ElectricalAI Pro API (OpenAI, NEC Database, Material Costs)
```

## Installation

### Prerequisites
- Node.js 18+
- Monday.com developer account
- N8N instance (local or cloud)
- ElectricalAI Pro API access

### Local Development

1. **Clone and install dependencies**
```bash
git clone https://github.com/electricalai/monday-app.git
cd monday-app
npm install
```

2. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env`:
```env
REACT_APP_MONDAY_CLIENT_ID=your_monday_client_id
REACT_APP_N8N_WEBHOOK_BASE=http://localhost:5678
REACT_APP_ELECTRICALAI_API_KEY=your_api_key
REACT_APP_ENVIRONMENT=development
```

3. **Start development server**
```bash
npm start
```

4. **Configure Monday.com app**
- Go to Monday.com Developer Center
- Create new app with ItemView, BoardView, IntegrationView features
- Set development URL to `http://localhost:3000`

### Production Deployment

1. **Build application**
```bash
npm run build
```

2. **Deploy to hosting platform**
```bash
# Deploy to Render.com, Vercel, or other platform
npm run deploy
```

3. **Configure Monday.com app for production**
- Update app URLs in Monday Developer Center
- Configure webhook endpoints
- Set production environment variables

## Configuration

### Monday.com App Settings

The app requires these permissions:
- `boards:read` - Read board data
- `boards:write` - Update board items
- `items:read` - Read item details
- `items:write` - Create and update items
- `files:read` - Access uploaded files
- `files:write` - Upload new files
- `users:read` - Get user information

### N8N Integration

Configure these workflows in your N8N instance:
- `electrical-estimation-workflow.json` - Main estimation logic
- `floor-plan-analysis-workflow.json` - Image processing
- `nec-compliance-workflow.json` - Code compliance checking
- `material-cost-tracking-workflow.json` - Real-time pricing
- `project-progress-workflow.json` - Progress monitoring

### API Configuration

Required API integrations:
- **OpenAI API** - Floor plan analysis and AI calculations
- **Copper Price API** - Real-time material costs
- **NEC Database** - Electrical code compliance
- **Monday.com GraphQL API** - Board and item operations

## Usage

### Creating New Estimation

1. Open Monday.com board
2. Click "Add New Item" or open existing item
3. ElectricalAI Pro widget loads in ItemView
4. Upload floor plans and project specifications
5. Configure project parameters (type, size, complexity)
6. Click "Generate Estimate"
7. Review results and NEC compliance report

### Batch Processing

1. Go to BoardView in Monday.com
2. Select multiple items for estimation
3. Click "Batch Generate Estimates"
4. Monitor progress in dashboard
5. Review completed estimates

### Workflow Configuration

1. Access IntegrationView from app menu
2. Configure N8N instance URL and API key
3. Test connection and workflow status
4. Monitor system health and performance

## API Reference

### MondayService Methods

```javascript
// Get item data
const item = await MondayService.getItem(itemId);

// Update item columns
await MondayService.updateItemColumns(itemId, { cost: 15000 });

// Upload files
const uploadedFile = await MondayService.uploadFile(file, itemId);
```

### N8NService Methods

```javascript
// Trigger estimation workflow
const result = await N8NService.triggerEstimationWorkflow({
  projectId: 'item_123',
  projectType: 'residential',
  squareFootage: 2500
});

// Check workflow status
const status = await N8NService.getWorkflowStatus(projectId);
```

## Troubleshooting

### Common Issues

**App not loading in Monday.com iframe**
- Check HTTPS configuration
- Verify iframe permissions
- Clear browser cache

**N8N connection failed**
- Verify N8N instance URL and API key
- Check network connectivity
- Ensure N8N webhooks are enabled

**File upload errors**
- Check file size limits (50MB max)
- Verify supported file types (PDF, DWG, PNG, JPG)
- Ensure Monday.com file permissions

**Estimation workflow timeout**
- Large floor plans may take 2-3 minutes to process
- Check N8N workflow execution logs
- Verify OpenAI API quota and limits

### Debug Mode

Enable debug logging:
```javascript
localStorage.setItem('electricalai_debug', 'true');
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Support

- **Documentation**: https://docs.electricalai.pro/monday-app
- **Support Email**: support@electricalai.pro
- **GitHub Issues**: https://github.com/electricalai/monday-app/issues
- **Monday.com App Store**: [ElectricalAI Pro](https://monday.com/marketplace/apps/electricalai-pro)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

### v1.0.0 (2024-01-01)
- Initial release with ItemView, BoardView, IntegrationView
- N8N workflow integration
- NEC 2023 compliance checking
- Real-time material cost tracking
- AI-powered floor plan analysis
- Monday.com marketplace submission