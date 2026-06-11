/** True for embedded base64 image payloads (the main list-view bloat). */
function isDataImage(value) {
  return typeof value === "string" && value.startsWith("data:image");
}

/**
 * Strip heavy binary fields from answers for list/table views.
 * Full payloads are still returned by GET /forms/responses/:id.
 */
function compactFormResponseAnswers(answers) {
  if (!answers || typeof answers !== "object") return answers ?? {};

  const out = { ...answers };

  if (out.docInfo && typeof out.docInfo === "object") {
    const { logo, logoRight, signature, ...rest } = out.docInfo;
    out.docInfo = {
      ...rest,
      ...(logo && !isDataImage(logo) ? { logo } : {}),
      ...(logoRight && !isDataImage(logoRight) ? { logoRight } : {}),
      ...(signature && !isDataImage(signature) ? { signature } : {}),
    };
  }

  if (out.formData && typeof out.formData === "object") {
    const { images, ...formRest } = out.formData;
    const imageCount = Array.isArray(images) ? images.length : 0;
    out.formData = {
      ...formRest,
      images: imageCount ? { _count: imageCount } : [],
    };
  }

  return out;
}

function compactFormResponseRow(row) {
  if (!row) return row;
  return {
    ...row,
    answers: compactFormResponseAnswers(row.answers),
  };
}

function isCompactListRequest(query = {}) {
  const raw = query.compact;
  return raw === true || raw === "true" || raw === "1" || raw === 1;
}

/** SHEQ dashboard widgets only need status + list labels (not photos). */
function pickSheqDashboardAnswers(answers) {
  if (!answers || typeof answers !== "object") return {};
  const fd = answers.formData;
  return {
    name: answers.name,
    formData:
      fd && typeof fd === "object"
        ? {
            projectStatus: fd.projectStatus,
            client: fd.client,
            siteAddress: fd.siteAddress,
          }
        : undefined,
  };
}

function pickInspectionDashboardAnswers(answers) {
  if (!answers || typeof answers !== "object") return {};
  return { siteRating: answers.siteRating };
}

function pickRecentActionAnswers(answers) {
  if (!answers || typeof answers !== "object") return {};
  return {
    report_heading: answers.report_heading,
    reportHeading: answers.reportHeading,
  };
}

function slimFormResponseRow(row, pickAnswers) {
  if (!row) return row;
  return {
    ...row,
    answers: pickAnswers(row.answers),
  };
}

module.exports = {
  compactFormResponseAnswers,
  compactFormResponseRow,
  isCompactListRequest,
  pickSheqDashboardAnswers,
  pickInspectionDashboardAnswers,
  pickRecentActionAnswers,
  slimFormResponseRow,
};
