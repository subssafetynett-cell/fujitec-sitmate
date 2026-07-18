/** Field layout aligned with Health and Safety concern form sections */
export const ACTION_TRACKER_FIELD_SECTIONS = [
  {
    heading: "Site details",
    fields: [
      { id: "project_name", label: "Site/Building name", type: "text" },
      { id: "customer_name", label: "Customer name", type: "text" },
      { id: "billing_address", label: "Billing address", type: "textarea" },
      { id: "fujitec_manager", label: "Fujitec manager", type: "text" },
      { id: "fujitec_supervisor", label: "Fujitec supervisor", type: "text" },
      { id: "engineers", label: "Engineers", type: "text" },
      { id: "building_contact", label: "Building contact", type: "text" },
    ],
  },
  {
    heading: "Health and safety concern",
    fields: [
      {
        id: "observation_details",
        label: "Describe the health and safety concern [unsafe act / unsafe condition]",
        type: "textarea",
      },
    ],
  },
  {
    heading: "",
    fields: [
      { id: "exact_location", label: "Location of incident", type: "textarea" },
    ],
  },
  {
    heading: "Suggested action",
    fields: [
      {
        id: "corrective_action",
        label: "What do you suggest should be done to address the concern?",
        type: "textarea",
      },
    ],
  },
  {
    heading: "Nonconformance",
    fields: [
      { id: "noncon_action", label: "Correction action", type: "textarea" },
      { id: "noncon_responsible", label: "Responsible person", type: "text", readOnlyInEdit: true },
      { id: "noncon_responsible_email", label: "Responsible person email", type: "text", readOnlyInEdit: true },
      { id: "noncon_date", label: "Date completed", type: "date" },
    ],
  },
];

export function actionToFormValues(action) {
  if (!action) return {};
  const d = action.details || {};
  return {
    ...d,
    project_name: d.project_name || "",
    customer_name: d.customer_name || "",
    billing_address: d.billing_address || "",
    fujitec_manager: d.fujitec_manager || "",
    fujitec_supervisor: d.fujitec_supervisor || "",
    engineers: d.engineers || d.responsible_person || "",
    building_contact: d.building_contact || "",
    observation_details: d.observation_details || "",
    followup_fujitec_manager: d.followup_fujitec_manager || d.fujitec_manager || "",
    followup_fujitec_supervisor: d.followup_fujitec_supervisor || d.fujitec_supervisor || "",
    responsible_person: d.responsible_person || "",
    site_contact: d.site_contact || "",
    full_address: d.full_address || "",
    exact_location: d.exact_location || "",
    corrective_action: d.corrective_action || "",
    noncon_action: action.correctionAction || d.noncon_action || "",
    noncon_responsible: action.responsibleName || d.noncon_responsible || "",
    noncon_responsible_email: action.responsibleEmail || d.noncon_responsible_email || "",
    noncon_date: action.dateCompleted || d.noncon_date || "",
    incidents: Array.isArray(d.incidents) ? d.incidents : [],
    incidents_other: d.incidents_other || "",
  };
}

export function formValuesToUpdatePayload(values, responseNotes) {
  const {
    noncon_action,
    noncon_date,
    noncon_responsible,
    noncon_responsible_email,
    ...rest
  } = values;

  return {
    correctionAction: noncon_action || "",
    dateCompleted: noncon_date || "",
    responseNotes,
    details: {
      ...rest,
      noncon_action: noncon_action || "",
      noncon_date: noncon_date || "",
      noncon_responsible: noncon_responsible || "",
      noncon_responsible_email: noncon_responsible_email || "",
      incidents: Array.isArray(rest.incidents) ? rest.incidents : [],
    },
  };
}
