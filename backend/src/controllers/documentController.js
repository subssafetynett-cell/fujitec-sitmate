const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const prisma = require("../prismaClient");
const {
  normalizeDocumentType,
  isAllowedUpload,
  extensionFromName,
  mimeTypeFromExtension,
} = require('../utils/documentFileTypes');
const {
  storeUploadedDocument,
  deleteStoredDocument,
  formatStorageError,
  getUploadsDir,
} = require('../utils/documentStorage');
const { userCanAccessSite } = require('../utils/siteAccess');
const {
  normalizeValidUntilDate,
  getTodayDateString,
  isValidUntilExpired,
} = require('../utils/documentExpiry');
const { purgeExpiredDocuments } = require('../jobs/expiredDocumentCleanup');

function inlinePreviewHeaders(res) {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Frame-Options');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

function buildDownloadFilename(doc) {
  const title = (doc?.title || 'document').trim();
  const type = (doc?.type || '').toUpperCase();
  if (!type || type === 'FORM' || type === 'FILE') return title;
  if (title.toLowerCase().endsWith(`.${type.toLowerCase()}`)) return title;
  return `${title}.${type.toLowerCase()}`;
}

function contentDisposition(disposition, filename) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function cloudinaryAttachmentUrl(url, filename) {
  if (!url?.includes('res.cloudinary.com')) return url;
  try {
    const parsed = new URL(url);
    const uploadIdx = parsed.pathname.indexOf('/upload/');
    if (uploadIdx === -1) return url;
    const prefix = parsed.pathname.slice(0, uploadIdx + '/upload/'.length);
    const suffix = parsed.pathname.slice(uploadIdx + '/upload/'.length);
    const flag = filename
      ? `fl_attachment:${encodeURIComponent(filename)}/`
      : 'fl_attachment/';
    parsed.pathname = `${prefix}${flag}${suffix}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

async function getAuthorizedDocument(req, id) {
  const doc = await prisma.siteDocument.findUnique({ where: { id } });
  if (!doc) {
    const err = new Error('Document not found');
    err.status = 404;
    throw err;
  }
  if (!(await userCanAccessSite(prisma, req.user, doc.siteId))) {
    const err = new Error('You do not have access to this site.');
    err.status = 403;
    throw err;
  }
  if (!doc.url) {
    const err = new Error('Document file is missing');
    err.status = 404;
    throw err;
  }

  if (isValidUntilExpired(doc.validUntil)) {
    if (doc.url) {
      await deleteStoredDocument(doc.url);
    }
    await prisma.siteDocument.delete({ where: { id: doc.id } });
    const err = new Error('This document has expired and was removed.');
    err.status = 410;
    throw err;
  }

  return doc;
}

function resolveLocalFile(doc) {
  const filename = path.basename(doc.url);
  const filePath = path.join(getUploadsDir(), filename);
  if (!fs.existsSync(filePath)) {
    const err = new Error('File not found on server');
    err.status = 404;
    throw err;
  }
  const ext =
    extensionFromName(filename) || extensionFromName(doc.title || '') || 'bin';
  const mime = mimeTypeFromExtension(ext);
  return { filePath, ext, mime };
}

// Upload a document
exports.uploadDocument = asyncHandler(async (req, res) => {
    const { title, version, validFrom, validUntil, tags, siteId, category } = req.body;

    if (!siteId) {
        return res.status(400).json({ success: false, message: "Site ID is required" });
    }

    if (!(await userCanAccessSite(prisma, req.user, siteId))) {
        return res.status(403).json({ success: false, message: "You do not have access to this site." });
    }

    if (!validUntil) {
        return res.status(400).json({ success: false, message: "Valid Until date is required" });
    }

    const normalizedValidUntil = normalizeValidUntilDate(validUntil);
    if (!normalizedValidUntil) {
        return res.status(400).json({
            success: false,
            message: "Valid Until must be a valid date (use the date picker).",
        });
    }

    const normalizedValidFrom = validFrom ? normalizeValidUntilDate(validFrom) : null;
    if (validFrom && !normalizedValidFrom) {
        return res.status(400).json({
            success: false,
            message: "Valid From must be a valid date when provided.",
        });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    if (!isAllowedUpload(req.file)) {
        return res.status(400).json({
            success: false,
            message: "File type not supported. Use PDF, Word, Excel, PowerPoint, images (PNG, JPEG), or text files.",
        });
    }

    let stored;
    try {
        stored = await storeUploadedDocument(req.file);
    } catch (err) {
        console.error("Document storage error:", err);
        const status = err.status || (err.http_code === 400 ? 400 : 500);
        return res.status(status).json({
            success: false,
            message: formatStorageError(err),
        });
    }

    const docType = normalizeDocumentType(req.file);
    const fileData = {
        title,
        version: version || "v1.0",
        validFrom: normalizedValidFrom,
        validUntil: normalizedValidUntil,
        tags: tags || "",
        siteId,
        category: category || 'uploads',
        uploadedById: req.user.id,
        url: stored.url,
        type: docType,
        size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
    };

    const document = await prisma.siteDocument.create({
        data: fileData,
    });

    res.status(201).json({ success: true, document });
});

// Get documents for a specific site and module (category)
exports.getDocuments = asyncHandler(async (req, res) => {
    const { siteId, category } = req.query;

    if (!siteId) {
        return res.status(400).json({ success: false, message: "Site ID is required" });
    }

    if (!(await userCanAccessSite(prisma, req.user, siteId))) {
        return res.status(403).json({ success: false, message: "You do not have access to this site." });
    }

    await purgeExpiredDocuments();

    const today = getTodayDateString();
    const where = {
        siteId,
        validUntil: { gte: today },
    };

    if (category) {
        where.category = category;
    }

    const documents = await prisma.siteDocument.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            uploadedBy: {
                select: { firstName: true, lastName: true },
            },
        },
    });

    res.json({ success: true, documents });
});

// Get counts per module for a site (User specific)
exports.getModuleCounts = asyncHandler(async (req, res) => {
    const { siteId } = req.query;

    if (!siteId) {
        return res.status(400).json({ success: false, message: "Site ID is required" });
    }

    if (!(await userCanAccessSite(prisma, req.user, siteId))) {
        return res.status(403).json({ success: false, message: "You do not have access to this site." });
    }

    await purgeExpiredDocuments();

    const today = getTodayDateString();
    const counts = await prisma.siteDocument.groupBy({
        by: ['category'],
        where: {
            siteId,
            validUntil: { gte: today },
        },
        _count: {
            category: true,
        },
    });

    const countMap = {};
    counts.forEach((c) => {
        countMap[c.category] = c._count.category;
    });

    res.json({ success: true, counts: countMap });
});

/** Stream or redirect a stored document for inline preview in the app. */
exports.viewDocument = asyncHandler(async (req, res) => {
    const doc = await getAuthorizedDocument(req, req.params.id);

    if (doc.url.startsWith('http://') || doc.url.startsWith('https://')) {
        inlinePreviewHeaders(res);
        return res.redirect(302, doc.url);
    }

    if (!doc.url.startsWith('/uploads/')) {
        return res.status(400).json({ success: false, message: "Unsupported document storage path" });
    }

    const { filePath, mime } = resolveLocalFile(doc);
    const downloadName = buildDownloadFilename(doc);

    inlinePreviewHeaders(res);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', contentDisposition('inline', downloadName));
    fs.createReadStream(filePath).pipe(res);
});

/** Download with the document title as filename (attachment). */
exports.downloadDocument = asyncHandler(async (req, res) => {
    const doc = await getAuthorizedDocument(req, req.params.id);
    const downloadName = buildDownloadFilename(doc);

    if (doc.url.startsWith('http://') || doc.url.startsWith('https://')) {
        inlinePreviewHeaders(res);
        return res.redirect(302, cloudinaryAttachmentUrl(doc.url, downloadName));
    }

    if (!doc.url.startsWith('/uploads/')) {
        return res.status(400).json({ success: false, message: "Unsupported document storage path" });
    }

    const { filePath, mime } = resolveLocalFile(doc);

    inlinePreviewHeaders(res);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', contentDisposition('attachment', downloadName));
    fs.createReadStream(filePath).pipe(res);
});

exports.deleteDocument = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const doc = await prisma.siteDocument.findUnique({ where: { id } });

    if (!doc) {
        return res.status(404).json({ success: false, message: "Document not found" });
    }

    if (!(await userCanAccessSite(prisma, req.user, doc.siteId))) {
        return res.status(403).json({ success: false, message: "You do not have access to this site." });
    }

    if (doc.url) {
        await deleteStoredDocument(doc.url);
    }

    await prisma.siteDocument.delete({ where: { id } });

    res.json({ success: true, message: "Document deleted" });
});
