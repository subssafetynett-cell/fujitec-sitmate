const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes are protected
router.use(requireAuth);

const multer = require('multer');
const uploadMem = multer({ storage: multer.memoryStorage() });

router.post('/upload', (req, res, next) => {
    uploadMem.single('file')(req, res, (err) => {
        if (err) {
            console.error("File Upload Error:", err);
            return res.status(400).json({ success: false, message: err.message || "File upload error" });
        }
        next();
    });
}, documentController.uploadDocument);
router.get('/', documentController.getDocuments);
router.get('/counts', documentController.getModuleCounts);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
