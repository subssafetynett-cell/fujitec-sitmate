const prisma = require("../prismaClient");
const { sendEmail } = require("../services/emailService");
const { notifyAdminsOfNewFormSubmission } = require("../services/formSubmissionNotifyService");
const { createNonconformanceFromFormSubmission } = require("../services/nonconformanceActionService");
const { assertGeneralFormTemplateWrite } = require("../utils/generalFormTemplatePolicy");
const {
  buildCompanyFormResponseWhere,
  getFormResponseReadScope,
  assertFormResponseAccess,
  canViewFormResponse,
} = require("../utils/formResponseAccess");
const {
  sanitizeVisibilityOnSave,
  isSheqCategory,
} = require("../utils/generalFormVisibility");
const { buildSitepackScopeWhere, sitepackColumnsForAnswers } = require("../utils/sitepackScope");
const {
  compactFormResponseRow,
  isCompactListRequest,
} = require("../utils/formResponseCompact");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const {
  STATIC_CONCERN_FORM_ID,
  assertAuthenticatedForm,
  assertCanModifyForm,
  reqUserDbId,
} = require("../utils/formOwnership");

const STATIC_CONCERN_FORM_TITLE = "Concern Form";

function resolveFormResponseCategory(category) {
  return category != null && String(category).trim() !== ""
    ? String(category).trim()
    : null;
}

/** Category filter for list queries (includes legacy SHEQ rows with null category). */
function buildCategoryWhere(categoryParam) {
  if (!categoryParam) return null;

  const parts = String(categoryParam)
    .split(",")
    .map((c) => c.trim())
    .filter((p) => p !== "");
  const categories = [];
  let matchNullOrEmpty = false;
  parts.forEach((p) => {
    if (p === "null" || p === "undefined" || p === "__empty__") {
      matchNullOrEmpty = true;
    } else {
      categories.push(p);
    }
  });

  if (categories.length === 0 && !matchNullOrEmpty) return null;

  if (
    categories.length === 1 &&
    isSheqCategory(categories[0]) &&
    !matchNullOrEmpty
  ) {
    const cat = categories[0];
    return {
      OR: [
        { category: cat },
        { category: null, form: { title: cat } },
        { category: "", form: { title: cat } },
      ],
    };
  }

  // Only expand to null/empty categories when explicitly requested via null/undefined/__empty__.
  // A trailing comma alone must NOT match every uncategorized row (that caused Friday Pack 500s).
  if (matchNullOrEmpty) {
    const orConditions = [{ category: "" }, { category: null }];
    if (categories.length > 0) {
      orConditions.push({ category: { in: categories } });
    }
    return { OR: orConditions };
  }

  if (categories.length === 1) {
    return { category: categories[0] };
  }

  return { category: { in: categories } };
}

// ✅ Save new form
exports.saveForm = async (req, res, next) => {
  try {
    const { title, fields, titleColor, titleAlignment } = req.body;

    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Fields array is required",
      });
    }

    const userId = reqUserDbId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const newForm = await prisma.form.create({
      data: {
        title: title || "Untitled Form",
        fields,
        titleColor,
        titleAlignment,
        createdById: userId,
      }
    });

    res.status(201).json({
      success: true,
      message: "Form saved successfully",
      form: newForm,
    });
  } catch (error) {
    console.error("Save form error:", error);
    next(error);
  }
};

// ✅ Update existing form
exports.updateForm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, fields, titleColor, titleAlignment } = req.body;

    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Fields array is required",
      });
    }

    const form = await prisma.form.findUnique({ where: { id } });
    if (!form) {
      return res.status(404).json({ success: false, message: "Form not found" });
    }

    const access = assertCanModifyForm(req, form);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const updatedForm = await prisma.form.update({
      where: { id },
      data: {
        title: title || "Untitled Form",
        fields,
        titleColor,
        titleAlignment,
      }
    });

    res.json({
      success: true,
      message: "Form updated successfully",
      form: updatedForm,
    });
  } catch (error) {
    console.error("Update form error:", error);
    next(error);
  }
};

// ✅ Get all forms
exports.getAllForms = async (req, res, next) => {
  try {
    const userId = reqUserDbId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    const forms = await prisma.form.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: forms,
    });
  } catch (error) {
    console.error("Get forms error:", error);
    next(error);
  }
};

// ✅ Get single form by ID
exports.getFormById = async (req, res, next) => {
  try {
    const formId = req.params.id;
    let form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        createdBy: {
          include: {
            client: {
              select: { logo: true, name: true }
            }
          }
        }
      }
    });

    if (!form && formId === STATIC_CONCERN_FORM_ID) {
      form = {
        id: STATIC_CONCERN_FORM_ID,
        title: STATIC_CONCERN_FORM_TITLE,
        fields: [],
        titleColor: "#000000",
        titleAlignment: "left",
        createdById: null,
        createdBy: null,
      };
    }

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const access = assertAuthenticatedForm(req, form);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    res.json({
      success: true,
      data: form,
    });
  } catch (error) {
    console.error("Get form error:", error);
    next(error);
  }
};

// ✅ Delete form by ID
exports.deleteForm = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check existence first
    const form = await prisma.form.findUnique({ where: { id } });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const access = assertCanModifyForm(req, form);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    await prisma.form.delete({ where: { id } });

    res.json({
      success: true,
      message: "Form deleted successfully",
    });
  } catch (error) {
    console.error("Delete form error:", error);
    next(error);
  }
};


exports.saveResponse = async (req, res) => {
  try {
    const { answers, category } = req.body;
    const formId = req.params.id;
    let sanitizedAnswers = sanitizeVisibilityOnSave(answers, req.body);
    if (req.body?.siteId && !sanitizedAnswers.siteId) {
      sanitizedAnswers = { ...sanitizedAnswers, siteId: String(req.body.siteId).trim() };
    }
    if (req.body?.subfolderId && !sanitizedAnswers.subfolderId) {
      sanitizedAnswers = {
        ...sanitizedAnswers,
        subfolderId: String(req.body.subfolderId).trim(),
      };
    }

    const gate = assertGeneralFormTemplateWrite(req, sanitizedAnswers, req.body, {
      formId,
      category,
    });
    if (!gate.ok) {
      return res.status(gate.status).json({ success: false, message: gate.message });
    }

    const submitterId = reqUserDbId(req);
    if (!submitterId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    let form = await prisma.form.findUnique({ where: { id: formId } });
    if (!form && formId === STATIC_CONCERN_FORM_ID) {
      form = await prisma.form.create({
        data: {
          id: STATIC_CONCERN_FORM_ID,
          title: STATIC_CONCERN_FORM_TITLE,
          fields: [],
          createdById: submitterId,
        },
      });
    }

    if (!form) {
      return res.status(404).json({ success: false, message: "Form not found" });
    }

    const sitepackColumns = sitepackColumnsForAnswers(sanitizedAnswers);

    // Snapshot company at save time so later user company changes don't move/hide this row.
    const submitter = await prisma.user.findUnique({
      where: { id: submitterId },
      select: { clientId: true },
    });
    const responseClientId =
      req.actingClient?.id || submitter?.clientId || req.user?.clientId || null;

    const response = await prisma.formResponse.create({
      data: {
        answers: sanitizedAnswers,
        category: resolveFormResponseCategory(category),
        formId: form.id,
        submittedById: submitterId,
        clientId: responseClientId || undefined,
        siteId: sitepackColumns.siteId,
        subfolderId: sitepackColumns.subfolderId,
      }
    });

    notifyAdminsOfNewFormSubmission({
      submitterId,
      formTitle: form.title,
      category,
      answers: sanitizedAnswers,
    }).catch((err) => {
      console.error("Form submission admin notification failed:", err);
    });

    createNonconformanceFromFormSubmission({
      answers: sanitizedAnswers,
      formResponseId: response.id,
      submitterId,
    }).catch((err) => {
      console.error("Nonconformance action creation failed:", err);
    });

    res.json({ success: true, data: response });
  } catch (err) {
    console.error("Save response error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.getAllResponses = async (req, res) => {
  try {
    const userId = reqUserDbId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    const actingClientId = req.actingClient?.id || null;
    const clientId = actingClientId || req.scopedUser?.clientId || req.user?.clientId;
    const readScope = {
      ...getFormResponseReadScope(req.user, actingClientId),
      userEmail: req.user?.email,
      userDisplayName: [req.user?.firstName, req.user?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim(),
    };
    const companyWhere = buildCompanyFormResponseWhere(
      userId,
      clientId,
      actingClientId,
      readScope
    );
    const querySiteId =
      req.query.siteId && !["null", "undefined"].includes(String(req.query.siteId).trim())
        ? String(req.query.siteId).trim()
        : null;
    const querySubfolderId =
      req.query.subfolderId &&
      !["null", "undefined"].includes(String(req.query.subfolderId).trim())
        ? String(req.query.subfolderId).trim()
        : null;
    const categoryWhere = buildCategoryWhere(req.query.category);
    const sitepackWhere = buildSitepackScopeWhere({
      siteId: querySiteId,
      subfolderId: querySubfolderId,
    });

    const scopeClauses = [companyWhere];
    if (categoryWhere) scopeClauses.push(categoryWhere);
    if (sitepackWhere) scopeClauses.push(sitepackWhere);
    const where =
      scopeClauses.length === 1 ? scopeClauses[0] : { AND: scopeClauses };

    const pagination = parsePagination(req.query);
    const compact = isCompactListRequest(req.query);
    // Always enable pagination for compact list views to bound memory when
    // answers contain large embedded images (Friday Pack logos / photos).
    const usePagination = pagination.enabled || compact;
    const page = usePagination ? (pagination.enabled ? pagination.page : 1) : 1;
    const limit = usePagination
      ? pagination.enabled
        ? pagination.limit
        : Math.min(100, pagination.limit || 100)
      : null;

    const findArgs = {
      where,
      orderBy: { createdAt: "desc" },
      include: {
        form: { select: { title: true } },
        submittedBy: {
          select: { id: true, clientId: true, firstName: true, lastName: true, email: true },
        },
      },
    };

    let responses;
    let totalCount = null;

    if (usePagination) {
      [responses, totalCount] = await Promise.all([
        prisma.formResponse.findMany({
          ...findArgs,
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.formResponse.count({ where }),
      ]);
    } else {
      responses = await prisma.formResponse.findMany(findArgs);
    }

    const visible = responses.filter((row) =>
      canViewFormResponse(row, userId, clientId, readScope)
    );

    const data = compact ? visible.map(compactFormResponseRow) : visible;

    const payload = { success: true, data };
    if (usePagination) {
      payload.pagination = buildPaginationMeta({
        page,
        limit,
        total: totalCount,
      });
    }

    res.json(payload);
  } catch (err) {
    console.error("Get responses error:", err);
    res.status(500).json({
      success: false,
      message: err?.message || "Failed to load form responses",
    });
  }
};

exports.deleteResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const owned = await assertFormResponseAccess(req, id, { write: true });
    if (!owned.ok) {
      return res.status(owned.status).json({ success: false, message: owned.message });
    }
    const existing = owned.row;
    const gate = assertGeneralFormTemplateWrite(req, existing.answers || {}, {}, {
      formId: existing.formId,
      category: existing.category,
      trustCategory: true,
    });
    if (!gate.ok) {
      return res.status(gate.status).json({ success: false, message: gate.message });
    }
    await prisma.formResponse.delete({ where: { id } });
    res.json({ success: true, message: "Response deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete" });
  }
};

exports.getResponseById = async (req, res) => {
  try {
    const { id } = req.params;
    const owned = await assertFormResponseAccess(req, id, { write: false });
    if (!owned.ok) {
      return res.status(owned.status).json({ success: false, message: owned.message });
    }
    const response = await prisma.formResponse.findUnique({
      where: { id },
      include: {
        form: { select: { title: true } },
        submittedBy: {
          select: { id: true, clientId: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!response) {
      return res.status(404).json({ success: false, message: "Response not found" });
    }
    res.json({ success: true, data: response });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch response" });
  }
};

exports.updateResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const owned = await assertFormResponseAccess(req, id, { write: true });
    if (!owned.ok) {
      return res.status(owned.status).json({ success: false, message: owned.message });
    }
    const { answers, category } = req.body;
    let sanitizedAnswers = sanitizeVisibilityOnSave(answers || {}, req.body);
    if (req.body?.siteId && !sanitizedAnswers.siteId) {
      sanitizedAnswers = { ...sanitizedAnswers, siteId: String(req.body.siteId).trim() };
    }
    if (req.body?.subfolderId && !sanitizedAnswers.subfolderId) {
      sanitizedAnswers = {
        ...sanitizedAnswers,
        subfolderId: String(req.body.subfolderId).trim(),
      };
    }
    const gate = assertGeneralFormTemplateWrite(req, sanitizedAnswers, req.body, {
      formId: owned.row.formId,
      category: owned.row.category,
      trustCategory: true,
    });
    if (!gate.ok) {
      return res.status(gate.status).json({ success: false, message: gate.message });
    }
    const sitepackColumns = sitepackColumnsForAnswers(sanitizedAnswers);
    const data = {
      answers: sanitizedAnswers,
      siteId: sitepackColumns.siteId,
      subfolderId: sitepackColumns.subfolderId,
    };
    if (category != null && String(category).trim() !== "") {
      data.category = String(category).trim();
    }
    const updated = await prisma.formResponse.update({
      where: { id },
      data,
    });

    // A responsible person can also be assigned while editing a report.
    // The service skips assignees that were already notified for this report.
    if (owned.row.submittedById) {
      createNonconformanceFromFormSubmission({
        answers: sanitizedAnswers,
        formResponseId: id,
        submitterId: owned.row.submittedById,
      }).catch((err) => {
        console.error("Nonconformance action creation failed:", err);
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update" });
  }
};

exports.sendResponseEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const senderEmail = req.user?.email;

    if (!email) {
      return res.status(400).json({ success: false, message: "Recipient email is required" });
    }

    const owned = await assertFormResponseAccess(req, id, { write: false });
    if (!owned.ok) {
      return res.status(owned.status).json({ success: false, message: owned.message });
    }

    const response = await prisma.formResponse.findUnique({
      where: { id },
      include: { form: true },
    });
    if (!response) {
      return res.status(404).json({ success: false, message: "Response not found" });
    }

    if (!response.formId) {
      return res.status(404).json({ success: false, message: "Form definition not found (might be deleted)" });
    }

    // Format answers
    let htmlContent = `
      <h2>${response.form.title}</h2>
      <p>Submitted on: ${new Date(response.createdAt).toLocaleString()}</p>
      <h3>Answers:</h3>
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th>Field</th>
            <th>Answer</th>
          </tr>
        </thead>
        <tbody>
    `;

    // We need to map answers to field labels if possible, but answers is just a map of id->value.
    // formId has the fields definition.
    const fields = response.form.fields || [];
    const answers = response.answers || {};

    fields.forEach(field => {
      const val = answers[field.id] || "";
      htmlContent += `
         <tr>
           <td>${field.label}</td>
           <td>${val}</td>
         </tr>
       `;
    });

    htmlContent += `
        </tbody>
      </table>
      <p>Sent by: ${senderEmail || "System"}</p>
    `;

    const result = await sendEmail({
      to: email,
      subject: `Report: ${response.form.title}`,
      html: htmlContent,
      replyTo: senderEmail,
    });

    if (result.success) {
      res.json({ success: true, message: "Email sent successfully" });
    } else {
      console.error("Email service error:", result.error);
      res.status(500).json({ success: false, message: "Failed to send email", error: result.error });
    }
  } catch (err) {
    console.error("Email send error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Upload logo (Form Assets)
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    res.status(201).json({ 
      success: true, 
      url: req.file.path, // Cloudinary URL
      message: "Logo uploaded successfully" 
    });
  } catch (error) {
    console.error("Upload logo error:", error);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};
