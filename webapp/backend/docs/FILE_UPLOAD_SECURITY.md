# Secure File Upload Implementation

This document describes the comprehensive file upload security system implemented for blueprint and electrical schematic uploads.

## 🔒 Security Features

### 1. **Strict File Validation**
- **File Type Validation**: Only allows specific extensions (.pdf, .dwg, .dxf, .png, .jpg, .jpeg, .gif, .bmp, .tiff)
- **MIME Type Checking**: Validates declared MIME types against actual file content
- **Magic Number Verification**: Uses `file-type` library to detect real file types
- **Content Scanning**: Scans file content for malicious patterns and scripts

### 2. **Advanced Filename Security**
- **Path Traversal Protection**: Blocks `../` and `..\` patterns
- **Character Sanitization**: Removes dangerous characters and control codes
- **Reserved Name Detection**: Prevents Windows reserved names (CON, PRN, etc.)
- **Length Limitations**: Enforces maximum filename length
- **Secure Naming**: Generates cryptographically secure filenames with SHA-256 hashes

### 3. **File Size and Resource Limits**
- **Maximum File Size**: 100MB per file (configurable)
- **Maximum Files**: 5 files per upload (configurable)
- **Memory Management**: Uses memory storage with automatic cleanup
- **Processing Timeouts**: Prevents hanging operations

### 4. **Content Processing & Optimization**
- **Image Processing**: Automatic resizing, optimization, and metadata stripping
- **Thumbnail Generation**: Creates optimized thumbnails for image files
- **Metadata Removal**: Strips potentially sensitive EXIF data
- **Format Standardization**: Converts images to optimized JPEG format

### 5. **Storage Security**
- **Quarantine System**: Suspicious files are isolated automatically
- **Temporary Processing**: Files processed in temp directory first
- **Atomic Operations**: Files moved to permanent storage only after validation
- **Reference Tracking**: Implements file deduplication and reference counting

## 📋 API Endpoints

### Upload Blueprints
```http
POST /api/blueprints/upload/:projectId
Content-Type: multipart/form-data

Form Data:
- blueprints: File[] (max 5 files, 100MB each)
- description: string (optional)
- blueprint_type: "floor_plan" | "electrical_schematic" | "site_plan" | "detail_drawing"
```

**Example Response:**
```json
{
  "success": true,
  "message": "2 blueprint(s) uploaded successfully",
  "blueprints": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "originalFilename": "electrical-plan.pdf",
      "blueprintType": "electrical_schematic",
      "fileSize": 2457600,
      "uploadedAt": "2024-01-15T10:30:00Z",
      "url": "/api/blueprints/550e8400-e29b-41d4-a716-446655440000/download"
    }
  ],
  "rejected": []
}
```

### List Project Blueprints
```http
GET /api/blueprints/project/:projectId?type=floor_plan&status=analyzed
```

### Download Blueprint
```http
GET /api/blueprints/:id/download
```

### Get Thumbnail (Images Only)
```http
GET /api/blueprints/:id/thumbnail?size=200
```

### Trigger Analysis
```http
POST /api/blueprints/:id/analyze
Content-Type: application/json

{
  "analysis_type": "electrical_load"
}
```

## 🛡️ Security Implementation Details

### File Validation Pipeline
```javascript
// 1. Basic validation (extension, MIME type)
fileFilter: (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedTypes.includes(ext)) {
    return cb(new Error('Invalid file type'));
  }
  // Additional checks...
}

// 2. Content validation
async validateFileContent(buffer, originalMimeType) {
  const detectedType = await fileType.fromBuffer(buffer);
  return detectedType && allowedMimeTypes.includes(detectedType.mime);
}

// 3. Malicious content scanning
async scanForMaliciousContent(buffer) {
  const suspiciousPatterns = [/<script/i, /javascript:/i, /eval\(/i];
  // Scan first 8KB for patterns...
}
```

### Filename Sanitization
```javascript
sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"|?*\x00-\x1f\x80-\x9f]/g, '_')  // Remove dangerous chars
    .replace(/^\.+/, '')                            // Remove leading dots
    .replace(/\.+$/, '')                            // Remove trailing dots
    .replace(/\s+/g, '_')                          // Replace spaces
    .substring(0, 255);                            // Limit length
}
```

### Secure Storage Structure
```
uploads/
├── temp/           # Temporary processing area
├── processed/      # Final storage by project
│   ├── project-1/
│   └── project-2/
└── quarantine/     # Suspicious files
```

## 🔧 Configuration

### Environment Variables
```bash
# File Upload Configuration
MAX_FILE_SIZE=104857600        # 100MB in bytes
MAX_FILES_PER_UPLOAD=5
UPLOAD_PATH=./uploads

# Security Settings
ENABLE_VIRUS_SCANNING=true
QUARANTINE_SUSPICIOUS_FILES=true
STRIP_IMAGE_METADATA=true

# Processing Options
GENERATE_THUMBNAILS=true
MAX_IMAGE_DIMENSIONS=4000
THUMBNAIL_QUALITY=80
```

### Middleware Usage
```javascript
const { fileUploadMiddleware, processFilesMiddleware } = require('./middleware/file-upload');

router.post('/upload/:projectId',
  fileUploadMiddleware.array('blueprints', 5),    // Basic validation
  processFilesMiddleware,                          // Advanced processing
  asyncHandler(async (req, res) => {
    // Access processed files via req.validFiles
    // Access rejected files via req.rejectedFiles
  })
);
```

## 📊 Database Schema

### Blueprints Table
```sql
CREATE TABLE blueprints (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    original_filename VARCHAR(255),
    secure_filename VARCHAR(255) UNIQUE,
    file_path TEXT,
    file_size BIGINT,
    mime_type VARCHAR(100),
    file_hash VARCHAR(64),        -- SHA-256 for deduplication
    blueprint_type VARCHAR(50),
    upload_status VARCHAR(20),
    analysis_results JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Analysis Tracking
```sql
CREATE TABLE blueprint_analysis_log (
    id UUID PRIMARY KEY,
    blueprint_id UUID REFERENCES blueprints(id),
    analysis_type VARCHAR(50),
    status VARCHAR(20),
    results JSONB,
    confidence_score DECIMAL(5,4),
    processing_time_ms INTEGER,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

## 🚨 Security Alerts and Monitoring

### Automatic Quarantine
- Files with suspicious patterns are automatically moved to quarantine
- Admin notifications sent for quarantined files
- Quarantine logs include detection reasons and file metadata

### Monitoring Metrics
- Upload success/failure rates
- File type distribution
- Average processing times
- Security incident counts
- Storage usage by project

### Audit Logging
```javascript
// All file operations are logged with:
{
  timestamp: "2024-01-15T10:30:00Z",
  action: "file_upload",
  projectId: "uuid",
  filename: "sanitized-name.pdf",
  fileSize: 2457600,
  securityChecks: {
    mimeTypeValidation: "passed",
    contentScan: "passed",
    filenameValidation: "passed"
  },
  processingTime: 1250
}
```

## 🔍 Troubleshooting

### Common Issues

1. **File Upload Fails**
   - Check file size limits
   - Verify allowed file types
   - Ensure proper form encoding (`multipart/form-data`)

2. **Security Rejections**
   - Review quarantine logs
   - Check filename for invalid characters
   - Verify file content matches extension

3. **Processing Errors**
   - Monitor disk space in upload directories
   - Check Sharp.js installation for image processing
   - Verify file permissions on upload directories

### Testing Security
```bash
# Test malicious filename
curl -F "blueprints=@../../../etc/passwd" http://localhost:3001/api/blueprints/upload/uuid

# Test oversized file
curl -F "blueprints=@large-file.pdf" http://localhost:3001/api/blueprints/upload/uuid

# Test invalid file type
curl -F "blueprints=@malicious.exe" http://localhost:3001/api/blueprints/upload/uuid
```

All security tests should result in appropriate error responses and quarantine actions.

## 📈 Performance Considerations

- Files are processed asynchronously where possible
- Thumbnails are generated on-demand with caching
- Large files use streaming for memory efficiency
- Database indexes optimize common queries
- File deduplication reduces storage usage

This implementation provides enterprise-grade security for file uploads while maintaining usability and performance.