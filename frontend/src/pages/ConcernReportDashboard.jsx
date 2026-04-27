import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import GppGoodOutlinedIcon from "@mui/icons-material/GppGoodOutlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import DomainIcon from "@mui/icons-material/Domain";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
    bg:         "#f8f8f7",
    surface:    "#ffffff",
    border:     "#e8e8e6",
    borderHover:"#d0d0cc",
    ink:        "#111110",
    inkMid:     "#6b6b68",
    inkFaint:   "#a8a8a5",
    blue:       "#2563eb",
    green:      "#16a34a",
    amber:      "#d97706",
    red:        "#dc2626",
    radius:     "10px",
    radiusLg:   "14px",
    shadow:     "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
};

// ─── Shared card wrapper ─────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
    <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusLg,
        boxShadow: T.shadow,
        padding: "24px",
        height: "100%",
        boxSizing: "border-box",
        ...style,
    }}>
        {children}
    </div>
);

// ─── Stat card ───────────────────────────────────────────────────────────────
const colorMap = {
    blue:  { bg: "#eff6ff", icon: "#2563eb", border: "#bfdbfe" },
    green: { bg: "#f0fdf4", icon: "#16a34a", border: "#bbf7d0" },
    amber: { bg: "#fffbeb", icon: "#d97706", border: "#fde68a" },
    red:   { bg: "#fef2f2", icon: "#dc2626", border: "#fecaca" },
};

const StatCard = ({ icon: Icon, color, label, value, sub, loading }) => {
    const [hovered, setHovered] = useState(false);
    const c = colorMap[color] || colorMap.blue;
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: T.surface,
                border: `1px solid ${hovered ? T.borderHover : T.border}`,
                borderRadius: T.radiusLg,
                boxShadow: hovered ? "0 4px 12px rgba(0,0,0,0.08)" : T.shadow,
                padding: "20px",
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
                transition: "border-color 0.15s, box-shadow 0.15s",
                cursor: "default",
            }}
        >
            <div style={{
                width: 40, height: 40, borderRadius: "9px",
                background: c.bg, border: `1px solid ${c.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
            }}>
                <Icon style={{ fontSize: 20, color: c.icon }} />
            </div>
            <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: T.inkFaint, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {label}
                </p>
                {loading ? (
                    <div style={{ width: 64, height: 28, background: "#f0f0ee", borderRadius: 6, marginTop: 6, animation: "pulse 1.4s ease-in-out infinite" }} />
                ) : (
                    <p style={{ margin: "4px 0 2px", fontSize: 26, fontWeight: 700, color: T.ink, lineHeight: 1, letterSpacing: "-0.02em" }}>
                        {value}
                    </p>
                )}
                <p style={{ margin: 0, fontSize: 12, color: T.inkFaint }}>{sub}</p>
            </div>
        </div>
    );
};

// ─── Section header ──────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <Icon style={{ fontSize: 15, color: T.inkMid }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, letterSpacing: "-0.01em" }}>
            {title}
        </span>
    </div>
);

// ─── Custom tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: T.ink, borderRadius: 8, padding: "10px 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}>
            <p style={{ margin: "0 0 5px", fontSize: 11, color: "#888", fontWeight: 500 }}>{label}</p>
            {payload.map((e, i) => (
                <p key={i} style={{ margin: 0, fontSize: 13, color: "#fff", fontWeight: 600 }}>
                    {e.name}: {e.value}
                </p>
            ))}
        </div>
    );
};

// ─── Status badge ────────────────────────────────────────────────────────────
const Badge = ({ label }) => (
    <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 10px", borderRadius: 999,
        background: "#f0fdf4", border: "1px solid #bbf7d0",
        fontSize: 11, fontWeight: 600, color: T.green, whiteSpace: "nowrap",
    }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, display: "inline-block" }} />
        {label}
    </span>
);

// ─── Divider ─────────────────────────────────────────────────────────────────
const Divider = () => <div style={{ borderTop: `1px solid ${T.border}`, margin: "0 -24px" }} />;

// ─── Action Item (List Entry) ────────────────────────────────────────────────
const ActionItem = ({ action }) => {
    const [h, setH] = useState(false);
    return (
        <div
            onMouseEnter={() => setH(true)}
            onMouseLeave={() => setH(false)}
            style={{
                background: T.surface,
                border: `1px solid ${h ? T.borderHover : T.border}`,
                borderRadius: T.radius,
                padding: "13px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "border-color 0.15s, box-shadow 0.15s",
                boxShadow: h ? "0 2px 8px rgba(0,0,0,0.04)" : "none",
                cursor: "default",
            }}
        >
            <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.ink }}>{action.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMid }}>{action.subtitle}</p>
            </div>
            <Badge label={action.status} />
        </div>
    );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function ConcernReportDashboard() {
    const [searchParams] = useSearchParams();
    const search = searchParams.get("search") || "";
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        stats: {},
        charts: { areaChartData: [], barChartData: [], pieChartData: [] },
        recentActions: [],
    });

    useEffect(() => {
        setLoading(true);
        api.get("/dashboard/stats")
            .then(res => { if (res.data.success) setData(res.data); })
            .catch(err => console.error("Dashboard Fetch Error:", err))
            .finally(() => setLoading(false));
    }, []);

    const filteredActions = data.recentActions.filter(a =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.subtitle.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Layout disablePadding={true}>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                * { box-sizing: border-box; }
            `}</style>
            <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif" }}>
                <div style={{ maxWidth: 1300, margin: "0 auto", padding: "36px 28px" }}>

                    {/* ── Page heading ─────────────────────────────── */}
                    <div style={{ marginBottom: 28 }}>
                        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.ink, letterSpacing: "-0.03em" }}>
                            Dashboard
                        </h1>
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMid }}>
                            Real-time overview of reports, concerns, and compliance.
                        </p>
                    </div>

                    {/* ── Stat cards ──────────────────────────────── */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: 14,
                        marginBottom: 20,
                    }}>
                        <StatCard loading={loading} icon={DomainIcon}             color="blue"  label="Total Sites"    value={data.stats.totalSites      || 0}    sub="Active projects" />
                        <StatCard loading={loading} icon={PeopleOutlineIcon}      color="green" label="Total Users"    value={data.stats.totalUsers      || 0}    sub="Active team members" />
                        <StatCard loading={loading} icon={AssignmentTurnedInIcon} color="blue"  label="Total Reports"  value={data.stats.totalReports   || 0}    sub="Forms submitted" />
                        <StatCard loading={loading} icon={WarningAmberIcon}       color="red"   label="H&S Concerns"   value={data.stats.hsConcerns     || 0}    sub="Safety incidents" />
                        <StatCard loading={loading} icon={TrendingUpIcon}         color="green" label="Env Concerns"   value={data.stats.envConcerns    || 0}    sub="Sustainability" />
                        <StatCard loading={loading} icon={GppGoodOutlinedIcon}    color="amber" label="Avg Compliance" value={data.stats.complianceRate || "0%"} sub="Safety score" />
                    </div>

                    {/* ── Charts row ───────────────────────────────── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, marginBottom: 20 }}>

                        <Card>
                            <SectionHeader icon={TrendingUpIcon} title="Report Trends" />
                            <div style={{ height: 264 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.charts.areaChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor={T.blue} stopOpacity={0.12} />
                                                <stop offset="95%" stopColor={T.blue} stopOpacity={0}    />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={T.border} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: T.inkFaint, fontSize: 11 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: T.inkFaint, fontSize: 11 }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="completed" name="Reports"
                                            stroke={T.blue} strokeWidth={2}
                                            fillOpacity={1} fill="url(#grad)"
                                            dot={false} activeDot={{ r: 4, fill: T.blue, strokeWidth: 0 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        <Card>
                            <SectionHeader icon={WarningAmberIcon} title="Concerns by Category" />
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                {data.charts.pieChartData?.length > 0 ? (
                                    <>
                                        <div style={{ width: "100%", height: 200 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={data.charts.pieChartData}
                                                        cx="50%" cy="50%"
                                                        innerRadius={52} outerRadius={82}
                                                        paddingAngle={3} dataKey="value" stroke="none">
                                                        {data.charts.pieChartData.map((entry, i) => (
                                                            <Cell key={i} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip content={<CustomTooltip />} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", marginTop: 12 }}>
                                            {data.charts.pieChartData.map((item, i) => (
                                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                                                    <span style={{ fontSize: 11, color: T.inkMid }}>{item.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <p style={{ color: T.inkFaint, fontSize: 13 }}>No data available</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* ── Bottom row ───────────────────────────────── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>

                        {/* Latest reports */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <FormatListBulletedIcon style={{ fontSize: 15, color: T.inkMid }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Latest Reports</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {filteredActions.map((action, i) => (
                                    <ActionItem key={i} action={action} />
                                ))}
                                {filteredActions.length === 0 && !loading && (
                                    <div style={{
                                        padding: "40px 0", textAlign: "center",
                                        color: T.inkFaint, fontSize: 13,
                                        background: T.surface,
                                        border: `1px solid ${T.border}`,
                                        borderRadius: T.radiusLg,
                                    }}>
                                        No recent reports found.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bar chart */}
                        <Card>
                            <SectionHeader icon={WarningAmberIcon} title="Reports by Category" />
                            <div style={{ height: 264 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={data.charts.barChartData}
                                        margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke={T.border} />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: T.inkFaint }} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="name"
                                            tick={{ fontSize: 11, fill: T.inkMid, fontWeight: 500 }}
                                            width={90} axisLine={false} tickLine={false} />
                                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                                        <Bar dataKey="value" fill={T.blue} radius={[0, 5, 5, 0]} barSize={13} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>

                </div>
            </div>
        </Layout>
    );
}