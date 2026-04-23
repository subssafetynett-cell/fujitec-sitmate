const prisma = require("../prismaClient");
const { sendEmail } = require("../services/emailService");


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

    const newForm = await prisma.form.create({
      data: {
        title: title || "Untitled Form",
        fields,
        titleColor,
        titleAlignment,
        createdById: req.user?.id,
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

    if (form.createdById !== req.user?.id) {
       return res.status(403).json({ success: false, message: "Unauthorized" });
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
    const userId = req.user?.id;
    // Only return forms created by the current user
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
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
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

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
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
    const response = await prisma.formResponse.create({
      data: {
        answers,
        category,
        formId: req.params.id,
        submittedById: req.user?.id
      }
    });
    res.json({ success: true, data: response });
  } catch (err) {
    console.error("Save response error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.getAllResponses = async (req, res) => {
  try {
    const userId = req.user?.id;
    const filter = { submittedById: userId };
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const responses = await prisma.formResponse.findMany({
      where: filter,

      orderBy: { createdAt: 'desc' },
      include: {
        form: { select: { title: true } }
      }
    });

    res.json({
      success: true,
      data: responses,
    });
  } catch (err) {
    console.error("Get responses error:", err);
    res.status(500).json({ success: false });
  }
};

exports.deleteResponse = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.formResponse.delete({ where: { id } });
    res.json({ success: true, message: "Response deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete" });
  }
};

exports.getResponseById = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await prisma.formResponse.findUnique({
      where: { id },
      include: {
        form: { select: { title: true } }
      }
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
    const { answers } = req.body;
    const updated = await prisma.formResponse.update({
      where: { id },
      data: { answers },
    });
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

    const response = await prisma.formResponse.findUnique({
      where: { id },
      include: { form: true }
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
