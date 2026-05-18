import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/Layout";
import api from "../services/api";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import DomainIcon from "@mui/icons-material/Domain";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import EnergySavingsLeafIcon from "@mui/icons-material/EnergySavingsLeaf";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import { useAuth } from "../context/AuthContext";

const T = {
    bg: "#f4f4f2",
    surface: "#ffffff",
    border: "#e5e5e2",
    ink: "#141413",
    inkMid: "#5c5c59",
    inkFaint: "#8a8a86",
    blue: "#2563eb",
    radiusLg: "12px",
    shadow: "0 1px 2px rgba(0,0,0,0.05)",
};

const Card = ({ children, style = {} }) => (
    <div
        style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusLg,
            boxShadow: T.shadow,
            padding: "20px 22px",
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            ...style,
        }}
    >
        {children}
    </div>
);

const colorMap = {
    blue: { bg: "#eff6ff", icon: "#2563eb", border: "#bfdbfe" },
    green: { bg: "#f0fdf4", icon: "#16a34a", border: "#bbf7d0" },
    red: { bg: "#fef2f2", icon: "#dc2626", border: "#fecaca" },
};

const StatCard = ({ icon: Icon, color, label, value, loading }) => {
    const c = colorMap[color] || colorMap.blue;
    return (
        <div
            style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusLg,
                boxShadow: T.shadow,
                padding: "18px 20px",
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                minWidth: 0,
            }}
        >
            <div
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                <Icon style={{ fontSize: 20, color: c.icon }} />
            </div>
            <div style={{ minWidth: 0 }}>
                <p
                    style={{
                        margin: 0,
                        fontSize: 11,
                        fontWeight: 600,
                        color: T.inkFaint,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                    }}
                >
                    {label}
                </p>
                {loading ? (
                    <div
                        style={{
                            width: 56,
                            height: 26,
                            background: "#ecece9",
                            borderRadius: 6,
                            marginTop: 8,
                        }}
                    />
                ) : (
                    <p
                        style={{
                            margin: "6px 0 0",
                            fontSize: 28,
                            fontWeight: 700,
                            color: T.ink,
                            lineHeight: 1,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        {value}
                    </p>
                )}
            </div>
        </div>
    );
};

const SectionHeader = ({ icon: Icon, title, hint }) => (
    <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon style={{ fontSize: 18, color: T.inkMid }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{title}</span>
        </div>
        {hint ? (
            <p style={{ margin: "6px 0 0 26px", fontSize: 12, color: T.inkFaint }}>{hint}</p>
        ) : null}
    </div>
);

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    const header = row?.fullName ?? label;
    return (
        <div
            style={{
                background: "#fff",
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "10px 12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
        >
            {header ? (
                <p style={{ margin: "0 0 6px", fontSize: 11, color: T.inkFaint, fontWeight: 600 }}>{header}</p>
            ) : null}
            {payload.map((e, i) => (
                <p key={i} style={{ margin: 0, fontSize: 13, color: T.ink, fontWeight: 600 }}>
                    {e.name}: {e.value}
                </p>
            ))}
        </div>
    );
};

/** Recharts needs a parent with explicit pixel height and non-zero width */
const ChartBox = ({ height, children }) => (
    <div style={{ width: "100%", minWidth: 0, height, position: "relative" }}>{children}</div>
);

const SHEQ_STATUS = {
    green: { label: "Green", color: "#16a34a", bg: "#dcfce7" },
    amber: { label: "Amber", color: "#d97706", bg: "#fef3c7" },
    red: { label: "Red", color: "#dc143c", bg: "#fee2e2" },
    unset: { label: "Not set", color: "#64748b", bg: "#f1f5f9" },
};

const SheqStatusBadge = ({ status }) => {
    const meta = SHEQ_STATUS[status] || SHEQ_STATUS.unset;
    return (
        <span
            style={{
                display: "inline-block",
                padding: "3px 8px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: meta.color,
                background: meta.bg,
                border: `1px solid ${meta.color}33`,
                whiteSpace: "nowrap",
            }}
        >
            {meta.label.toUpperCase()}
        </span>
    );
};

function buildYearChartData(monthlySubmissions, year, monthSort, latestMonthKey) {
    const byKey = new Map(
        (monthlySubmissions || [])
            .filter((m) => m.year === year)
            .map((m) => [m.monthKey, m])
    );
    const rows = [];
    for (let month = 1; month <= 12; month += 1) {
        const monthKey = `${year}-${String(month).padStart(2, "0")}`;
        const existing = byKey.get(monthKey);
        const dt = new Date(year, month - 1, 1);
        rows.push({
            name: dt.toLocaleString("en-GB", { month: "short" }),
            fullName: dt.toLocaleString("en-GB", { month: "long", year: "numeric" }),
            monthKey,
            completed: existing?.count ?? 0,
            isLatest: latestMonthKey === monthKey,
        });
    }
    return monthSort === "desc" ? [...rows].reverse() : rows;
}

const selectStyle = {
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    background: "#fff",
    fontSize: 13,
    color: T.ink,
    fontFamily: "inherit",
    cursor: "pointer",
};

const defaultDashboard = {
    stats: {},
    charts: {
        areaChartData: [],
        barChartData: [],
        monthlySubmissions: [],
        availableYears: [],
        latestMonth: null,
    },
    sheq: { summary: {}, pieChartData: [], byUser: [], userBarData: [] },
    recentActions: [],
    scope: {
        label: "",
        capabilities: { showSites: false, showUsers: false, showCompliance: true },
    },
};

const DASHBOARD_USER_ROLES = ["superadmin", "company_admin"];

export default function ConcernReportDashboard() {
    const { currentUser, role } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [data, setData] = useState(defaultDashboard);
    const [chartYear, setChartYear] = useState(() => new Date().getFullYear());
    const [monthSort, setMonthSort] = useState("asc");

    useEffect(() => {
        setLoading(true);
        setError("");
        api.get("/dashboard/stats")
            .then((res) => {
                if (res.data?.success) {
                    const next = {
                        ...defaultDashboard,
                        ...res.data,
                        scope: res.data.scope || defaultDashboard.scope,
                    };
                    setData(next);
                    const years = res.data.charts?.availableYears;
                    if (years?.length) {
                        setChartYear(years[0]);
                    }
                } else {
                    setError(res.data?.message || "Could not load dashboard");
                }
            })
            .catch((err) => {
                console.error("Dashboard Fetch Error:", err);
                setError(err.response?.data?.message || "Could not load dashboard");
            })
            .finally(() => setLoading(false));
    }, [currentUser?.id]);

    const monthlySubmissions = data.charts?.monthlySubmissions || [];
    const availableYears = data.charts?.availableYears?.length
        ? data.charts.availableYears
        : [new Date().getFullYear()];
    const latestMonth = data.charts?.latestMonth;
    const latestMonthKey = latestMonth?.monthKey;
    const totalFormsSubmitted = data.stats?.totalReports ?? 0;

    const areaData = useMemo(
        () =>
            buildYearChartData(monthlySubmissions, chartYear, monthSort, latestMonthKey),
        [monthlySubmissions, chartYear, monthSort, latestMonthKey]
    );

    const selectedYearTotal = useMemo(
        () =>
            monthlySubmissions
                .filter((m) => m.year === chartYear)
                .reduce((sum, m) => sum + (m.count || 0), 0),
        [monthlySubmissions, chartYear]
    );

    const maxAreaValue = Math.max(1, ...areaData.map((d) => d.completed || 0));
    const barData = data.charts.barChartData?.length ? data.charts.barChartData : [];
    const maxBar = Math.max(1, ...barData.map((d) => d.value));
    const sheq = data.sheq || defaultDashboard.sheq;
    const sheqPie = sheq.pieChartData || [];
    const sheqUserBars = sheq.userBarData || [];
    const sheqByUser = sheq.byUser || [];
    const sheqSummary = sheq.summary || {};
    const maxSheqUserBar = Math.max(
        1,
        ...sheqUserBars.map((d) => (d.green || 0) + (d.amber || 0) + (d.red || 0) + (d.unset || 0))
    );
    const caps = data.scope?.capabilities || defaultDashboard.scope.capabilities;
    const scopeLabel = data.scope?.label || "Your data";
    const showUsersCard = caps.showUsers && DASHBOARD_USER_ROLES.includes(role);

    const statCards = [
        {
            key: "reports",
            show: true,
            icon: AssignmentTurnedInIcon,
            color: "blue",
            label: caps.showUsers ? "Total forms submitted" : "Your forms submitted",
            value: totalFormsSubmitted,
        },
        {
            key: "sites",
            show: caps.showSites,
            icon: DomainIcon,
            color: "blue",
            label: "Sites",
            value: data.stats.totalSites ?? 0,
        },
        {
            key: "users",
            show: showUsersCard,
            icon: PeopleOutlineIcon,
            color: "green",
            label: "Users",
            value: data.stats.totalUsers ?? 0,
        },
        {
            key: "hs",
            show: true,
            icon: WarningAmberIcon,
            color: "red",
            label: "Health & safety",
            value: data.stats.hsConcerns ?? 0,
        },
        {
            key: "env",
            show: true,
            icon: EnergySavingsLeafIcon,
            color: "green",
            label: "Sustainability",
            value: data.stats.envConcerns ?? 0,
        },
        {
            key: "quality",
            show: !caps.showUsers,
            icon: FactCheckIcon,
            color: "blue",
            label: "Quality",
            value: data.stats.qualityConcerns ?? 0,
        },
        {
            key: "positive",
            show: !caps.showUsers,
            icon: ThumbUpOffAltIcon,
            color: "green",
            label: "Positive",
            value: data.stats.positiveObs ?? 0,
        },
    ].filter((c) => c.show);

    return (
        <Layout disablePadding={true}>
            <div
                style={{
                    background: T.bg,
                    minHeight: "100vh",
                    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
                }}
            >
                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 40px" }}>
                    <div style={{ marginBottom: 24 }}>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.ink, letterSpacing: "-0.02em" }}>
                            Dashboard
                        </h1>
                        <p style={{ margin: "6px 0 0", fontSize: 13, color: T.inkMid }}>
                            {scopeLabel} — reports over time and by category.
                        </p>
                    </div>

                    {error && !loading ? (
                        <div
                            style={{
                                marginBottom: 16,
                                padding: "12px 14px",
                                borderRadius: 8,
                                background: "#fef2f2",
                                border: "1px solid #fecaca",
                                color: "#991b1b",
                                fontSize: 13,
                            }}
                        >
                            {error}
                        </div>
                    ) : null}

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: 12,
                            marginBottom: 16,
                        }}
                    >
                        {statCards.map((card) => (
                            <StatCard
                                key={card.key}
                                loading={loading}
                                icon={card.icon}
                                color={card.color}
                                label={card.label}
                                value={card.value}
                            />
                        ))}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <Card>
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "flex-start",
                                    justifyContent: "space-between",
                                    gap: 16,
                                    marginBottom: 16,
                                }}
                            >
                                <SectionHeader
                                    icon={TrendingUpIcon}
                                    title="Forms per month"
                                    hint={
                                        caps.showUsers
                                            ? "All form submissions in your scope."
                                            : "Forms you have submitted."
                                    }
                                />
                                <div
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                        gap: 10,
                                    }}
                                >
                                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: T.inkFaint }}>Year</span>
                                        <select
                                            value={chartYear}
                                            onChange={(e) => setChartYear(Number(e.target.value))}
                                            style={selectStyle}
                                            disabled={loading}
                                        >
                                            {availableYears.map((y) => (
                                                <option key={y} value={y}>
                                                    {y}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: T.inkFaint }}>
                                            Month order
                                        </span>
                                        <select
                                            value={monthSort}
                                            onChange={(e) => setMonthSort(e.target.value)}
                                            style={selectStyle}
                                            disabled={loading}
                                        >
                                            <option value="asc">Jan → Dec</option>
                                            <option value="desc">Dec → Jan</option>
                                        </select>
                                    </label>
                                </div>
                            </div>

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                    gap: 10,
                                    marginBottom: 18,
                                }}
                            >
                                <div
                                    style={{
                                        padding: "12px 14px",
                                        borderRadius: 8,
                                        border: `1px solid ${T.blue}33`,
                                        background: "#eff6ff",
                                    }}
                                >
                                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: T.blue }}>
                                        {caps.showUsers ? "Total forms submitted" : "Your forms submitted"}
                                    </p>
                                    <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700, color: T.ink }}>
                                        {loading ? "—" : totalFormsSubmitted}
                                    </p>
                                </div>
                                <div
                                    style={{
                                        padding: "12px 14px",
                                        borderRadius: 8,
                                        border: `1px solid ${T.border}`,
                                        background: "#fafaf8",
                                    }}
                                >
                                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: T.inkFaint }}>
                                        In {chartYear}
                                    </p>
                                    <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700, color: T.ink }}>
                                        {loading ? "—" : selectedYearTotal}
                                    </p>
                                </div>
                                {latestMonth ? (
                                    <div
                                        style={{
                                            padding: "12px 14px",
                                            borderRadius: 8,
                                            border: "1px solid #bbf7d0",
                                            background: "#f0fdf4",
                                        }}
                                    >
                                        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#16a34a" }}>
                                            Latest month
                                        </p>
                                        <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 700, color: T.ink }}>
                                            {latestMonth.fullName}
                                        </p>
                                        <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: T.ink }}>
                                            {loading ? "—" : latestMonth.count}{" "}
                                            <span style={{ fontSize: 13, fontWeight: 500, color: T.inkMid }}>
                                                form{latestMonth.count === 1 ? "" : "s"}
                                            </span>
                                        </p>
                                    </div>
                                ) : null}
                            </div>

                            <ChartBox height={300}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={areaData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="dashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={T.blue} stopOpacity={0.2} />
                                                <stop offset="95%" stopColor={T.blue} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.border} />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: T.inkFaint, fontSize: 12 }}
                                            padding={{ left: 8, right: 8 }}
                                        />
                                        <YAxis
                                            allowDecimals={false}
                                            domain={[0, Math.max(4, maxAreaValue + 1)]}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: T.inkFaint, fontSize: 12 }}
                                            width={36}
                                        />
                                        <RechartsTooltip content={<ChartTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="completed"
                                            name="Forms"
                                            stroke={T.blue}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#dashAreaGrad)"
                                            dot={(props) => {
                                                const { cx, cy, payload } = props;
                                                if (cx == null || cy == null) return null;
                                                const isLatest = payload?.isLatest;
                                                return (
                                                    <circle
                                                        cx={cx}
                                                        cy={cy}
                                                        r={isLatest ? 6 : 3}
                                                        fill={isLatest ? "#16a34a" : T.blue}
                                                        stroke={isLatest ? "#fff" : "none"}
                                                        strokeWidth={isLatest ? 2 : 0}
                                                    />
                                                );
                                            }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </ChartBox>
                            {latestMonth ? (
                                <p style={{ margin: "10px 0 0", fontSize: 12, color: T.inkFaint }}>
                                    Green dot = latest month with submissions ({latestMonth.fullName}).
                                </p>
                            ) : null}
                        </Card>

                        <Card>
                            <SectionHeader
                                icon={WarningAmberIcon}
                                title="Reports by category"
                                hint="Top categories by submission count."
                            />
                            {barData.length === 0 && !loading ? (
                                <div
                                    style={{
                                        height: 280,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: T.inkFaint,
                                        fontSize: 14,
                                    }}
                                >
                                    No submissions yet.
                                </div>
                            ) : (
                                <ChartBox height={Math.min(420, Math.max(280, barData.length * 44))}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            layout="vertical"
                                            data={barData}
                                            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                                            barCategoryGap={10}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={T.border} />
                                            <XAxis
                                                type="number"
                                                domain={[0, maxBar]}
                                                allowDecimals={false}
                                                tick={{ fontSize: 12, fill: T.inkFaint }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                width={148}
                                                tick={{ fontSize: 12, fill: T.inkMid }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <RechartsTooltip
                                                content={<ChartTooltip />}
                                                cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
                                            />
                                            <Bar dataKey="value" name="Count" fill={T.blue} radius={[0, 6, 6, 0]} barSize={22} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartBox>
                            )}
                        </Card>

                        <Card>
                            <SectionHeader
                                icon={FactCheckIcon}
                                title="SHEQ project status"
                                hint="Green, amber, and red ratings from SHEQ Installation and SHEQ Inspection forms, grouped by submitter."
                            />
                            {loading ? (
                                <div style={{ height: 280, background: "#ecece9", borderRadius: 8 }} />
                            ) : (sheqSummary.total || 0) === 0 ? (
                                <div
                                    style={{
                                        height: 200,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: T.inkFaint,
                                        fontSize: 14,
                                    }}
                                >
                                    No SHEQ forms in your scope yet.
                                </div>
                            ) : (
                                <>
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                                            gap: 10,
                                            marginBottom: 20,
                                        }}
                                    >
                                        {["green", "amber", "red"].map((key) => (
                                            <div
                                                key={key}
                                                style={{
                                                    padding: "12px 14px",
                                                    borderRadius: 8,
                                                    border: `1px solid ${SHEQ_STATUS[key].color}44`,
                                                    background: SHEQ_STATUS[key].bg,
                                                }}
                                            >
                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        color: SHEQ_STATUS[key].color,
                                                        textTransform: "uppercase",
                                                    }}
                                                >
                                                    {SHEQ_STATUS[key].label}
                                                </p>
                                                <p
                                                    style={{
                                                        margin: "6px 0 0",
                                                        fontSize: 24,
                                                        fontWeight: 700,
                                                        color: T.ink,
                                                    }}
                                                >
                                                    {sheqSummary[key] ?? 0}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                                            gap: 20,
                                            marginBottom: 24,
                                        }}
                                    >
                                        <div>
                                            <p
                                                style={{
                                                    margin: "0 0 10px",
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: T.inkMid,
                                                }}
                                            >
                                                Overall distribution
                                            </p>
                                            <ChartBox height={260}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={sheqPie}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={52}
                                                            outerRadius={88}
                                                            paddingAngle={2}
                                                        >
                                                            {sheqPie.map((entry, index) => (
                                                                <Cell key={index} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                        <RechartsTooltip />
                                                        <Legend />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </ChartBox>
                                        </div>

                                        <div>
                                            <p
                                                style={{
                                                    margin: "0 0 10px",
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: T.inkMid,
                                                }}
                                            >
                                                By user
                                            </p>
                                            {sheqUserBars.length === 0 ? (
                                                <p style={{ margin: 0, fontSize: 13, color: T.inkFaint }}>
                                                    No user breakdown available.
                                                </p>
                                            ) : (
                                                <ChartBox
                                                    height={Math.min(360, Math.max(200, sheqUserBars.length * 40))}
                                                >
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            layout="vertical"
                                                            data={sheqUserBars}
                                                            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                                                            barCategoryGap={8}
                                                        >
                                                            <CartesianGrid
                                                                strokeDasharray="3 3"
                                                                horizontal={false}
                                                                stroke={T.border}
                                                            />
                                                            <XAxis
                                                                type="number"
                                                                domain={[0, maxSheqUserBar]}
                                                                allowDecimals={false}
                                                                tick={{ fontSize: 12, fill: T.inkFaint }}
                                                                axisLine={false}
                                                                tickLine={false}
                                                            />
                                                            <YAxis
                                                                type="category"
                                                                dataKey="name"
                                                                width={120}
                                                                tick={{ fontSize: 11, fill: T.inkMid }}
                                                                axisLine={false}
                                                                tickLine={false}
                                                            />
                                                            <RechartsTooltip content={<ChartTooltip />} />
                                                            <Legend />
                                                            <Bar
                                                                dataKey="green"
                                                                stackId="sheq"
                                                                fill={SHEQ_STATUS.green.color}
                                                                name="Green"
                                                                radius={[0, 0, 0, 0]}
                                                            />
                                                            <Bar
                                                                dataKey="amber"
                                                                stackId="sheq"
                                                                fill={SHEQ_STATUS.amber.color}
                                                                name="Amber"
                                                            />
                                                            <Bar
                                                                dataKey="red"
                                                                stackId="sheq"
                                                                fill={SHEQ_STATUS.red.color}
                                                                name="Red"
                                                            />
                                                            <Bar
                                                                dataKey="unset"
                                                                stackId="sheq"
                                                                fill={SHEQ_STATUS.unset.color}
                                                                name="Not set"
                                                                radius={[0, 6, 6, 0]}
                                                            />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </ChartBox>
                                            )}
                                        </div>
                                    </div>

                                    <p
                                        style={{
                                            margin: "0 0 12px",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: T.inkMid,
                                        }}
                                    >
                                        Forms by user
                                    </p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                        {sheqByUser.map((userRow) => (
                                            <div
                                                key={userRow.userId}
                                                style={{
                                                    border: `1px solid ${T.border}`,
                                                    borderRadius: 8,
                                                    overflow: "hidden",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        padding: "10px 14px",
                                                        background: "#fafaf8",
                                                        borderBottom: `1px solid ${T.border}`,
                                                        display: "flex",
                                                        flexWrap: "wrap",
                                                        alignItems: "center",
                                                        gap: 10,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            color: T.ink,
                                                        }}
                                                    >
                                                        {userRow.userName}
                                                    </span>
                                                    <span style={{ fontSize: 12, color: T.inkFaint }}>
                                                        {userRow.green} green · {userRow.amber} amber · {userRow.red}{" "}
                                                        red
                                                        {userRow.unset ? ` · ${userRow.unset} not set` : ""}
                                                    </span>
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column" }}>
                                                    {(userRow.forms || []).map((form) => (
                                                        <div
                                                            key={form.id}
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "space-between",
                                                                gap: 12,
                                                                padding: "10px 14px",
                                                                borderTop: `1px solid ${T.border}`,
                                                            }}
                                                        >
                                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                                <p
                                                                    style={{
                                                                        margin: 0,
                                                                        fontSize: 13,
                                                                        fontWeight: 600,
                                                                        color: T.ink,
                                                                    }}
                                                                >
                                                                    {form.name}
                                                                </p>
                                                                <p
                                                                    style={{
                                                                        margin: "4px 0 0",
                                                                        fontSize: 11,
                                                                        color: T.inkFaint,
                                                                    }}
                                                                >
                                                                    {form.category}
                                                                    {form.client ? ` · ${form.client}` : ""}
                                                                    {form.siteAddress ? ` · ${form.siteAddress}` : ""}
                                                                </p>
                                                            </div>
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 10,
                                                                    flexShrink: 0,
                                                                }}
                                                            >
                                                                <SheqStatusBadge status={form.status} />
                                                                <span
                                                                    style={{
                                                                        fontSize: 12,
                                                                        color: T.inkFaint,
                                                                        whiteSpace: "nowrap",
                                                                    }}
                                                                >
                                                                    {form.date}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </Card>

                        <Card>
                            <SectionHeader icon={FormatListBulletedIcon} title="Recent submissions" />
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {(data.recentActions || []).map((action) => (
                                    <div
                                        key={action.id}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "12px 14px",
                                            border: `1px solid ${T.border}`,
                                            borderRadius: 8,
                                            background: "#fafaf8",
                                        }}
                                    >
                                        <p
                                            style={{
                                                margin: 0,
                                                fontSize: 13,
                                                fontWeight: 600,
                                                color: T.ink,
                                                flex: 1,
                                                paddingRight: 12,
                                            }}
                                        >
                                            {action.title}
                                        </p>
                                        <span style={{ fontSize: 12, color: T.inkFaint, whiteSpace: "nowrap" }}>
                                            {action.subtitle}
                                        </span>
                                    </div>
                                ))}
                                {!loading && (!data.recentActions || data.recentActions.length === 0) && (
                                    <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, padding: "8px 0" }}>
                                        No recent submissions.
                                    </p>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
