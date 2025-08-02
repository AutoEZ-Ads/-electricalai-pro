const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const sharp = require('sharp');
const { promisify } = require('util');
const fileType = require('file-type');

class SecureFileUpload {
    constructor(options = {}) {
        this.maxFileSize = options.maxFileSize || 100 * 1024 * 1024; // 100MB
        this.maxFiles = options.maxFiles || 5;
        this.uploadPath = options.uploadPath || './uploads';
        this.allowedTypes = options.allowedTypes || [
            '.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'
        ];
        this.allowedMimeTypes = options.allowedMimeTypes || [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/gif',
            'image/bmp',
            'image/tiff',
            'application/acad',
            'application/x-acad',
            'application/autocad_dwg',
            'image/x-dwg',
            'application/dwg',
            'application/x-dwg',
            'application/x-autocad',
            'drawing/dwg'
        ];
        
        // Malicious patterns to detect
        this.maliciousPatterns = [
            /\.\./g,                    // Path traversal
            /[<>:"|?*]/g,              // Windows invalid chars
            /[\x00-\x1f\x80-\x9f]/g,   // Control characters
            /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
            /\.(exe|bat|cmd|scr|pif|com|vbs|js|jar|app)$/i, // Executable extensions
        ];
        
        this.initializeStorage();
    }

    async initializeStorage() {
        try {
            await fs.mkdir(this.uploadPath, { recursive: true });
            await fs.mkdir(path.join(this.uploadPath, 'temp'), { recursive: true });
            await fs.mkdir(path.join(this.uploadPath, 'processed'), { recursive: true });
            await fs.mkdir(path.join(this.uploadPath, 'quarantine'), { recursive: true });
        } catch (error) {
            console.error('Failed to initialize upload directories:', error);
        }
    }

    /**
     * Advanced filename sanitization
     */
    sanitizeFilename(filename) {
        // Remove or replace dangerous characters
        let sanitized = filename
            .replace(/[<>:"|?*\x00-\x1f\x80-\x9f]/g, '_')
            .replace(/^\.+/, '')  // Remove leading dots
            .replace(/\.+$/, '')  // Remove trailing dots
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .substring(0, 255);   // Limit length
        
        // Ensure it doesn't match Windows reserved names
        const nameWithoutExt = path.parse(sanitized).name;
        if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(nameWithoutExt)) {
            sanitized = `file_${sanitized}`;
        }
        
        return sanitized;
    }

    /**
     * Validate file content against MIME type
     */
    async validateFileContent(buffer, originalMimeType) {
        try {
            const detectedType = await fileType.fromBuffer(buffer);
            
            if (!detectedType) {
                // For files without clear magic numbers (like DWG), allow if extension matches
                return true;
            }
            
            // Check if detected MIME type matches declared type
            if (detectedType.mime !== originalMimeType) {
                console.warn(`MIME type mismatch: declared ${originalMimeType}, detected ${detectedType.mime}`);
                // Allow some common mismatches
                const allowedMismatches = {
                    'image/jpg': 'image/jpeg',
                    'image/jpeg': 'image/jpg'
                };
                
                if (allowedMismatches[originalMimeType] !== detectedType.mime) {
                    return false;
                }
            }
            
            return this.allowedMimeTypes.includes(detectedType.mime);
        } catch (error) {
            console.error('File content validation error:', error);
            return false;
        }
    }

    /**
     * Scan for malicious content patterns
     */
    async scanForMaliciousContent(buffer) {
        const content = buffer.toString('utf8', 0, Math.min(buffer.length, 8192)); // Check first 8KB
        
        // Look for suspicious patterns
        const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /%3cscript/i,
            /onclick=/i,
            /onerror=/i,
            /eval\(/i,
            /exec\(/i,
            /system\(/i,
            /shell_exec/i,
            /passthru/i,
            /__import__/i,
            /subprocess/i
        ];
        
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(content)) {
                return {
                    isMalicious: true,
                    reason: `Suspicious pattern detected: ${pattern.source}`
                };
            }
        }
        
        return { isMalicious: false };
    }

    /**
     * Generate secure filename with hash
     */
    generateSecureFilename(originalName, buffer) {
        const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
        const timestamp = Date.now();
        const ext = path.extname(originalName).toLowerCase();
        return `${timestamp}_${hash}${ext}`;
    }

    /**
     * Process and validate uploaded image
     */
    async processImage(buffer, filename) {
        try {
            const image = sharp(buffer);
            const metadata = await image.metadata();
            
            // Security checks
            if (metadata.width > 10000 || metadata.height > 10000) {
                throw new Error('Image dimensions too large');
            }
            
            if (metadata.density && metadata.density > 1200) {
                throw new Error('Image density too high');
            }
            
            // Strip metadata and optimize
            const processedBuffer = await image
                .resize(4000, 4000, { fit: 'inside', withoutEnlargement: true })
                .removeMetadata()
                .jpeg({ quality: 85, progressive: true })
                .toBuffer();
            
            return processedBuffer;
        } catch (error) {
            console.error('Image processing error:', error);
            throw new Error('Invalid or corrupted image file');
        }
    }

    /**
     * Create secure multer middleware
     */
    createMiddleware() {
        const storage = multer.memoryStorage();
        
        return multer({
            storage,
            limits: {
                fileSize: this.maxFileSize,
                files: this.maxFiles,
                fields: 10,
                fieldNameSize: 100,
                fieldSize: 1024 * 1024 // 1MB for field values
            },
            fileFilter: async (req, file, cb) => {
                try {
                    // Basic filename validation
                    const ext = path.extname(file.originalname).toLowerCase();
                    const sanitizedName = this.sanitizeFilename(file.originalname);
                    
                    // Check extension
                    if (!this.allowedTypes.includes(ext)) {
                        return cb(new Error(`Invalid file type: ${ext}. Allowed types: ${this.allowedTypes.join(', ')}`));
                    }
                    
                    // Check MIME type
                    if (!this.allowedMimeTypes.includes(file.mimetype)) {
                        return cb(new Error(`Invalid MIME type: ${file.mimetype}`));
                    }
                    
                    // Check for malicious patterns in filename
                    for (const pattern of this.maliciousPatterns) {
                        if (pattern.test(file.originalname)) {
                            return cb(new Error('Potentially malicious filename detected'));
                        }
                    }
                    
                    // Store sanitized filename
                    file.sanitizedName = sanitizedName;
                    
                    cb(null, true);
                } catch (error) {
                    cb(error);
                }
            }
        });
    }

    /**
     * Advanced file processing middleware
     */
    async processUploadedFiles(req, res, next) {
        try {
            if (!req.files || req.files.length === 0) {
                return next();
            }

            const processedFiles = [];

            for (const file of req.files) {
                try {
                    // Validate file content
                    const isValidContent = await this.validateFileContent(file.buffer, file.mimetype);
                    if (!isValidContent) {
                        throw new Error(`File content validation failed for ${file.originalname}`);
                    }

                    // Scan for malicious content
                    const malwareCheck = await this.scanForMaliciousContent(file.buffer);
                    if (malwareCheck.isMalicious) {
                        // Quarantine suspicious files
                        const quarantinePath = path.join(this.uploadPath, 'quarantine', 
                            `${Date.now()}_${file.originalname}`);
                        await fs.writeFile(quarantinePath, file.buffer);
                        
                        req.logger?.warn('Suspicious file quarantined', {
                            filename: file.originalname,
                            reason: malwareCheck.reason,
                            quarantinePath
                        });
                        
                        throw new Error(`File rejected: ${malwareCheck.reason}`);
                    }

                    // Generate secure filename
                    const secureFilename = this.generateSecureFilename(file.originalname, file.buffer);
                    
                    let processedBuffer = file.buffer;
                    
                    // Process images
                    if (file.mimetype.startsWith('image/')) {
                        try {
                            processedBuffer = await this.processImage(file.buffer, file.originalname);
                        } catch (imageError) {
                            throw new Error(`Image processing failed: ${imageError.message}`);
                        }
                    }

                    // Calculate file hash for deduplication
                    const fileHash = crypto.createHash('sha256').update(processedBuffer).digest('hex');
                    
                    // Save to temporary location first
                    const tempPath = path.join(this.uploadPath, 'temp', secureFilename);
                    await fs.writeFile(tempPath, processedBuffer);

                    const fileInfo = {
                        originalName: file.originalname,
                        sanitizedName: file.sanitizedName,
                        secureFilename,
                        tempPath,
                        size: processedBuffer.length,
                        mimeType: file.mimetype,
                        hash: fileHash,
                        uploadedAt: new Date().toISOString(),
                        processed: file.mimetype.startsWith('image/')
                    };

                    processedFiles.push(fileInfo);

                    req.logger?.info('File processed successfully', {
                        originalName: file.originalname,
                        secureFilename,
                        size: fileInfo.size,
                        hash: fileHash
                    });

                } catch (fileError) {
                    req.logger?.error('File processing failed', {
                        filename: file.originalname,
                        error: fileError.message
                    });
                    
                    // Continue with other files, but log the error
                    processedFiles.push({
                        originalName: file.originalname,
                        error: fileError.message,
                        rejected: true
                    });
                }
            }

            // Attach processed files to request
            req.processedFiles = processedFiles;
            req.validFiles = processedFiles.filter(f => !f.rejected);
            req.rejectedFiles = processedFiles.filter(f => f.rejected);

            next();

        } catch (error) {
            req.logger?.error('File upload processing error:', error);
            next(error);
        }
    }

    /**
     * Move files from temp to permanent storage
     */
    async moveToStorage(files, projectId) {
        const movedFiles = [];
        
        for (const file of files) {
            if (file.rejected) continue;
            
            try {
                const finalPath = path.join(this.uploadPath, 'processed', 
                    projectId.toString(), file.secureFilename);
                
                // Ensure project directory exists
                await fs.mkdir(path.dirname(finalPath), { recursive: true });
                
                // Move file from temp to final location
                await fs.rename(file.tempPath, finalPath);
                
                movedFiles.push({
                    ...file,
                    finalPath,
                    url: `/uploads/${projectId}/${file.secureFilename}`
                });
            } catch (error) {
                console.error(`Failed to move file ${file.secureFilename}:`, error);
            }
        }
        
        return movedFiles;
    }

    /**
     * Clean up temporary files
     */
    async cleanupTempFiles(files) {
        for (const file of files) {
            if (file.tempPath) {
                try {
                    await fs.unlink(file.tempPath);
                } catch (error) {
                    console.error(`Failed to cleanup temp file ${file.tempPath}:`, error);
                }
            }
        }
    }
}

// Create default instance
const secureUpload = new SecureFileUpload({
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 5,
    uploadPath: './uploads',
    allowedTypes: ['.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'],
});

// Export middleware functions
const fileUploadMiddleware = secureUpload.createMiddleware();
const processFilesMiddleware = secureUpload.processUploadedFiles.bind(secureUpload);

module.exports = {
    SecureFileUpload,
    fileUploadMiddleware,
    processFilesMiddleware,
    secureUpload
};