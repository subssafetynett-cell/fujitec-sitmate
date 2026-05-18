const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes are protected
router.use(requireAuth);

const multer = require('multer');
const { isAllowedUpload, MAX_DOCUMENT_BYTES } = require('../utils/documentFileTypes');

const uploadMem = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_DOCUMENT_BYTES },
    fileFilter: (req, file, cb) => {
        if (isAllowedUpload(file)) {
            cb(null, true);
        } else {
            cb(new Error('File type not supported. Use PDF, Word, Excel, PowerPoint, PNG, JPEG, or similar.'));
        }
    },
});

function formatMulterUploadError(err) {
    if (err?.code === "LIMIT_FILE_SIZE") {
        const maxMb = Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024);
        return `File is too large. The maximum upload size is ${maxMb} MB. Please choose a smaller file.`;
    }
    if (err?.message) return err.message;
    return "File upload error";
}

router.post('/upload', (req, res, next) => {
    uploadMem.single('file')(req, res, (err) => {
        if (err) {
            console.error("File Upload Error:", err);
            const message = formatMulterUploadError(err);
            const status = err?.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            return res.status(status).json({ success: false, message });
        }
        next();
    });
}, documentController.uploadDocument);
router.get('/', documentController.getDocuments);
router.get('/counts', documentController.getModuleCounts);
router.get('/:id/view', documentController.viewDocument);
router.get('/:id/download', documentController.downloadDocument);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
