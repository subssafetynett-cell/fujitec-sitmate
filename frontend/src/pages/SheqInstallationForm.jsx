import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { 
    Box, Typography, Button, Paper, TextField, CircularProgress, 
    IconButton, Checkbox, FormControlLabel, Radio, RadioGroup, FormControl, MenuItem,
    Dialog, DialogTitle, DialogContent, DialogActions, Tooltip
} from "@mui/material";
import { ArrowLeft, Save, Download, X, Plus, Trash2, AlertTriangle } from "lucide-react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
    ResponsiveContainer, Cell, LabelList, AreaChart, Area
} from 'recharts';
import Layout from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import api from "../services/api";
import { getOrCreateTemplateForm } from "../services/formUtils";
import { downloadPdfFromRef } from "../utils/pdfGenerator";
import SaveChoiceDialog from "../components/SaveChoiceDialog";

const SCORING_STANDARDS = [
    { title: "ST 1 – Work at Heights: Scaffolding & Edge protection", subtitle: "(scaffold structure, fall protection, car top, voids, protection from falling objects)" },
    { title: "ST 2 – Lifting Operations", subtitle: "(LOLER, SWL, test certs, condition, crane plan, exclusion zone, lift supervisor)" },
    { title: "ST 3 – Electricity: Site temp lighting & Power", subtitle: "(110v, trailing leads, PAT, boards, lighting levels, isolation)" },
    { title: "ST 4 – Electricity: Live Working", subtitle: "(G39, isolation, lockout, testing, PPE, competency)" },
    { title: "ST 5 – Traffic management & Site Access/Egress", subtitle: "(pedestrian segregation, vehicle movements, signage, lighting, clear paths)" },
    { title: "ST 6 – Occupational Health: Noise & Vibration", subtitle: "(HAVS records, ear protection, noise levels, exposure limits)" },
    { title: "ST 7 – Occupational Health: Manual Handling", subtitle: "(mechanical aids, lifting technique, heavy loads, assessment)" },
    { title: "ST 8 – Occupational Health: Dust, COSHH & Asbestos", subtitle: "(RPE, extraction, SDS, storage, asbestos survey, masks)" },
    { title: "ST 9 – Plant & Equipment", subtitle: "(condition, guards, pre-use checks, competency, storage)" },
    { title: "ST 10 – Personal Protective Equipment (PPE)", subtitle: "(condition, suitability, correct use, availability)" },
    { title: "ST 11 – Public & Third Party Safety", subtitle: "(segregation, hoarding, signage, debris, risks to public)" },
    { title: "ST 12 – Welfare & Housekeeping", subtitle: "(cleanliness, facilities, waste disposal, storage, water/power)" },
    { title: "ST 13 – Fire Safety & Emergency procedures", subtitle: "(extinguishers, exits, alarm, muster point, first aid, hot work)" },
    { title: "ST 14 – Environmental: Spills & Waste", subtitle: "(spill kits, segregation, hazardous waste, contamination)" },
    { title: "ST 15 – Communication & Training", subtitle: "(inductions, TBT, RAMS briefing, competency cards, supervision)" },
    { title: "ST 16 – Site Management & Documentation", subtitle: "(F10, CPP, insurance, RAMS, accident book, records)" },
    { title: "ST 17 – Tools & Hand Tools", subtitle: "(condition, correct use, lanyards, isolation)" },
    { title: "ST 18 – Ladders & Steps", subtitle: "(condition, tied, angle, duration, checks)" },
    { title: "ST 19 – Confined Spaces", subtitle: "(RAMS, monitoring, escape, competency, ventilation)" },
    { title: "ST 20 – Behavior & Safety Culture", subtitle: "(attitude, reporting, interventions, teamwork)" }
];

const INSPECTION_STANDARDS = [
    {
        category: "SHEQ PERFORMANCE STANDARDS",
        subcategories: [
            {
                title: "SITE SAFETY COMPLIANCE",
                subtitle: "1 Non-compliant 2 Partial 3 Full Compliance",
                items: SCORING_STANDARDS.map((s, idx) => ({
                    label: `${s.title}${s.subtitle ? ' ' + s.subtitle : ''}`,
                    key: `standard_${idx + 1}`
                }))
            }
        ]
    }
];

const INSTALLATION_STANDARDS = [
    {
        category: "1. VEHICLE",
        subcategories: [
            {
                title: "1.1 OVERALL CONDITION",
                subtitle: "1 Non-compliant 2 Partial 3 Full Compliance",
                items: [
                    { label: "Tyres", key: "v_tyres", rating: 3 },
                    { label: "Windows, mirrors etc", key: "v_windows", rating: 3 },
                    { label: "MOT/Road Tax", key: "v_mot", rating: 3 },
                    { label: "Service date", key: "v_service", rating: 3 }
                ]
            },
            {
                title: "1.2 EMERGENCY EQUIPMENT",
                items: [
                    { label: "First Aid Kit", key: "v_first_aid", rating: 3 },
                    { label: "Fire extinguisher", key: "v_fire_ext", rating: 3 }
                ]
            },
            {
                title: "1.3 SITE REGISTRATION",
                items: [
                    { label: "Signed in/visitors book", key: "v_visitors_book", rating: 3 },
                    { label: "Permit to work in place", key: "v_permit_work", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "2. SITE CONDITION",
        subcategories: [
            {
                title: "2.1 ACCESS TO POINT OF WORK",
                items: [
                    { label: "Normal conditions", key: "s_normal", rating: 3 },
                    { label: "Restricted access", key: "s_restricted", rating: 3 }
                ]
            },
            {
                title: "2.2 LIGHTING",
                items: [
                    { label: "General", key: "s_lighting_gen", rating: 3 },
                    { label: "Access / Emergency", key: "s_lighting_em", rating: 3 }
                ]
            },
            {
                title: "2.3 ENTRANCE AND FALL PROTECTION",
                items: [
                    { label: "Guardrails and Toeboards", key: "s_guardrails", rating: 3 },
                    { label: "Secured Ladder(s)", key: "s_ladders", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "3. RAMS DOCUMENTATION",
        subcategories: [
            {
                title: "3.1 METHOD STATEMENTS",
                items: [
                    { label: "Method statement in place", key: "r_ms_in_place", rating: 3 },
                    { label: "Current and up to date", key: "r_ms_current", rating: 3 }
                ]
            },
            {
                title: "3.2 RISK ASSESSMENTS",
                items: [
                    { label: "Available at the point of work/van", key: "r_ra_available", rating: 3 }
                ]
            },
            {
                title: "3.3 COSHH",
                items: [
                    { label: "Assessments / MSDS available", key: "r_coshh_available", rating: 3 },
                    { label: "Following control measures", key: "r_coshh_control", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "4. TOOLS AND EQUIPMENT",
        subcategories: [
            {
                title: "4.1 PPE",
                items: [
                    { label: "Correct PPE being used for task", key: "t_ppe_task", rating: 3 },
                    { label: "Gloves issued", key: "t_ppe_gloves", rating: 3 },
                    { label: "Safety Glasses issued", key: "t_ppe_glasses", rating: 3 },
                    { label: "Safety Boots issued", key: "t_ppe_boots", rating: 3 },
                    { label: "Corporate Clothing condition", key: "t_ppe_clothing", rating: 3 }
                ]
            },
            {
                title: "4.2 POWER TOOLS",
                items: [
                    { label: "Fit for purpose and tested?", key: "t_power_tools", rating: 3 }
                ]
            },
            {
                title: "4.3 HAND TOOLS",
                items: [
                    { label: "Suitable and fit for purpose?", key: "t_hand_tools", rating: 3 }
                ]
            },
            {
                title: "4.4 TEST EQUIPMENT",
                items: [
                    { label: "Fit for purpose and tested?", key: "t_test_equipment", rating: 3 }
                ]
            },
            {
                title: "4.5 BARRIERS",
                items: [
                    { label: "Suitable and fit for purpose?", key: "t_barriers_suitable", rating: 3 },
                    { label: "Correctly used?", key: "t_barriers_used", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "5. LIFTING EQUIPMENT",
        subcategories: [
            {
                title: "5.1 LIFTING EQUIPMENT / ACCESSORIES",
                items: [
                    { label: "Suitable and fit for purpose?", key: "l_lifting_suitable", rating: 3 },
                    { label: "Inspection / certification", key: "l_lifting_cert", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "6. DOCUMENTATION",
        subcategories: [
            {
                title: "6.1 MAINTENANCE DOCUMENTATION",
                items: [
                    { label: "Correct service paperwork", key: "d_maint_paperwork", rating: 3 },
                    { label: "Service order number correct", key: "d_maint_order", rating: 3 }
                ]
            },
            {
                title: "6.2 PROCESS DOCUMENTATION",
                items: [
                    { label: "Operations and maintenance manual", key: "d_process_manual", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "7. TRAINING",
        subcategories: [
            {
                title: "7.1 COMPETENCY",
                items: [
                    { label: "Technical", key: "tr_competency_tech", rating: 3 },
                    { label: "Health and Safety", key: "tr_competency_hs", rating: 3 },
                    { label: "Manual handling", key: "tr_competency_mh", rating: 3 },
                    { label: "Product training", key: "tr_competency_prod", rating: 3 },
                    { label: "Tool Box Talks", key: "tr_competency_tbt", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "8. GENERAL",
        subcategories: [
            {
                title: "8.1 ACCIDENT REPORTING",
                items: [
                    { label: "Aware of procedure", key: "g_acc_aware", rating: 3 }
                ]
            },
            {
                title: "8.2 FIRE",
                items: [
                    { label: "Aware of fire assembly point", key: "g_fire_assembly", rating: 3 },
                    { label: "Fire hazards", key: "g_fire_hazards", rating: 3 },
                    { label: "Fire extinguisher", key: "g_fire_ext", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "9. SAFETY ESSENTIALS",
        subcategories: [
            {
                title: "9.1 ELECTRICAL ISOLATION",
                items: [
                    { label: "LOTO in use when required / appropriate", key: "se_elec_loto", rating: 3 }
                ]
            },
            {
                title: "9.2 CAR TOP HAND CONTROL",
                items: [
                    { label: "In use when required / appropriate", key: "se_car_top", rating: 3 }
                ]
            },
            {
                title: "9.3 WORKING IN PIT",
                items: [
                    { label: "Pit props / baffles in use when required", key: "se_pit_props", rating: 3 }
                ]
            },
            {
                title: "9.4 ENVIRONMENT",
                items: [
                    { label: "Spillage kits / management", key: "se_env_spillage", rating: 3 }
                ]
            },
            {
                title: "9.5 WASTE MANAGEMENT",
                items: [
                    { label: "Procedure for disposing various waste streams", key: "se_waste_proc", rating: 3 }
                ]
            },
            {
                title: "9.6 GENERAL HOUSEKEEPING",
                items: [
                    { label: "Housekeeping general and task specific", key: "se_housekeeping", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "OTHER COMMENTS/OBSERVATIONS",
        subcategories: []
    }
];

const SHQ_INSTALLATION_STANDARDS = [
    {
        category: "1. PROJECT DOCUMENTATION",
        subcategories: [
            {
                title: "1.1 RISK ASSESSMENTS & METHOD STATEMENT (RAMS)",
                items: [
                    { label: "RAMS in place", key: "pd_rams_place", rating: 0 },
                    { label: "Evidence of communication available", key: "pd_comm_avail", rating: 0 }
                ]
            },
            {
                title: "1.2 REGISTERS",
                items: [
                    { label: "Equipment register", key: "pd_equip_reg", rating: 0 },
                    { label: "PPE/PAT/FIRST AID/ FIRE MARSHAL", key: "pd_ppe_pat", rating: 3 }
                ]
            },
            {
                title: "1.3 INSPECTION RECORDS",
                items: [
                    { label: "Hoardings / Entrance protection inspections", key: "pd_hoarding_insp", rating: 3 },
                    { label: "Scaffold inspections", key: "pd_scaffold_insp", rating: 3 },
                    { label: "Tirak inspections", key: "pd_tirak_insp", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "2. SITE CONDITIONS",
        subcategories: [
            {
                title: "2.1 ACCESS / EGRESS TO POINT OF WORK",
                items: [
                    { label: "Safe conditions", key: "sc_safe_cond", rating: 3 },
                    { label: "Emergency escape routes clear at all times", key: "sc_escape_clear", rating: 3 }
                ]
            },
            {
                title: "2.2 LIGHTING",
                items: [
                    { label: "General lighting", key: "sc_light_gen", rating: 3 },
                    { label: "Access routes lighting", key: "sc_light_access", rating: 3 },
                    { label: "Task lighting", key: "sc_light_task", rating: 3 }
                ]
            },
            {
                title: "2.3 WELFARE & ENVIRONMENT",
                items: [
                    { label: "Canteen and rest room", key: "sc_welfare_canteen", rating: 3 },
                    { label: "Toilets and washing facilities", key: "sc_welfare_toilets", rating: 3 },
                    { label: "First aid facilities", key: "sc_welfare_firstaid", rating: 3 },
                    { label: "Notices and Statutory signs", key: "sc_welfare_notices", rating: 3 },
                    { label: "Working climate ie dust/noise/vibration etc", key: "sc_welfare_climate", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "3. SUB CONTRCTORS",
        subcategories: [
            {
                title: "3.1 SUBCONTRACTORS ON SITE",
                items: [
                    { label: "Name and Trade of Sub Contractors on Site", key: "sub_name_trade", rating: 3 },
                    { label: "Sub Contractors Relevant qualifications kept on", key: "sub_quals", rating: 3 },
                    { label: "Subcontractors working to MS-RA", key: "sub_msra", rating: 3 }
                ]
            },
            {
                title: "3.2 FOLLOWING CONTROL MEASURES",
                items: [
                    { label: "Knowledge of risks/controls in place?", key: "sub_knowledge", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "4. TOOLS AND EQUIPMENT",
        subcategories: [
            {
                title: "4.1 POWER TOOLS",
                items: [
                    { label: "Fit for purpose and have been tested (PAT)?", key: "te_power_pat", rating: 3 }
                ]
            },
            {
                title: "4.2 BARRIERS",
                items: [
                    { label: "Suitable and fit for purpose?", key: "te_barriers_fit", rating: 0 },
                    { label: "Correctly used?", key: "te_barriers_used", rating: 0 }
                ]
            },
            {
                title: "4.3 HAND TOOLS",
                items: [
                    { label: "Suitable and fit for purpose?", key: "te_hand_fit", rating: 3 },
                    { label: "Tools correctly used?", key: "te_hand_used", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "5. LIFT EQUIPMENT & INSTALLATION",
        subcategories: [
            {
                title: "5.1 LOLER",
                items: [
                    { label: "Lifting equipment inspection/certification", key: "lei_loler_insp", rating: 3 },
                    { label: "Lifting accessories inspection/certification", key: "lei_loler_acc", rating: 3 },
                    { label: "Weekly / daily inspections of equipment", key: "lei_loler_weekly", rating: 3 }
                ]
            },
            {
                title: "5.2 MATERIAL STORAGE & DISPOSAL",
                items: [
                    { label: "Materials stored correctly", key: "lei_store_correct", rating: 3 },
                    { label: "Waste material disposed appropriately", key: "lei_waste_disp", rating: 3 },
                    { label: "Tool Box gas struts in good working conditions", key: "lei_toolbox_struts", rating: 3 }
                ]
            },
            {
                title: "5.3 ELECTRICAL SAFETY",
                items: [
                    { label: "Signage & tagging available?", key: "lei_elec_sign", rating: 3 },
                    { label: "Condition of Test Equipment / calibration", key: "lei_elec_cal", rating: 3 }
                ]
            },
            {
                title: "5.4 SHAFT SAFETY",
                items: [
                    { label: "Working inside machine room", key: "lei_shaft_mach", rating: 0 },
                    { label: "Working inside the lift shaft", key: "lei_shaft_inside", rating: 3 },
                    { label: "Crash deck inspected and scaff tag signed off?", key: "lei_shaft_crash", rating: 3 },
                    { label: "Openings around guide rails sealed", key: "lei_shaft_guide", rating: 3 },
                    { label: "Working platform safe with handrails, midrails and", key: "lei_shaft_plat", rating: 3 },
                    { label: "Drawbridge in place of working platform", key: "lei_shaft_draw", rating: 0 },
                    { label: "Openings between landing doors and platform", key: "lei_shaft_landing", rating: 3 },
                    { label: "Working outside lift shaft", key: "lei_shaft_outside", rating: 3 }
                ]
            },
            {
                title: "5.5 MACHINERY GUARDING",
                items: [
                    { label: "Fitted/compliant with current standards?", key: "lei_guard_fit", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "6. WORKING AT HEIGHTS",
        subcategories: [
            {
                title: "6.1 WORKING FROM WORK PLATFORMS",
                items: [
                    { label: "Guard rails in place: main & intermediate", key: "wah_plat_guard", rating: 3 },
                    { label: "Toeboards in place", key: "wah_plat_toe", rating: 3 }
                ]
            },
            {
                title: "6.2 LADDERS",
                items: [
                    { label: "Fit for purpose", key: "wah_ladder_fit", rating: 3 },
                    { label: "Correctly positioned and secured", key: "wah_ladder_sec", rating: 3 }
                ]
            },
            {
                title: "6.3 FALL PREVENTION",
                items: [
                    { label: "Harness / Teether belts", key: "wah_fall_harness", rating: 0 },
                    { label: "Inspection records", key: "wah_fall_insp", rating: 0 }
                ]
            }
        ]
    },
    {
        category: "7. GENERAL",
        subcategories: [
            {
                title: "7.1 SITE INDUCTION/REGISTRATION",
                items: [
                    { label: "Site specific induction", key: "gen_ind_site", rating: 3 },
                    { label: "Mitsubishi induction", key: "gen_ind_mits", rating: 3 },
                    { label: "Both Induction records maitained on file", key: "gen_ind_file", rating: 3 }
                ]
            },
            {
                title: "7.2 ON SITE NOTIFICATION",
                items: [
                    { label: "Client aware of presence on site - swipe in or", key: "gen_notif_client", rating: 3 }
                ]
            },
            {
                title: "7.3 ACCIDENT REPORTING",
                items: [
                    { label: "Accident Reporting Procedure in place", key: "gen_acc_proc", rating: 3 }
                ]
            },
            {
                title: "7.4 COMPETENCE & TRAINING",
                items: [
                    { label: "Technical/Tool Box Talks", key: "gen_train_tbt", rating: 3 },
                    { label: "CSCS", key: "gen_train_cscs", rating: 3 }
                ]
            },
            {
                title: "7.5 SECURITY & FIRE",
                items: [
                    { label: "Site Security Level", key: "gen_sec_level", rating: 3 },
                    { label: "Fire Hazards", key: "gen_fire_haz", rating: 3 },
                    { label: "Extinguishers", key: "gen_fire_ext", rating: 3 },
                    { label: "Call Points", key: "gen_fire_call", rating: 3 },
                    { label: "Fire signage and Information", key: "gen_fire_sign", rating: 3 }
                ]
            }
        ]
    },
    {
        category: "8. SAFETY ESSENTIALS",
        subcategories: [
            {
                title: "8.1 ENTRANCE PROTECTION",
                items: [
                    { label: "Hoardings safe with locks in place", key: "se_ent_hoarding", rating: 3 },
                    { label: "Signs in place for all hoardings", key: "se_ent_sign", rating: 3 }
                ]
            },
            {
                title: "8.2 PERSONAL PROTECTIVE EQUIPMENT",
                items: [
                    { label: "Worn at all times", key: "se_ppe_worn", rating: 3 },
                    { label: "Correct PPE being used for task", key: "se_ppe_task", rating: 3 },
                    { label: "Condition of PPE", key: "se_ppe_cond", rating: 3 }
                ]
            },
            {
                title: "8.3 SAFETY GEAR/PIT PROPS",
                items: [
                    { label: "Functioning as required", key: "se_gear_func", rating: 3 },
                    { label: "Tested prior to starting installation", key: "se_gear_test", rating: 3 }
                ]
            },
            {
                title: "8.5 TWO WAY COMMUNICATION",
                items: [
                    { label: "In use when required/appropriate?", key: "se_comm_use", rating: 0 }
                ]
            }
        ]
    },
    {
        category: "OTHER COMMENTS/OBSERVATIONS",
        subcategories: []
    },
    {
        category: "OTHER CONTRACTORS",
        subcategories: []
    }
];


const HeaderLabel = ({ children, customBlue, borderColor, downloading = false, value, onChange }) => (
    <Box sx={{ 
        background: `linear-gradient(135deg, ${customBlue} 0%, #004a6e 100%)`, 
        color: "#FFF", 
        textAlign: 'center', 
        py: 0.5, 
        px: 1, 
        borderBottom: `1px solid ${borderColor}`, 
        fontWeight: 'bold', 
        fontSize: '0.7rem', 
        textTransform: 'uppercase',
        letterSpacing: '0.075em',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '30px'
    }}>
        {downloading ? (
            value || children
        ) : (
            <TextField
                fullWidth
                variant="standard"
                value={value || children || ""}
                onChange={(e) => onChange && onChange(e.target.value)}
                InputProps={{ 
                    disableUnderline: true, 
                    sx: { 
                        color: "#FFF", 
                        fontWeight: 'bold', 
                        fontSize: '0.7rem', 
                        textAlign: 'center', 
                        input: { textAlign: 'center', p: 0 } 
                    } 
                }}
            />
        )}
    </Box>
);

const HeaderInput = ({ value, onChange, textColor, multiline = true, minRows = 2, downloading = false }) => {
    if (downloading) {
        return (
            <Typography sx={{ 
                px: 1.5, 
                py: 1.25, 
                fontSize: '0.9rem', 
                color: textColor, 
                lineHeight: 1.4, 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word',
                minHeight: multiline ? `${minRows * 1.4}rem` : 'auto'
            }}>
                {value || " "}
            </Typography>
        );
    }
    return (
        <TextField 
            fullWidth 
            multiline={multiline}
            minRows={minRows}
            variant="standard" 
            value={value}
            onChange={onChange}
            InputProps={{ 
                disableUnderline: true, 
                sx: { 
                    px: 1.5, 
                    py: 1.25, 
                    fontSize: '0.9rem', 
                    color: textColor,
                    lineHeight: 1.4,
                    '& .MuiInputBase-input': {
                        padding: 0,
                        overflow: 'visible !important'
                    }
                } 
            }}
        />
    );
};

export default function SheqInstallationForm({ 
    submissionId: propsId, 
    category: propsCategory, 
    isModal = false, 
    onClose 
}) {
    const { isDarkMode } = useTheme();
    const { id: urlId } = useParams();
    const id = propsId || urlId;
    
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const siteId = searchParams.get("siteId");
    const category = propsCategory || searchParams.get("category") || "General forms";
    const action = searchParams.get("action");
    const containerRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [formMetadata, setFormMetadata] = useState({ name: "", tags: "" });
    const hasDownloaded = useRef(false);

    // State structure
    const [docInfo, setDocInfo] = useState({
        date: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        docNo: "SHEQ-INST-01",
        approvedBy: "Management",
        logo: "",
        logoRight: "",
        signature: ""
    });

    const [formSections, setFormSections] = useState(INSTALLATION_STANDARDS);
    
    const [headerLabels, setHeaderLabels] = useState({
        formTitle: category === "SHEQ Inspection" ? "SHEQ INSPECTION SERVICE REPORT" : "SHEQ INSTALLATION SERVICE REPORT",
        dateLabel: "Date",
        docNoLabel: "Document No.",
        approvedByLabel: "Approved by",
        clientLabel: "Client",
        siteAddressLabel: "Site Address",
        equipmentIdLabel: "Equipment ID",
        engineersLabel: "Engineer(s)",
        dateFieldLabel: "Date",
        auditorLabel: "Auditor",
        serviceManagerLabel: "Service Manager",
        siteContactLabel: "Site Contact",
        projectSummaryLabel: "Project Summary - Assessment of the project H&S status",
        reportDistributionLabel: "Report Distribution",
        remedialColLabel: "Comments",
        ratingColLabel: "RATING",
        scoreColLabel: "SCORE",
        uploadLabel: "PHOTOS / DOCUMENTS",
        commentsLabel: "INSPECTOR'S FINAL COMMENTS / SUMMARY",
        headerTitle: category === "SHEQ Inspection" ? "SHEQ Inspection" : "SHEQ Installation",
    });

    useEffect(() => {
        if (category === "SHEQ Inspection") {
            setFormSections(INSTALLATION_STANDARDS);
            setHeaderLabels(prev => ({ ...prev, formTitle: "SHEQ INSPECTION SERVICE REPORT", headerTitle: "SHEQ Inspection" }));
        } else if (category === "SHEQ Installation") {
            setFormSections(SHQ_INSTALLATION_STANDARDS);
            setHeaderLabels(prev => ({ ...prev, formTitle: "SHEQ INSTALLATION SERVICE REPORT", headerTitle: "SHEQ Installation" }));
        }
    }, [category]);

    const [deleteDialog, setDeleteDialog] = useState({
        open: false,
        type: 'item',
        catIdx: null,
        subIdx: null,
        itemIdx: null,
        sectionKey: null
    });

    const [visibleSections, setVisibleSections] = useState({
        uploads: true,
        comments: true,
        logoLeft: true,
        logoRight: true,
        header: true,
        signatures: true,
        summary: true
    });

    const [formData, setFormData] = useState({
        client: "",
        siteAddress: "",
        equipmentId: "",
        engineers: "",
        dateValue: "",
        auditor: "",
        serviceManager: "",
        siteContact: "",
        projectStatus: "",
        distribution: {
            installationDirector: false,
            sheqAdvisor: false,
            principalContractor: false
        },
        measures: Array(20).fill({ compliant: "", comments: "" }),
        installationMeasures: {},
        actions: Array(6).fill({ actionRequired: "", byWho: "", byWhen: "", dateClosed: "" }),
        comments: "",
        images: []
    });

    useEffect(() => {
        if (id) {
            loadSubmission(id);
        }
    }, [id]);

    useEffect(() => {
        if (!loading && action === "download" && id && !hasDownloaded.current) {
            hasDownloaded.current = true;
            setDownloading(true);
            setTimeout(() => {
                downloadPdfFromRef(containerRef, `SHEQ_Installation_${id}`, () => {
                    setDownloading(false);
                    navigate(category === "SHEQ Inspection" ? '/sheq-inspection' : '/shq-installation');
                });
            }, 800);
        }
    }, [loading, action, id]);

    const loadSubmission = async (submissionId) => {
        setLoading(true);
        try {
            const res = await api.get(`/forms/responses/${submissionId}`);
            if (res.data?.success) {
                const submission = res.data.data;
                if (submission && submission.answers) {
                    const ans = submission.answers;
                    if (ans.headerLabels) setHeaderLabels(prev => ({ ...prev, ...ans.headerLabels }));
                    if (ans.formSections) setFormSections(ans.formSections);
                    if (ans.visibleSections) setVisibleSections(prev => ({ ...prev, ...ans.visibleSections }));
                    if (ans.docInfo) setDocInfo(prev => ({ ...prev, ...ans.docInfo }));
                    if (ans.formData) setFormData(prev => ({ ...prev, ...ans.formData }));
                    setFormMetadata({
                        name: ans.name || `${category === "SHEQ Inspection" ? "Inspection" : "Installation"} - ${new Date(submission.createdAt).toLocaleDateString()}`,
                        tags: ans.tags || ""
                    });
                }
            }
        } catch (e) {
            console.error("Failed to load submission", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveClick = () => {
        if (id) {
            setSaveDialogOpen(true);
        } else {
            executeSave(false);
        }
    };

    const executeSave = async (asNew = false, name = "", tags = "") => {
        setSaving(true);
        try {
            const payload = { 
                docInfo, 
                headerLabels, 
                formSections,
                visibleSections,
                formData,
                name: name || formMetadata.name,
                tags: tags || formMetadata.tags
            };
            if (siteId) payload.siteId = siteId;
            
            if (id && !asNew) {
                await api.put(`/forms/responses/${id}`, { answers: payload });
            } else {
                const formId = await getOrCreateTemplateForm(category === "SHEQ Inspection" ? "SHEQ Inspection" : "SHEQ Installation");
                await api.post(`/forms/${formId}/responses`, {
                    answers: payload,
                    category: category
                });
            }
            
            setSaveDialogOpen(false);
            if (isModal && onClose) {
                onClose(true); // true means success
                return;
            }
            if (category === "SHEQ Inspection") {
                navigate('/sheq-inspection');
            } else if (category === "SHEQ Installation") {
                navigate('/shq-installation');
            } else if (siteId) {
                navigate('/sitepack-management', { state: { siteId, moduleTitle: category } });
            } else {
                navigate('/general-forms');
            }
        } catch (e) {
            console.error("Failed to save", e);
        } finally {
            setSaving(false);
        }
    };

    const updateMeasure = (index, field) => (e) => {
        setFormData(prev => {
            const newMeasures = [...prev.measures];
            newMeasures[index] = { ...newMeasures[index], [field]: e.target.value };
            return { ...prev, measures: newMeasures };
        });
    };

    const updateInstallationMeasure = (key, field, value) => {
        setFormData(prev => ({
            ...prev,
            installationMeasures: { 
                ...prev.installationMeasures, 
                [key]: { 
                    ...(prev.installationMeasures[key] || {}), 
                    [field]: value 
                } 
            }
        }));
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setFormData(prev => ({
                    ...prev,
                    images: [...(prev.images || []), ev.target.result]
                }));
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (index) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const updateAction = (index, field) => (e) => {
        setFormData(prev => {
            const newActions = [...prev.actions];
            newActions[index] = { ...newActions[index], [field]: e.target.value };
            return { ...prev, actions: newActions };
        });
    };

    const handleAddItem = (catIdx, subIdx) => {
        const newSections = [...formSections];
        const newKey = `custom_${Date.now()}`;
        newSections[catIdx].subcategories[subIdx].items.push({ label: "New Item", key: newKey });
        setFormSections(newSections);
    };

    const handleAddSubcategory = (catIdx) => {
        const newSections = [...formSections];
        newSections[catIdx].subcategories.push({
            title: "New Sub-section",
            subtitle: "",
            items: [{ label: "New Item", key: `custom_${Date.now()}` }]
        });
        setFormSections(newSections);
    };

    const handleAddCategory = () => {
        setFormSections([
            ...formSections,
            {
                category: "New Section",
                subcategories: [{
                    title: "New Sub-section",
                    subtitle: "",
                    items: [{ label: "New Item", key: `custom_${Date.now()}` }]
                }]
            }
        ]);
    };

    const confirmDeleteItem = (catIdx, subIdx, itemIdx) => {
        setDeleteDialog({ open: true, type: 'item', catIdx, subIdx, itemIdx });
    };

    const confirmDeleteSubcategory = (catIdx, subIdx) => {
        setDeleteDialog({ open: true, type: 'subcategory', catIdx, subIdx, itemIdx: null });
    };

    const confirmDeleteCategory = (catIdx) => {
        setDeleteDialog({ open: true, type: 'category', catIdx, subIdx: null, itemIdx: null });
    };

    const summaryData = useMemo(() => {
        const categories = [];
        let grandRating = 0;
        let grandScore = 0;

        formSections.forEach(cat => {
            const isSpecial = cat.category === "OTHER COMMENTS/OBSERVATIONS" || cat.category === "OTHER CONTRACTORS";
            if (isSpecial) return;

            cat.subcategories.forEach(sub => {
                let subRating = 0;
                let subScore = 0;

                sub.items.forEach(item => {
                    const scoreVal = formData.installationMeasures[item.key]?.score;
                    
                    if (scoreVal !== "N/A" && scoreVal !== "NIU") {
                        subRating += (item.rating || 0);
                        if (scoreVal) {
                            const parsed = parseInt(scoreVal);
                            if (!isNaN(parsed)) subScore += parsed;
                        }
                    }
                });

                const rate = subRating > 0 ? Math.round((subScore / subRating) * 100) : 0;
                const avgScore = subRating > 0 ? (subScore / (subRating / 3)).toFixed(2) : "-"; // Assuming 3 is max per item

                categories.push({
                    name: sub.title,
                    fullName: sub.title,
                    rating: subRating,
                    maxScore: subRating, // Assuming 3 is max per item and rating is sum of 3s
                    score: subScore,
                    avgScore: avgScore,
                    rate: rate,
                    color: rate >= 90 ? '#10b981' : rate >= 75 ? '#f59e0b' : '#ef4444'
                });

                grandRating += subRating;
                grandScore += subScore;
            });
        });

        const overallRate = grandRating > 0 ? Math.round((grandScore / grandRating) * 100) : 0;

        return { items: categories, overallRating: grandRating, overallScore: grandScore, overallRate };

        return { items: categories, overallRating: grandRating, overallScore: grandScore, overallRate };
    }, [formSections, formData.installationMeasures]);

    const calculateSummaryData = () => summaryData;

    const confirmDeleteSection = (sectionKey) => {
        setDeleteDialog({ open: true, type: 'special_section', sectionKey, catIdx: null, subIdx: null, itemIdx: null });
    };

    const handleDeleteItem = () => {
        const { type, catIdx, subIdx, itemIdx, sectionKey } = deleteDialog;
        const newSections = [...formSections];
        
        if (type === 'item') {
            newSections[catIdx].subcategories[subIdx].items.splice(itemIdx, 1);
            setFormSections(newSections);
        } else if (type === 'subcategory') {
            newSections[catIdx].subcategories.splice(subIdx, 1);
            setFormSections(newSections);
        } else if (type === 'category') {
            newSections.splice(catIdx, 1);
            setFormSections(newSections);
        } else if (type === 'special_section') {
            setVisibleSections(prev => ({ ...prev, [sectionKey]: false }));
        }
        
        setDeleteDialog({ open: false, type: 'item', catIdx: null, subIdx: null, itemIdx: null, sectionKey: null });
    };

    const updateSectionLabel = (catIdx, value) => {
        const newSections = [...formSections];
        newSections[catIdx].category = value;
        setFormSections(newSections);
    };

    const updateSubcategoryLabel = (catIdx, subIdx, field, value) => {
        const newSections = [...formSections];
        newSections[catIdx].subcategories[subIdx][field] = value;
        setFormSections(newSections);
    };

    const updateItemLabel = (catIdx, subIdx, itemIdx, value) => {
        const newSections = [...formSections];
        newSections[catIdx].subcategories[subIdx].items[itemIdx].label = value;
        setFormSections(newSections);
    };

    const updateDistribution = (field) => (e) => {
        setFormData({
            ...formData,
            distribution: { ...formData.distribution, [field]: e.target.checked }
        });
    };

    const borderColor = isDarkMode ? "#334155" : "#E2E8F0";
    const headerBgColor = isDarkMode ? "rgba(255,255,255,0.03)" : "#F8FAFC";
    const customBlue = "#003049"; // New Dark Blue
    const sectionTitleBgColor = "#004a6e"; // Corresponding lighter shade
    const sectionTitleTextColor = "#FFF";
    const textColor = isDarkMode ? "#F9FAFB" : "#111827";
    const cellPadding = "4px 8px";

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
        </Box>
    );

    const formContent = (
        <Box sx={{ p: isModal ? 0 : 3 }}>
            <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {!isModal ? (
                    <IconButton 
                        onClick={() => {
                            if (category === "SHEQ Inspection") {
                                navigate('/sheq-inspection');
                            } else if (category === "SHEQ Installation") {
                                navigate('/shq-installation');
                            } else if (siteId) {
                                navigate('/sitepack-management', { state: { siteId, moduleTitle: category } });
                            } else {
                                navigate('/general-forms');
                            }
                        }} 
                        sx={{ bgcolor: isDarkMode ? '#374151' : '#E5E7EB' }}
                    >
                        <ArrowLeft size={20} color={isDarkMode ? '#F9FAFB' : '#111827'} />
                    </IconButton>
                ) : (
                    <Box /> // Empty box to maintain justify-content: space-between
                )}
                <Box sx={{ display: 'flex', gap: 2 }}>
                    {isModal && (
                        <Button 
                            variant="outlined" 
                            onClick={() => onClose()}
                            sx={{ borderRadius: "12px", textTransform: 'none', px: 3 }}
                        >
                            Cancel
                        </Button>
                    )}
                    <Button 
                        variant="contained" 
                        onClick={handleSaveClick}
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save size={20} />}
                        sx={{ 
                            bgcolor: customBlue, 
                            color: "#FFFFFF", 
                            fontWeight: 600, 
                            borderRadius: "12px",
                            boxShadow: `0 4px 14px 0 ${isDarkMode ? 'rgba(0,0,0,0.39)' : 'rgba(2, 132, 199, 0.39)'}`,
                            px: 4,
                            py: 1.5,
                            textTransform: 'none',
                            fontSize: '1rem',
                            transition: 'all 0.2s ease-in-out',
                            "&:hover": { 
                                bgcolor: "#004a6e", 
                                boxShadow: `0 6px 20px rgba(2, 132, 199, 0.23)`,
                                transform: 'translateY(-1px)'
                            } 
                        }}
                    >
                        {downloading ? "Downloading..." : (saving ? "Saving..." : "Save")}
                    </Button>
                </Box>
            </Box>

            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                mb: 8, 
                overflow: downloading ? "visible" : "auto",
                height: downloading ? "auto" : "unset"
            }}>
                <Paper 
                    ref={containerRef}
                    elevation={0} 
                    sx={{ 
                        width: downloading ? "1100px" : "100%", 
                        maxWidth: (downloading || isModal) ? "unset" : "1100px", 
                        minWidth: downloading ? "1100px" : "unset",
                        minHeight: downloading ? "max-content" : "unset",
                        height: downloading ? "auto" : "unset",
                        overflow: downloading ? "visible" : "hidden",
                        p: { xs: 2, md: 5 }, 
                        pb: downloading ? 10 : 5, 
                        bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF", 
                        color: textColor,
                        borderRadius: "12px",
                        border: `1px solid ${borderColor}`,
                        boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0,0,0,0.5)" : "0 10px 15px -3px rgba(0,0,0,0.1)"
                    }}
                >
                    {/* Professional Header Section */}
                    {visibleSections.header && (
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, border: `1px solid ${borderColor}`, mb: 4, bgcolor: isDarkMode ? "#1B212C" : "#FFF" }}>
                        {/* Logo Left */}
                        {visibleSections.logoLeft && (
                            <Box sx={{ 
                                width: { xs: '100%', md: '25%' }, 
                                p: 2, 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                borderRight: { xs: 'none', md: `1px solid ${borderColor}` },
                                borderBottom: { xs: `1px solid ${borderColor}`, md: 'none' },
                                position: 'relative'
                            }}>
                                {!downloading && (
                                    <Tooltip title="Delete Logo Slot">
                                        <IconButton size="small" onClick={() => confirmDeleteSection('logoLeft')} sx={{ position: 'absolute', top: 5, left: 5, color: 'error.main', opacity: 0.3, '&:hover': { opacity: 1 } }}>
                                            <Trash2 size={14} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {docInfo.logo ? (
                                    <Box sx={{ position: 'relative', width: '100%', textAlign: 'center' }}>
                                        <Box component="img" src={docInfo.logo} sx={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }} />
                                        {!downloading && (
                                            <Button variant="text" size="small" component="label" sx={{ display: 'block', mx: 'auto', mt: 1, textTransform: 'none', fontSize: '0.7rem' }}>
                                                Change Logo
                                                <input type="file" hidden accept="image/*" onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => setDocInfo(prev => ({ ...prev, logo: ev.target.result }));
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </Button>
                                        )}
                                    </Box>
                                ) : (
                                    !downloading && (
                                        <Button variant="outlined" component="label" size="small" sx={{ textTransform: 'none' }}>
                                            Upload Logo
                                            <input type="file" hidden accept="image/*" onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => setDocInfo(prev => ({ ...prev, logo: ev.target.result }));
                                                    reader.readAsDataURL(file);
                                                }
                                            }} />
                                        </Button>
                                    )
                                )}
                            </Box>
                        )}

                        {/* Title & Info Middle */}
                        <Box sx={{ 
                            width: { 
                                xs: '100%', 
                                md: (visibleSections.logoLeft && visibleSections.logoRight) ? '50%' : (visibleSections.logoLeft || visibleSections.logoRight) ? '75%' : '100%' 
                            }, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            borderRight: { xs: 'none', md: visibleSections.logoRight ? `1px solid ${borderColor}` : 'none' },
                            position: 'relative'
                        }}>
                            {!downloading && (
                                <Tooltip title="Delete Entire Header Section">
                                    <IconButton size="small" onClick={() => confirmDeleteSection('header')} sx={{ position: 'absolute', top: 5, right: 5, color: 'error.main', opacity: 0.3, '&:hover': { opacity: 1 }, zIndex: 10 }}>
                                        <Trash2 size={14} />
                                    </IconButton>
                                </Tooltip>
                            )}
                            <Box sx={{ 
                                flex: 1.5, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                borderBottom: `1px solid ${borderColor}`,
                                p: 2,
                                bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#F8FAFC'
                            }}>
                                {downloading ? (
                                    <Typography sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: customBlue, textAlign: 'center' }}>
                                        {headerLabels.formTitle}
                                    </Typography>
                                ) : (
                                    <TextField
                                        fullWidth
                                        variant="standard"
                                        multiline
                                        value={headerLabels.formTitle}
                                        onChange={(e) => setHeaderLabels(prev => ({ ...prev, formTitle: e.target.value }))}
                                        InputProps={{ 
                                            disableUnderline: true, 
                                            sx: { fontWeight: 'bold', fontSize: '1.2rem', color: customBlue, input: { textAlign: 'center' } } 
                                        }}
                                        sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                                    />
                                )}
                            </Box>
                            <Box sx={{ display: 'flex', flex: 1 }}>
                                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                                    <Box sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F1F5F9', p: 0.5, borderBottom: `1px solid ${borderColor}`, textAlign: 'center', minHeight: '25px', display: 'flex', alignItems: 'center' }}>
                                        {downloading ? (
                                            <Typography sx={{ width: '100%', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{headerLabels.dateLabel}</Typography>
                                        ) : (
                                            <TextField
                                                fullWidth
                                                variant="standard"
                                                value={headerLabels.dateLabel}
                                                onChange={(e) => setHeaderLabels(prev => ({ ...prev, dateLabel: e.target.value }))}
                                                InputProps={{ disableUnderline: true, sx: { fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', input: { textAlign: 'center', p: 0 } } }}
                                            />
                                        )}
                                    </Box>
                                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <HeaderInput downloading={downloading} textColor={textColor} value={docInfo.date} onChange={(e) => setDocInfo(prev => ({ ...prev, date: e.target.value }))} minRows={1} />
                                    </Box>
                                </Box>
                                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                                    <Box sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F1F5F9', p: 0.5, borderBottom: `1px solid ${borderColor}`, textAlign: 'center', minHeight: '25px', display: 'flex', alignItems: 'center' }}>
                                        {downloading ? (
                                            <Typography sx={{ width: '100%', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{headerLabels.docNoLabel}</Typography>
                                        ) : (
                                            <TextField
                                                fullWidth
                                                variant="standard"
                                                value={headerLabels.docNoLabel}
                                                onChange={(e) => setHeaderLabels(prev => ({ ...prev, docNoLabel: e.target.value }))}
                                                InputProps={{ disableUnderline: true, sx: { fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', input: { textAlign: 'center', p: 0 } } }}
                                            />
                                        )}
                                    </Box>
                                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <HeaderInput downloading={downloading} textColor={textColor} value={docInfo.docNo} onChange={(e) => setDocInfo(prev => ({ ...prev, docNo: e.target.value }))} minRows={1} />
                                    </Box>
                                </Box>
                                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F1F5F9', p: 0.5, borderBottom: `1px solid ${borderColor}`, textAlign: 'center', minHeight: '25px', display: 'flex', alignItems: 'center' }}>
                                        {downloading ? (
                                            <Typography sx={{ width: '100%', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{headerLabels.approvedByLabel}</Typography>
                                        ) : (
                                            <TextField
                                                fullWidth
                                                variant="standard"
                                                value={headerLabels.approvedByLabel}
                                                onChange={(e) => setHeaderLabels(prev => ({ ...prev, approvedByLabel: e.target.value }))}
                                                InputProps={{ disableUnderline: true, sx: { fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', input: { textAlign: 'center', p: 0 } } }}
                                            />
                                        )}
                                    </Box>
                                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <HeaderInput downloading={downloading} textColor={textColor} value={docInfo.approvedBy} onChange={(e) => setDocInfo(prev => ({ ...prev, approvedBy: e.target.value }))} minRows={1} />
                                    </Box>
                                </Box>
                            </Box>
                        </Box>

                        {/* Logo Right */}
                        {visibleSections.logoRight && (
                            <Box sx={{ 
                                width: { xs: '100%', md: '25%' }, 
                                p: 2, 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                borderTop: { xs: `1px solid ${borderColor}`, md: 'none' },
                                position: 'relative'
                            }}>
                                {!downloading && (
                                    <Tooltip title="Delete Logo Slot">
                                        <IconButton size="small" onClick={() => confirmDeleteSection('logoRight')} sx={{ position: 'absolute', top: 5, right: 5, color: 'error.main', opacity: 0.3, '&:hover': { opacity: 1 } }}>
                                            <Trash2 size={14} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {docInfo.logoRight ? (
                                    <Box sx={{ position: 'relative', width: '100%', textAlign: 'center' }}>
                                        <Box component="img" src={docInfo.logoRight} sx={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }} />
                                        {!downloading && (
                                            <Button variant="text" size="small" component="label" sx={{ display: 'block', mx: 'auto', mt: 1, textTransform: 'none', fontSize: '0.7rem' }}>
                                                Change Logo
                                                <input type="file" hidden accept="image/*" onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => setDocInfo(prev => ({ ...prev, logoRight: ev.target.result }));
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </Button>
                                        )}
                                    </Box>
                                ) : (
                                    !downloading && (
                                        <Button variant="outlined" component="label" size="small" sx={{ textTransform: 'none' }}>
                                            Upload Right Logo
                                            <input type="file" hidden accept="image/*" onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => setDocInfo(prev => ({ ...prev, logoRight: ev.target.result }));
                                                    reader.readAsDataURL(file);
                                                }
                                            }} />
                                        </Button>
                                    )
                                )}
                            </Box>
                        )}
                    </Box>
                )}

                    {/* CUSTOM GRID HEADER */}
                    <Box sx={{ border: `1px solid ${borderColor}`, mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, bgcolor: isDarkMode ? "#1B212C" : "#FFF" }}>
                        {/* Left Column */}
                        <Box sx={{ width: { xs: '100%', md: '33%' }, display: 'flex', flexDirection: 'column', borderRight: { xs: 'none', md: `1px solid ${borderColor}` }, borderBottom: { xs: `1px solid ${borderColor}`, md: 'none' } }}>
                            <HeaderLabel customBlue={customBlue} borderColor={borderColor} downloading={downloading} value={headerLabels.clientLabel} onChange={(v) => setHeaderLabels(prev => ({ ...prev, clientLabel: v }))}>Client</HeaderLabel>
                            <Box sx={{ flex: 1, minHeight: '45px', borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                <HeaderInput downloading={downloading} textColor={textColor} value={formData.client} onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))} minRows={1} />
                            </Box>
                            <HeaderLabel customBlue={customBlue} borderColor={borderColor} downloading={downloading} value={headerLabels.siteAddressLabel} onChange={(v) => setHeaderLabels(prev => ({ ...prev, siteAddressLabel: v }))}>Site Address</HeaderLabel>
                            <Box sx={{ flex: 2, minHeight: '80px', borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'stretch' }}>
                                <HeaderInput downloading={downloading} textColor={textColor} value={formData.siteAddress} onChange={(e) => setFormData(prev => ({ ...prev, siteAddress: e.target.value }))} />
                            </Box>
                            <HeaderLabel customBlue={customBlue} borderColor={borderColor} downloading={downloading} value={headerLabels.equipmentIdLabel} onChange={(v) => setHeaderLabels(prev => ({ ...prev, equipmentIdLabel: v }))}>Equipment ID</HeaderLabel>
                            <Box sx={{ flex: 1, minHeight: '45px', display: 'flex', alignItems: 'center' }}>
                                <HeaderInput downloading={downloading} textColor={textColor} value={formData.equipmentId} onChange={(e) => setFormData(prev => ({ ...prev, equipmentId: e.target.value }))} minRows={1} />
                            </Box>
                        </Box>

                        {/* Slim Divider Column (Hidden on Mobile) */}
                        <Box sx={{ width: '5%', display: { xs: 'none', md: 'flex' }, flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                            {Array(8).fill(0).map((_, i) => (
                                <Box key={i} sx={{ borderBottom: i < 7 ? `1px solid ${borderColor}` : 'none', flex: 1 }} />
                            ))}
                        </Box>

                        {/* Middle Column */}
                        <Box sx={{ width: { xs: '100%', md: '30%' }, display: 'flex', flexDirection: 'column', borderRight: { xs: 'none', md: `1px solid ${borderColor}` }, borderBottom: { xs: `1px solid ${borderColor}`, md: 'none' } }}>
                            <HeaderLabel customBlue={customBlue} borderColor={borderColor} downloading={downloading} value={headerLabels.engineersLabel} onChange={(v) => setHeaderLabels(prev => ({ ...prev, engineersLabel: v }))}>Engineer(s)</HeaderLabel>
                            <Box sx={{ flex: 1, borderBottom: `1px solid ${borderColor}` }}>
                                <HeaderInput downloading={downloading} textColor={textColor} value={formData.engineers} onChange={(e) => setFormData(prev => ({ ...prev, engineers: e.target.value }))} minRows={10} />
                            </Box>
                            {/* Filling empty space with lines like image - Hidden on Mobile */}
                            <Box sx={{ height: '100px', display: { xs: 'none', md: 'flex' }, flexDirection: 'column' }}>
                                {Array(4).fill(0).map((_, i) => (
                                    <Box key={i} sx={{ borderTop: `1px solid ${borderColor}`, flex: 1 }} />
                                ))}
                            </Box>
                        </Box>

                        {/* Right Column */}
                        <Box sx={{ width: { xs: '100%', md: '32%' }, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', borderBottom: `1px solid ${borderColor}` }}>
                                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${borderColor}` }}>
                                    <HeaderLabel customBlue={customBlue} borderColor={borderColor} downloading={downloading} value={headerLabels.dateFieldLabel} onChange={(v) => setHeaderLabels(prev => ({ ...prev, dateFieldLabel: v }))}>Date</HeaderLabel>
                                    <Box sx={{ minHeight: '45px', display: 'flex', alignItems: 'center' }}>
                                        <HeaderInput downloading={downloading} textColor={textColor} value={formData.dateValue} onChange={(e) => setFormData(prev => ({ ...prev, dateValue: e.target.value }))} minRows={1} />
                                    </Box>
                                </Box>
                                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <HeaderLabel customBlue={customBlue} borderColor={borderColor} downloading={downloading} value={headerLabels.auditorLabel} onChange={(v) => setHeaderLabels(prev => ({ ...prev, auditorLabel: v }))}>Auditor</HeaderLabel>
                                    <Box sx={{ minHeight: '45px', display: 'flex', alignItems: 'center' }}>
                                        <HeaderInput downloading={downloading} textColor={textColor} value={formData.auditor} onChange={(e) => setFormData(prev => ({ ...prev, auditor: e.target.value }))} minRows={1} />
                                    </Box>
                                </Box>
                            </Box>
                            
                            <HeaderLabel customBlue={customBlue} borderColor={borderColor} downloading={downloading} value={headerLabels.serviceManagerLabel} onChange={(v) => setHeaderLabels(prev => ({ ...prev, serviceManagerLabel: v }))}>Service Manager</HeaderLabel>
                            <Box sx={{ minHeight: '45px', borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                <HeaderInput downloading={downloading} textColor={textColor} value={formData.serviceManager} onChange={(e) => setFormData(prev => ({ ...prev, serviceManager: e.target.value }))} minRows={1} />
                            </Box>
                            
                            <HeaderLabel customBlue={customBlue} borderColor={borderColor} downloading={downloading} value={headerLabels.siteContactLabel} onChange={(v) => setHeaderLabels(prev => ({ ...prev, siteContactLabel: v }))}>Site Contact</HeaderLabel>
                            <Box sx={{ flex: 1, minHeight: '80px', display: 'flex', alignItems: 'stretch' }}>
                                <HeaderInput downloading={downloading} textColor={textColor} value={formData.siteContact} onChange={(e) => setFormData(prev => ({ ...prev, siteContact: e.target.value }))} />
                            </Box>
                        </Box>
                    </Box>

                    {/* Project Summary & Distribution Section (Triple-Column Layout) */}
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, border: `1px solid ${borderColor}`, mb: 4, bgcolor: isDarkMode ? "#1B212C" : "#FFF" }}>
                        {/* Project Status Column (Left) */}
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderBottom: { xs: `1px solid ${borderColor}`, md: 'none' } }}>
                            <Box sx={{ bgcolor: customBlue, color: "#FFF", textAlign: 'center', py: 0.5, px: 2, fontWeight: 'bold', fontSize: '0.8rem', borderBottom: `1px solid ${borderColor}`, minHeight: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {downloading ? headerLabels.projectSummaryLabel : (
                                    <TextField 
                                        fullWidth 
                                        variant="standard" 
                                        value={headerLabels.projectSummaryLabel} 
                                        onChange={(e) => setHeaderLabels(prev => ({ ...prev, projectSummaryLabel: e.target.value }))}
                                        InputProps={{ disableUnderline: true, sx: { color: 'white', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center', input: { textAlign: 'center' } } }}
                                    />
                                )}
                            </Box>
                            <Box sx={{ p: 1, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {downloading ? (
                                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-around', width: '100%' }}>
                                        {['green', 'amber', 'red'].map(status => (
                                            <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Box sx={{ 
                                                    width: 14, 
                                                    height: 14, 
                                                    borderRadius: '50%', 
                                                    border: `1.5px solid ${status === 'green' ? '#228B22' : status === 'amber' ? '#D2691E' : '#DC143C'}`, 
                                                    bgcolor: formData.projectStatus === status ? (status === 'green' ? '#228B22' : status === 'amber' ? '#D2691E' : '#DC143C') : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {formData.projectStatus === status && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#FFF' }} />}
                                                </Box>
                                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 'bold', color: status === 'green' ? '#228B22' : status === 'amber' ? '#D2691E' : '#DC143C' }}>
                                                    {status.toUpperCase()}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                ) : (
                                    <RadioGroup 
                                        row 
                                        value={formData.projectStatus} 
                                        onChange={(e) => setFormData(prev => ({...prev, projectStatus: e.target.value}))}
                                        sx={{ justifyContent: 'space-around', width: '100%' }}
                                    >
                                        <FormControlLabel value="green" control={<Radio size="small" />} label={<Typography sx={{fontSize: '0.75rem', fontWeight: 'bold', color: '#228B22'}}>GREEN</Typography>} />
                                        <FormControlLabel value="amber" control={<Radio size="small" />} label={<Typography sx={{fontSize: '0.75rem', fontWeight: 'bold', color: '#D2691E'}}>AMBER</Typography>} />
                                        <FormControlLabel value="red" control={<Radio size="small" />} label={<Typography sx={{fontSize: '0.75rem', fontWeight: 'bold', color: '#DC143C'}}>RED</Typography>} />
                                    </RadioGroup>
                                )}
                            </Box>
                        </Box>

                        {/* Slim Divider (Middle) - Hidden on Mobile */}
                        <Box sx={{ width: '40px', borderLeft: `1px solid ${borderColor}`, borderRight: `1px solid ${borderColor}`, display: { xs: 'none', md: 'flex' }, flexDirection: 'column' }}>
                            {Array(4).fill(0).map((_, i) => (
                                <Box key={i} sx={{ borderBottom: i < 3 ? `1px solid ${borderColor}` : 'none', flex: 1 }} />
                            ))}
                        </Box>

                        {/* Distribution Column (Right) */}
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ bgcolor: customBlue, color: "#FFF", textAlign: 'center', py: 0.5, px: 2, fontWeight: 'bold', fontSize: '0.8rem', borderBottom: `1px solid ${borderColor}`, minHeight: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {downloading ? headerLabels.distributionLabel : (
                                    <TextField 
                                        fullWidth 
                                        variant="standard" 
                                        value={headerLabels.distributionLabel} 
                                        onChange={(e) => setHeaderLabels(prev => ({ ...prev, distributionLabel: e.target.value }))}
                                        InputProps={{ disableUnderline: true, sx: { color: 'white', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center', input: { textAlign: 'center' } } }}
                                    />
                                )}
                            </Box>
                            <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
                                {[
                                    { key: 'installationDirector', label: 'Installation Director' },
                                    { key: 'sheqAdvisor', label: 'SHEQ Advisor' },
                                    { key: 'principalContractor', label: 'Principal Contractor' }
                                ].map(item => (
                                    downloading ? (
                                        <Box key={item.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                            <Box sx={{ 
                                                width: 14, 
                                                height: 14, 
                                                border: `1.5px solid ${customBlue}`, 
                                                borderRadius: '3px',
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                bgcolor: formData.distribution[item.key] ? customBlue : 'transparent'
                                            }}>
                                                {formData.distribution[item.key] && <Typography sx={{ color: '#FFF', fontSize: '10px', fontWeight: 'bold' }}>✓</Typography>}
                                            </Box>
                                            <Typography sx={{ fontSize: '0.75rem' }}>{item.label}</Typography>
                                        </Box>
                                    ) : (
                                        <FormControlLabel 
                                            key={item.key}
                                            control={<Checkbox size="small" checked={formData.distribution[item.key]} onChange={updateDistribution(item.key)} />} 
                                            label={<Typography sx={{fontSize: '0.75rem'}}>{item.label}</Typography>} 
                                        />
                                    )
                                ))}
                            </Box>
                        </Box>
                    </Box>

                    {/* Summary Section (Scoring & Graphs) - ONLY SHOWN ON SAVED FORMS */}
                    {id && visibleSections.summary && (
                        <Box sx={{ mt: 6, mb: 6, position: 'relative', breakInside: 'avoid' }}>
                            {!downloading && (
                                <Tooltip title="Delete Summary Section">
                                    <IconButton size="small" onClick={() => confirmDeleteSection('summary')} sx={{ position: 'absolute', top: -10, right: 0, color: 'error.main', opacity: 0.3, '&:hover': { opacity: 1 }, zIndex: 10 }}>
                                        <Trash2 size={16} />
                                    </IconButton>
                                </Tooltip>
                            )}
                            
                            <Typography sx={{ fontWeight: 'bold', color: customBlue, fontSize: '1.2rem', mb: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Scoring Summary & Performance Analytics
                            </Typography>

                            {/* Analytics Graph */}
                            <Box sx={{ 
                                mt: 4, 
                                p: 0, // Padding moved to internal boxes to prevent border clipping on breaks
                                borderRadius: '16px', 
                                border: `1px solid ${borderColor}`,
                                bgcolor: isDarkMode ? "#111827" : "#FFF",
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
                                overflow: 'visible',
                                display: 'block',
                                breakInside: 'avoid',
                                pageBreakInside: 'avoid',
                                position: 'relative'
                            }}>
                                <Box sx={{ p: 2, borderBottom: `1px solid ${borderColor}`, bgcolor: isDarkMode ? "rgba(255,255,255,0.02)" : "#f8fafc", breakInside: 'avoid' }}>
                                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#003049', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                                        SCORING SUMMARY & PERFORMANCE ANALYTICS
                                    </Typography>
                                </Box>

                                {/* New Summary Table */}
                                <Box sx={{ overflowX: 'auto' }}>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: '#003049' }}>
                                            <TableRow>
                                                <TableCell sx={{ color: '#FFF', fontWeight: 'bold', fontSize: '0.7rem' }}>ITEM / SECTION</TableCell>
                                                <TableCell align="center" sx={{ color: '#FFF', fontWeight: 'bold', fontSize: '0.7rem' }}>AVERAGE SCORE</TableCell>
                                                <TableCell align="center" sx={{ color: '#FFF', fontWeight: 'bold', fontSize: '0.7rem' }}>MAXIMUM SCORE</TableCell>
                                                <TableCell align="center" sx={{ color: '#FFF', fontWeight: 'bold', fontSize: '0.7rem' }}>% COMPLIANCE RATE</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {calculateSummaryData().items.map((item, idx) => (
                                                <TableRow key={idx} sx={{ bgcolor: idx % 2 === 0 ? 'transparent' : (isDarkMode ? 'rgba(255,255,255,0.02)' : '#fcfcfc') }}>
                                                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: isDarkMode ? '#cbd5e1' : '#1e293b' }}>{item.name}</TableCell>
                                                    <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#003049' }}>{item.avgScore}</TableCell>
                                                    <TableCell align="center" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{item.rating / (item.rating / (item.rating / 3) || 1) * (item.rating / 3 || 0)}</TableCell>
                                                    <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 800, color: item.color }}>{item.rate}%</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow sx={{ bgcolor: '#f0f7ff' }}>
                                                <TableCell colSpan={3} align="right" sx={{ fontWeight: 800, fontSize: '0.8rem', color: '#003049', py: 1.5 }}>OVERALL COMPLIANCE RATE:</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 900, fontSize: '0.9rem', color: calculateSummaryData().overallRate >= 90 ? '#10b981' : calculateSummaryData().overallRate >= 75 ? '#f59e0b' : '#ef4444', py: 1.5 }}>{calculateSummaryData().overallRate}%</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </Box>

                                <Box sx={{ p: 3, borderTop: `1px solid ${borderColor}`, breakInside: 'avoid' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, breakInside: 'avoid' }}>
                                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#003049', letterSpacing: '-0.01em' }}>
                                            Sectional Performance Analytics
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: '#10b981' }} />
                                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>High</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: '#f59e0b' }} />
                                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>Action Needed</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: '#ef4444' }} />
                                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>Critical</Typography>
                                            </Box>
                                        </Box>
                                    </Box>

                                    <Box sx={{ height: `${Math.max(400, calculateSummaryData().items.length * 35)}px` }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart 
                                                data={calculateSummaryData().items} 
                                                layout="vertical"
                                                margin={{ top: 10, right: 50, left: 160, bottom: 10 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "#E2E8F0"} horizontal={true} vertical={false} />
                                                <XAxis type="number" domain={[0, 100]} hide />
                                                <YAxis 
                                                    dataKey="name" 
                                                    type="category"
                                                    tick={{ fontSize: 9, fontWeight: 700, fill: isDarkMode ? "#cbd5e1" : "#1e293b" }}
                                                    width={150}
                                                    axisLine={{ stroke: borderColor }}
                                                    tickLine={false}
                                                />
                                                <RechartsTooltip 
                                                    active={!downloading}
                                                    cursor={{ fill: 'rgba(70, 130, 180, 0.05)' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const data = payload[0].payload;
                                                            return (
                                                                <Box sx={{ bgcolor: isDarkMode ? "#1e293b" : "#FFF", p: 2, borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: `1px solid ${borderColor}` }}>
                                                                    <Typography sx={{ fontWeight: 800, color: '#003049', fontSize: '0.85rem', mb: 1 }}>{data.fullName}</Typography>
                                                                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Compliance: <span style={{ color: data.color, fontWeight: 800 }}>{data.rate}%</span></Typography>
                                                                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.5 }}>Rating: {data.rating} | Score: {data.score}</Typography>
                                                                </Box>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={!downloading}>
                                                    {calculateSummaryData().items.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                    <LabelList dataKey="rate" position="right" style={{ fontSize: 10, fontWeight: 800, fill: isDarkMode ? "#cbd5e1" : "#1e293b" }} formatter={(v) => `${v}%`} offset={10} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    )}

                    {/* Spacer for PDF break protection */}
                    {downloading && <Box sx={{ height: '40px' }} />}

                    {/* Installation Standards Sections (New) */}
                    <Box sx={{ border: `1px solid ${borderColor}`, mb: 4, overflow: 'hidden', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        {/* Table Header Row */}
                        <Box sx={{ display: 'flex', background: `linear-gradient(135deg, ${customBlue} 0%, #004a6e 100%)`, color: "#FFF", fontWeight: 'bold', fontSize: '0.75rem', borderBottom: `1px solid ${borderColor}`, letterSpacing: '0.05em', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
                            <Box sx={{ width: { xs: '40%', md: '35%' }, p: 1.25, borderRight: `1px solid rgba(255,255,255,0.1)`, textAlign: 'center' }}>
                                ITEM
                            </Box>
                            <Box sx={{ width: { xs: '15%', md: '10%' }, p: 1.25, borderRight: `1px solid rgba(255,255,255,0.1)`, textAlign: 'center' }}>
                                {headerLabels.ratingColLabel || "RATING"}
                            </Box>
                            <Box sx={{ width: { xs: '15%', md: '10%' }, p: 1.25, borderRight: `1px solid rgba(255,255,255,0.1)`, textAlign: 'center' }}>
                                {headerLabels.scoreColLabel || "SCORE"}
                            </Box>
                            <Box sx={{ width: { xs: '30%', md: '45%' }, p: 1.25, textAlign: 'center' }}>
                                {headerLabels.remedialColLabel || "Comments"}
                            </Box>
                        </Box>

                        {formSections.map((cat, catIdx) => {
                            const isSpecialSection = cat.category === "OTHER COMMENTS/OBSERVATIONS" || cat.category === "OTHER CONTRACTORS";
                            
                            // Calculate category totals
                            let catRating = 0;
                            let catScore = 0;
                            cat.subcategories.forEach(sub => {
                                sub.items.forEach(item => {
                                    catRating += (item.rating || 0);
                                    const scoreVal = formData.installationMeasures[item.key]?.score;
                                    if (scoreVal && scoreVal !== "N/A" && scoreVal !== "NIU") {
                                        catScore += parseInt(scoreVal);
                                    }
                                });
                            });

                            return (
                                <Box key={catIdx} sx={{ borderBottom: catIdx < formSections.length - 1 ? `3px solid ${borderColor}` : 'none' }}>
                                    {/* Main Category Header */}
                                <Box sx={{ 
                                    p: 1.5, 
                                    bgcolor: customBlue, 
                                    borderBottom: `1px solid ${borderColor}`, 
                                    color: "#FFF", 
                                    fontWeight: 'bold', 
                                    fontSize: '0.9rem', 
                                    letterSpacing: '0.05em', 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    textTransform: 'uppercase',
                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                        {!downloading && (
                                            <Tooltip title="Delete Section">
                                                <IconButton size="small" onClick={() => confirmDeleteCategory(catIdx)} sx={{ color: 'rgba(255,255,255,0.7)', mr: 1, '&:hover': { color: '#FFF' } }}>
                                                    <Trash2 size={16} />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {downloading ? cat.category : (
                                            <TextField
                                                fullWidth
                                                variant="standard"
                                                value={cat.category}
                                                onChange={(e) => updateSectionLabel(catIdx, e.target.value)}
                                                InputProps={{ disableUnderline: true, sx: { fontWeight: 'bold', fontSize: '0.9rem', color: '#FFF', textTransform: 'uppercase' } }}
                                            />
                                        )}
                                    </Box>
                                    {!downloading && cat.category !== "OTHER COMMENTS/OBSERVATIONS" && cat.category !== "OTHER CONTRACTORS" && (
                                        <Button 
                                            size="small" 
                                            variant="text" 
                                            startIcon={<Plus size={14} />} 
                                            onClick={() => handleAddSubcategory(catIdx)}
                                            sx={{ color: '#FFF', textTransform: 'none', fontSize: '0.75rem', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                                        >
                                            Add Sub-section
                                        </Button>
                                    )}
                                </Box>
                                {cat.category === "OTHER COMMENTS/OBSERVATIONS" || cat.category === "OTHER CONTRACTORS" ? (
                                    <Box sx={{ p: 2, bgcolor: isDarkMode ? "rgba(255,255,255,0.02)" : "#FFF" }}>
                                        {downloading ? (
                                            <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', minHeight: '100px' }}>
                                                {formData.installationMeasures[cat.category]?.notes || " "}
                                            </Typography>
                                        ) : (
                                            <TextField
                                                fullWidth
                                                multiline
                                                minRows={6}
                                                variant="outlined"
                                                placeholder={`Enter details for ${cat.category.toLowerCase()}...`}
                                                value={formData.installationMeasures[cat.category]?.notes || ""}
                                                onChange={(e) => updateInstallationMeasure(cat.category, "notes", e.target.value)}
                                                sx={{
                                                    "& .MuiOutlinedInput-root": {
                                                        fontSize: '0.85rem',
                                                        borderRadius: '8px',
                                                        color: textColor
                                                    }
                                                }}
                                            />
                                        )}
                                    </Box>
                                ) : (
                                    cat.subcategories.map((sub, subIdx) => (
                                    <Box key={subIdx}>
                                        {/* Subcategory Header */}
                                        <Box sx={{ 
                                            display: 'flex', 
                                            bgcolor: isDarkMode ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE", // Sky-100
                                            color: customBlue, 
                                            fontWeight: 'bold', 
                                            fontSize: '0.8rem', 
                                            borderBottom: `1px solid ${borderColor}`,
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <Box sx={{ display: 'flex', flex: 1, alignItems: 'center' }}>
                                                {!downloading && (
                                                    <Tooltip title="Delete Sub-section">
                                                        <IconButton size="small" onClick={() => confirmDeleteSubcategory(catIdx, subIdx)} sx={{ color: 'error.main', opacity: 0.5, mx: 0.5, '&:hover': { opacity: 1 } }}>
                                                            <Trash2 size={14} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                <Box sx={{ width: '35%', p: 1, px: 2, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center' }}>
                                                    {downloading ? sub.title : (
                                                        <TextField
                                                            fullWidth
                                                            variant="standard"
                                                            value={sub.title}
                                                            onChange={(e) => updateSubcategoryLabel(catIdx, subIdx, 'title', e.target.value)}
                                                            InputProps={{ disableUnderline: true, sx: { fontWeight: 'bold', fontSize: '0.8rem', color: customBlue } }}
                                                            placeholder="Subcategory Title"
                                                        />
                                                    )}
                                                </Box>
                                                <Box sx={{ width: '10%', borderRight: `1px solid ${borderColor}` }} />
                                                <Box sx={{ width: '10%', borderRight: `1px solid ${borderColor}` }} />
                                                <Box sx={{ flex: 1, p: 1, px: 2, textAlign: 'left', fontSize: '0.7rem', display: 'flex', alignItems: 'center', fontWeight: 600, opacity: 0.9 }}>
                                                    {downloading ? (sub.subtitle || "") : (
                                                        <TextField
                                                            fullWidth
                                                            variant="standard"
                                                            value={sub.subtitle || ""}
                                                            onChange={(e) => updateSubcategoryLabel(catIdx, subIdx, 'subtitle', e.target.value)}
                                                            InputProps={{ disableUnderline: true, sx: { fontSize: '0.7rem', fontWeight: 600 } }}
                                                            placeholder="Subtitle"
                                                        />
                                                    )}
                                                </Box>
                                            </Box>
                                            {!downloading && (
                                                <Box sx={{ pr: 1 }}>
                                                    <Tooltip title="Add Item">
                                                        <IconButton size="small" onClick={() => handleAddItem(catIdx, subIdx)} sx={{ color: customBlue }}>
                                                            <Plus size={16} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            )}
                                        </Box>
                                        {/* Items */}
                                        {sub.items.map((item, itemIdx) => (
                                            <Box key={itemIdx} sx={{ 
                                                display: 'flex', 
                                                borderBottom: `1px solid ${borderColor}`, 
                                                minHeight: '40px',
                                                transition: 'background-color 0.2s',
                                                "&:hover": { bgcolor: isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)" }
                                            }}>
                                        <Box sx={{ width: { xs: '40%', md: '35%' }, p: 1.5, borderRight: `1px solid ${borderColor}`, fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', color: isDarkMode ? "#cbd5e1" : "#334155" }}>
                                                    {!downloading && (
                                                        <Tooltip title="Delete Item">
                                                            <IconButton 
                                                                size="small" 
                                                                onClick={() => confirmDeleteItem(catIdx, subIdx, itemIdx)}
                                                                sx={{ color: 'error.main', p: 0.5, mr: 1, opacity: 0.3, '&:hover': { opacity: 1 } }}
                                                            >
                                                                <Trash2 size={12} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                    {downloading ? item.label : (
                                                        <TextField
                                                            fullWidth
                                                            variant="standard"
                                                            value={item.label}
                                                            onChange={(e) => updateItemLabel(catIdx, subIdx, itemIdx, e.target.value)}
                                                            InputProps={{ disableUnderline: true, sx: { fontSize: '0.8rem' } }}
                                                            placeholder="Item Label"
                                                        />
                                                    )}
                                                </Box>
                                                <Box sx={{ width: { xs: '15%', md: '10%' }, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: isDarkMode ? "rgba(255,255,255,0.03)" : "#f1f5f9" }}>
                                                    <Typography sx={{ fontWeight: 'bold', fontSize: '0.9rem', color: isDarkMode ? "#94a3b8" : "#64748b" }}>
                                                        {item.rating ?? 3}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ width: { xs: '15%', md: '10%' }, borderRight: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: isDarkMode ? "rgba(255,255,255,0.03)" : "#f8fafc" }}>
                                                    {downloading ? (
                                                        <Typography sx={{ fontWeight: 'bold', fontSize: '0.95rem', color: customBlue }}>
                                                            {formData.installationMeasures[item.key]?.score || "-"}
                                                        </Typography>
                                                    ) : (
                                                        <TextField 
                                                            select
                                                            variant="standard" 
                                                            value={formData.installationMeasures[item.key]?.score || ""} 
                                                            onChange={(e) => updateInstallationMeasure(item.key, "score", e.target.value)}
                                                            SelectProps={{ 
                                                                displayEmpty: true,
                                                                MenuProps: { PaperProps: { sx: { borderRadius: '8px' } } },
                                                                sx: { 
                                                                    '& .MuiSelect-select': { 
                                                                        textAlign: 'center', 
                                                                        fontWeight: 'bold', 
                                                                        fontSize: '0.95rem', 
                                                                        color: customBlue,
                                                                        py: 0.5,
                                                                        pr: '0 !important' // Remove extra padding for arrow
                                                                    },
                                                                    '& .MuiSelect-icon': { display: 'none' } // Hide arrow for cleaner look
                                                                }
                                                            }}
                                                            InputProps={{ disableUnderline: true }}
                                                            sx={{ width: '100%' }}
                                                        >
                                                            <MenuItem value="">-</MenuItem>
                                                            <MenuItem value="0">0</MenuItem>
                                                            <MenuItem value="1">1</MenuItem>
                                                            <MenuItem value="2">2</MenuItem>
                                                            <MenuItem value="3">3</MenuItem>
                                                            <MenuItem value="N/A">N/A</MenuItem>
                                                            <MenuItem value="NIU">NIU</MenuItem>
                                                        </TextField>
                                                    )}
                                                </Box>
                                                <Box sx={{ width: { xs: '30%', md: '45%' }, display: 'flex', alignItems: 'center' }}>
                                                    {downloading ? (
                                                        <Typography sx={{ px: 1.5, py: 1, fontSize: '0.8rem', color: textColor, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                            {formData.installationMeasures[item.key]?.remedial || " "}
                                                        </Typography>
                                                    ) : (
                                                        <TextField 
                                                            fullWidth 
                                                            variant="standard" 
                                                            multiline
                                                            value={formData.installationMeasures[item.key]?.remedial || ""} 
                                                            onChange={(e) => updateInstallationMeasure(item.key, "remedial", e.target.value)}
                                                            InputProps={{ disableUnderline: true, sx: { px: 1.5, py: 1, fontSize: '0.8rem', color: textColor } }}
                                                            placeholder="Comments"
                                                        />
                                                    )}
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                )))}

                                {/* Category Total Row */}
                                {!isSpecialSection && (
                                    <Box sx={{ display: 'flex', bgcolor: isDarkMode ? "rgba(0, 186, 211, 0.1)" : "#E0F7FA", borderTop: `2px solid ${customBlue}` }}>
                                        <Box sx={{ width: { xs: '40%', md: '35%' }, p: 1.5, textAlign: 'right', fontWeight: 900, fontSize: '0.8rem', color: customBlue, borderRight: `1px solid ${borderColor}` }}>
                                            TOTAL SCORE
                                        </Box>
                                        <Box sx={{ width: { xs: '15%', md: '10%' }, p: 1.5, textAlign: 'center', fontWeight: 900, fontSize: '0.9rem', color: customBlue, borderRight: `1px solid ${borderColor}` }}>
                                            {catRating}
                                        </Box>
                                        <Box sx={{ width: { xs: '15%', md: '10%' }, p: 1.5, textAlign: 'center', fontWeight: 900, fontSize: '0.9rem', color: customBlue, borderRight: `1px solid ${borderColor}` }}>
                                            {catScore}
                                        </Box>
                                        <Box sx={{ flex: 1, bgcolor: isDarkMode ? "rgba(0, 186, 211, 0.05)" : "#B2EBF2" }} />
                                    </Box>
                                )}
                            </Box>
                        )})}

                        {/* Grand Total Row - Positioned as the final row of the table */}
                        <Box sx={{ display: 'flex', bgcolor: customBlue, color: "#FFF", borderTop: `2px solid ${isDarkMode ? "#000" : "#FFF"}` }}>
                            <Box sx={{ width: { xs: '40%', md: '35%' }, p: 1.5, textAlign: 'right', fontWeight: 900, fontSize: '0.9rem', borderRight: `1px solid rgba(255,255,255,0.2)` }}>
                                TOTAL SCORE
                            </Box>
                            <Box sx={{ width: { xs: '15%', md: '10%' }, p: 1.5, textAlign: 'center', fontWeight: 900, fontSize: '1rem', borderRight: `1px solid rgba(255,255,255,0.2)` }}>
                                {formSections.reduce((acc, cat) => {
                                    let r = 0;
                                    cat.subcategories.forEach(sub => sub.items.forEach(i => r += (i.rating || 0)));
                                    return acc + r;
                                }, 0)}
                            </Box>
                            <Box sx={{ width: { xs: '15%', md: '10%' }, p: 1.5, textAlign: 'center', fontWeight: 900, fontSize: '1rem', borderRight: `1px solid rgba(255,255,255,0.2)` }}>
                                {formSections.reduce((acc, cat) => {
                                    let s = 0;
                                    cat.subcategories.forEach(sub => sub.items.forEach(i => {
                                        const v = formData.installationMeasures[i.key]?.score;
                                        if (v && v !== "N/A" && v !== "NIU") {
                                            const p = parseInt(v);
                                            if (!isNaN(p)) s += p;
                                        }
                                    }));
                                    return acc + s;
                                }, 0)}
                            </Box>
                            <Box sx={{ flex: 1 }} />
                        </Box>
                    </Box>
                        
                        {!downloading && (
                            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', gap: 2, borderTop: `1px solid ${borderColor}` }}>
                                <Button 
                                    variant="outlined" 
                                    startIcon={<Plus size={18} />} 
                                    onClick={handleAddCategory}
                                    sx={{ borderRadius: '12px', px: 3, py: 1, textTransform: 'none', fontWeight: 'bold' }}
                                >
                                    Add New Section
                                </Button>
                                
                                {!visibleSections.uploads && (
                                    <Button 
                                        variant="outlined" 
                                        color="info"
                                        startIcon={<Plus size={18} />} 
                                        onClick={() => setVisibleSections(prev => ({ ...prev, uploads: true }))}
                                        sx={{ borderRadius: '12px', px: 3, py: 1, textTransform: 'none', fontWeight: 'bold' }}
                                    >
                                        Add Uploads
                                    </Button>
                                )}
                                
                                {!visibleSections.comments && (
                                    <Button 
                                        variant="outlined" 
                                        color="info"
                                        startIcon={<Plus size={18} />} 
                                        onClick={() => setVisibleSections(prev => ({ ...prev, comments: true }))}
                                        sx={{ borderRadius: '12px', px: 3, py: 1, textTransform: 'none', fontWeight: 'bold' }}
                                    >
                                        Add Comments
                                    </Button>
                                )}

                                {!visibleSections.logoLeft && (
                                    <Button 
                                        variant="outlined" 
                                        color="info"
                                        startIcon={<Plus size={18} />} 
                                        onClick={() => setVisibleSections(prev => ({ ...prev, logoLeft: true }))}
                                        sx={{ borderRadius: '12px', px: 3, py: 1, textTransform: 'none', fontWeight: 'bold' }}
                                    >
                                        Add Left Logo
                                    </Button>
                                )}

                                {!visibleSections.logoRight && (
                                    <Button 
                                        variant="outlined" 
                                        color="info"
                                        startIcon={<Plus size={18} />} 
                                        onClick={() => setVisibleSections(prev => ({ ...prev, logoRight: true }))}
                                        sx={{ borderRadius: '12px', px: 3, py: 1, textTransform: 'none', fontWeight: 'bold' }}
                                    >
                                        Add Right Logo
                                    </Button>
                                )}

                                {!visibleSections.header && (
                                    <Button 
                                        variant="outlined" 
                                        color="info"
                                        startIcon={<Plus size={18} />} 
                                        onClick={() => setVisibleSections(prev => ({ ...prev, header: true }))}
                                        sx={{ borderRadius: '12px', px: 3, py: 1, textTransform: 'none', fontWeight: 'bold' }}
                                    >
                                        Add Header
                                    </Button>
                                )}

                                {id && !visibleSections.summary && (
                                    <Button 
                                        variant="outlined" 
                                        color="info"
                                        startIcon={<Plus size={18} />} 
                                        onClick={() => setVisibleSections(prev => ({ ...prev, summary: true }))}
                                        sx={{ borderRadius: '12px', px: 3, py: 1, textTransform: 'none', fontWeight: 'bold' }}
                                    >
                                        Add Summary
                                    </Button>
                                )}
                            </Box>
                        )}
                    
                    {/* Document Upload Section */}
                    {visibleSections.uploads && (
                        <Box sx={{ mb: 4, border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <Box sx={{ p: 1.5, bgcolor: customBlue, color: "#FFF", fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '0.05em', textTransform: 'uppercase', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box sx={{ flex: 1 }}>
                                    {downloading ? headerLabels.uploadLabel : (
                                        <TextField
                                            fullWidth
                                            variant="standard"
                                            value={headerLabels.uploadLabel}
                                            onChange={(e) => setHeaderLabels(prev => ({ ...prev, uploadLabel: e.target.value }))}
                                            InputProps={{ disableUnderline: true, sx: { color: 'white', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '0.05em' } }}
                                        />
                                    )}
                                </Box>
                                {!downloading && (
                                    <Tooltip title="Delete Section">
                                        <IconButton size="small" onClick={() => confirmDeleteSection('uploads')} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#FFF' } }}>
                                            <Trash2 size={16} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                            <Box sx={{ p: 3 }}>
                                {!downloading && (
                                    <Button 
                                        variant="outlined" 
                                        component="label" 
                                        startIcon={<Download size={20} />}
                                        sx={{ 
                                            mb: 3, 
                                            borderRadius: '10px', 
                                            textTransform: 'none',
                                            borderColor: customBlue,
                                            color: customBlue,
                                            '&:hover': { borderColor: '#004a6e', bgcolor: 'rgba(0, 48, 73, 0.05)' }
                                        }}
                                    >
                                        Select Images
                                        <input type="file" hidden multiple accept="image/*" onChange={handleImageUpload} />
                                    </Button>
                                )}
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
                                    {formData.images?.map((img, idx) => (
                                        <Box key={idx} sx={{ position: 'relative', border: `1px solid ${borderColor}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                            <Box component="img" src={img} sx={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                                            {!downloading && (
                                                <IconButton 
                                                    size="small" 
                                                    onClick={() => removeImage(idx)}
                                                    sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(239, 68, 68, 0.9)', color: '#FFF', '&:hover': { bgcolor: 'rgba(220, 38, 38, 1)' }, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                                >
                                                    <X size={16} />
                                                </IconButton>
                                            )}
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        </Box>
                    )}

                    {/* Final Comments Area */}
                    {visibleSections.comments && (
                        <Box sx={{ mb: 4, border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <Box sx={{ p: 1.5, bgcolor: customBlue, color: "#FFF", fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '0.05em', textTransform: 'uppercase', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box sx={{ flex: 1 }}>
                                    {downloading ? headerLabels.commentsLabel : (
                                        <TextField
                                            fullWidth
                                            variant="standard"
                                            value={headerLabels.commentsLabel}
                                            onChange={(e) => setHeaderLabels(prev => ({ ...prev, commentsLabel: e.target.value }))}
                                            InputProps={{ disableUnderline: true, sx: { color: 'white', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '0.05em' } }}
                                        />
                                    )}
                                </Box>
                                {!downloading && (
                                    <Tooltip title="Delete Section">
                                        <IconButton size="small" onClick={() => confirmDeleteSection('comments')} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#FFF' } }}>
                                            <Trash2 size={16} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                            <Box sx={{ p: 2 }}>
                                {downloading ? (
                                    <Typography sx={{ fontSize: '0.9rem', color: textColor, whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: '100px' }}>
                                        {formData.comments || " "}
                                    </Typography>
                                ) : (
                                    <TextField 
                                        fullWidth 
                                        multiline 
                                        rows={4} 
                                        variant="standard" 
                                        value={formData.comments} 
                                        onChange={(e) => setFormData(prev => ({...prev, comments: e.target.value}))}
                                        InputProps={{ disableUnderline: true, sx: { fontSize: '0.9rem', color: textColor } }}
                                        placeholder="Enter final summary here..."
                                    />
                                )}
                            </Box>
                            
                            {/* Overall Score Results Display below comments */}
                            <Box sx={{ mt: 2, p: 2, bgcolor: isDarkMode ? "rgba(0, 186, 211, 0.05)" : "#f0f9ff", borderRadius: '8px', border: `1px solid ${borderColor}`, breakInside: 'avoid' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography sx={{ fontWeight: 'bold', color: customBlue, fontSize: '0.8rem', textTransform: 'uppercase' }}>Overall Compliance Score</Typography>
                                        <Typography variant="h4" sx={{ fontWeight: 900, color: customBlue }}>{calculateSummaryData().overallRate}%</Typography>
                                    </Box>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                            Total Rating Points: <strong>{calculateSummaryData().overallRating}</strong>
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                            Actual Points Scored: <strong>{calculateSummaryData().overallScore}</strong>
                                        </Typography>
                                    </Box>
                                </Box>
                                
                                <Box sx={{ mt: 1.5, width: '100%', height: '8px', bgcolor: isDarkMode ? "rgba(255,255,255,0.1)" : "#E2E8F0", borderRadius: '4px', overflow: 'hidden' }}>
                                    <Box sx={{ 
                                        width: `${calculateSummaryData().overallRate}%`, 
                                        height: '100%', 
                                        bgcolor: calculateSummaryData().overallRate >= 90 ? '#10b981' : calculateSummaryData().overallRate >= 75 ? '#f59e0b' : '#ef4444',
                                        transition: 'width 1s ease-in-out'
                                    }} />
                                </Box>
                                
                                <Typography sx={{ mt: 1, fontSize: '0.75rem', fontWeight: 600, color: calculateSummaryData().overallRate >= 90 ? '#10b981' : calculateSummaryData().overallRate >= 75 ? '#f59e0b' : '#ef4444' }}>
                                    {calculateSummaryData().overallRate >= 90 ? 'EXCELLENT COMPLIANCE' : calculateSummaryData().overallRate >= 75 ? 'GOOD - ACTION MAY BE REQUIRED' : 'CRITICAL - IMMEDIATE ACTION REQUIRED'}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!downloading && !visibleSections.signatures && (
                        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: `1px solid ${borderColor}` }}>
                            <Button 
                                variant="outlined" 
                                color="info"
                                startIcon={<Plus size={18} />} 
                                onClick={() => setVisibleSections(prev => ({ ...prev, signatures: true }))}
                                sx={{ borderRadius: '12px', px: 3, py: 1, textTransform: 'none', fontWeight: 'bold' }}
                            >
                                Add Signatures
                            </Button>
                        </Box>
                    )}

                    {/* Signature Section */}
                    {visibleSections.signatures && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 8, position: 'relative' }}>
                            {!downloading && (
                                <Tooltip title="Delete Signature Section">
                                    <IconButton size="small" onClick={() => confirmDeleteSection('signatures')} sx={{ position: 'absolute', top: -30, right: 0, color: 'error.main', opacity: 0.3, '&:hover': { opacity: 1 } }}>
                                        <Trash2 size={16} />
                                    </IconButton>
                                </Tooltip>
                            )}
                            <Box sx={{ width: '300px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <Box sx={{ 
                                    width: '100%', 
                                    height: '80px', 
                                    borderBottom: `2px solid ${customBlue}`,
                                    mb: 1.5,
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    justifyContent: 'flex-end',
                                    overflow: 'hidden'
                                }}>
                                    {docInfo.signature ? (
                                        <img src={docInfo.signature} alt="Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', fontStyle: 'italic', opacity: 0.5, pb: 1 }}>Digital Signature Space</Typography>
                                    )}
                                </Box>
                                <Typography sx={{ fontWeight: 'bold', color: customBlue, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', width: '100%' }}>Signature</Typography>
                                {!downloading && (
                                    <Button 
                                        variant="text" 
                                        component="label" 
                                        size="small"
                                        sx={{ mt: 1, textTransform: 'none', color: customBlue }}
                                    >
                                        {docInfo.signature ? "Change Signature" : "Upload Signature"}
                                        <input type="file" hidden accept="image/*" onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (ev) => setDocInfo(prev => ({ ...prev, signature: ev.target.result }));
                                                reader.readAsDataURL(file);
                                            }
                                        }} />
                                    </Button>
                                )}
                            </Box>
                        </Box>
                    )}
                </Paper>
            </Box>

            <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ ...deleteDialog, open: false })}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AlertTriangle color="#ef4444" /> Confirm Deletion
                </DialogTitle>
                <DialogContent>
                    Are you sure you want to delete this item? This action cannot be undone.
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDeleteDialog({ ...deleteDialog, open: false })}>Cancel</Button>
                    <Button onClick={handleDeleteItem} variant="contained" color="error">Delete</Button>
                </DialogActions>
            </Dialog>

            <SaveChoiceDialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                onSave={executeSave}
                existingId={id}
                defaultName={formMetadata.name || `${category === "SHEQ Inspection" ? "Inspection" : "Installation"} - ${new Date().toLocaleDateString()}`}
                defaultTags={formMetadata.tags}
                saving={saving}
            />
        </Box>
    );

    if (isModal) return formContent;

    return (
        <Layout pageTitle={category === "SHEQ Inspection" ? "SHEQ Inspection" : "SHEQ Installation"}>
            {formContent}
        </Layout>
    );
}
