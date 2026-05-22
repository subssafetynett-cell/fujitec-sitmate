const asyncHandler = require('express-async-handler');
const fs = require('fs');
const http = require('http');
const https = require('https');
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
  if (!(await userCanAccessSite(prisma, req.scopedUser || req.user, doc.siteId, req.actingClient?.id))) {
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

function mimeForDocument(doc) {
  const ext =
    extensionFromName(doc.type || '') ||
    extensionFromName(doc.title || '') ||
    extensionFromName(doc.url || '') ||
    'bin';
  return mimeTypeFromExtension(ext);
}

/** Stream remote files through the API so previews/downloads get correct headers (no redirect/CORS issues). */
function pipeRemoteUrl(sourceUrl, res, { disposition, filename, fallbackMime }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const follow = (url, redirectsLeft) => {
      let parsed;
      try {
        parsed = new URL(url);
      } catch (err) {
        fail(err);
        return;
      }

      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get(
        url,
        {
          headers: {
            'User-Agent': 'SafetyApp/1.0',
            Accept: '*/*',
          },
        },
        (upstream) => {
          const code = upstream.statusCode || 0;
          if (code >= 300 && code < 400 && upstream.headers.location && redirectsLeft > 0) {
            upstream.resume();
            try {
              follow(new URL(upstream.headers.location, url).href, redirectsLeft - 1);
            } catch (err) {
              fail(err);
            }
            return;
          }

          if (code !== 200) {
            upstream.resume();
            const err = new Error(`Failed to fetch document (${code})`);
            err.status = code === 404 ? 404 : 502;
            fail(err);
            return;
          }

          inlinePreviewHeaders(res);
          const contentType =
            upstream.headers['content-type']?.split(';')[0]?.trim() ||
            fallbackMime ||
            'application/octet-stream';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', contentDisposition(disposition, filename));
          upstream.pipe(res);
          upstream.on('error', fail);
          // Resolve only when the client response has finished — not on upstream 'end'.
          res.on('finish', done);
          res.on('error', fail);
        }
      );
      req.on('error', fail);
    };

    follow(sourceUrl, 5);
  });
}

// Upload a document
exports.uploadDocument = asyncHandler(async (req, res) => {
    const { title, version, validFrom, validUntil, tags, siteId, category } = req.body;

    if (!siteId) {
        return res.status(400).json({ success: false, message: "Site ID is required" });
    }

    if (!(await userCanAccessSite(prisma, req.scopedUser || req.user, siteId, req.actingClient?.id))) {
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

    if (!(await userCanAccessSite(prisma, req.scopedUser || req.user, siteId, req.actingClient?.id))) {
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

    if (!(await userCanAccessSite(prisma, req.scopedUser || req.user, siteId, req.actingClient?.id))) {
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
    const downloadName = buildDownloadFilename(doc);

    if (doc.url.startsWith('http://') || doc.url.startsWith('https://')) {
        await pipeRemoteUrl(doc.url, res, {
            disposition: 'inline',
            filename: downloadName,
            fallbackMime: mimeForDocument(doc),
        });
        return;
    }

    if (!doc.url.startsWith('/uploads/')) {
        return res.status(400).json({ success: false, message: "Unsupported document storage path" });
    }

    const { filePath, mime } = resolveLocalFile(doc);

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
        const remoteUrl = cloudinaryAttachmentUrl(doc.url, downloadName);
        await pipeRemoteUrl(remoteUrl, res, {
            disposition: 'attachment',
            filename: downloadName,
            fallbackMime: mimeForDocument(doc),
        });
        return;
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

    if (!(await userCanAccessSite(prisma, req.scopedUser || req.user, doc.siteId, req.actingClient?.id))) {
        return res.status(403).json({ success: false, message: "You do not have access to this site." });
    }

    if (doc.url) {
        await deleteStoredDocument(doc.url);
    }

    await prisma.siteDocument.delete({ where: { id } });

    res.json({ success: true, message: "Document deleted" });
});
