import React, { useState, useEffect } from "react";
import {
    Box,
    Typography,
    Grid,
    Paper,
    Chip,
    Avatar,
    Skeleton,
} from "@mui/material";
import Layout from "../components/Layout";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
} from "recharts";

// Icons
import DomainIcon from "@mui/icons-material/Domain";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import GppGoodOutlinedIcon from "@mui/icons-material/GppGoodOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";

// Helper for the custom card style
const StyledPaper = ({ children, sx = {}, ...props }) => (
    <Paper
        elevation={0}
        sx={{
            borderRadius: 4,
            border: "1px solid #f0f0f0",
            boxShadow: "0px 2px 10px rgba(0,0,0,0.02)",
            p: 3,
            height: "100%",
            ...sx
        }}
        {...props}
    >
        {children}
    </Paper>
);

const StatCard = ({ icon: Icon, color, title, value, trend, loading }) => {
    const bgColors = {
        primary: "#e3f2fd",
        success: "#e8f5e9",
        warning: "#fff8e1",
        error: "#ffebee",
    };
    const iconColors = {
        primary: "#2196f3",
        success: "#4caf50",
        warning: "#ffb300",
        error: "#f44336",
    };

    return (
        <StyledPaper sx={{ display: 'flex', alignItems: 'center', p: 2, gap: 2 }}>
            <Avatar sx={{ bgcolor: bgColors[color], color: iconColors[color], borderRadius: 3, width: 48, height: 48 }}>
                <Icon />
            </Avatar>
            <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    {title}
                </Typography>
                {loading ? (
                    <Skeleton width="60%" height={32} />
                ) : (
                    <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2, mt: 0.5 }}>
                        {value}
                    </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                    {trend}
                </Typography>
            </Box>
        </StyledPaper>
    );
};

const CustomAreaTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <Paper elevation={3} sx={{ p: 2, borderRadius: 2, minWidth: 120 }}>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>{label}</Typography>
                {payload.map((entry, index) => (
                    <Typography key={index} variant="body2" sx={{ color: entry.color, mb: 0.5 }}>
                        {entry.name} : {entry.value}
                    </Typography>
                ))}
            </Paper>
        );
    }
    return null;
};

export default function ConcernReportDashboard() {
    const [searchParams] = useSearchParams();
    const search = searchParams.get("search") || "";
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        stats: {},
        charts: { areaChartData: [], barChartData: [], pieChartData: [] },
        recentActions: []
    });

    useEffect(() => {
        setLoading(true);
        api.get("/dashboard/stats")
            .then(res => {
                if (res.data.success) {
                    setData(res.data);
                }
            })
            .catch(err => console.error("Dashboard Fetch Error:", err))
            .finally(() => setLoading(false));
    }, []);

    const filteredActions = data.recentActions.filter(a => 
        a.title.toLowerCase().includes(search.toLowerCase()) || 
        a.subtitle.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Layout disablePadding={true}>
            <Box sx={{ py: { xs: 2, md: 4 }, px: { xs: 2, md: 4 }, bgcolor: "#fafafa", minHeight: "100vh" }}>
                <Box width="100%">
                    
                    {/* Top Stats Row */}
                    <Grid container spacing={3} mb={4}>
                        <Grid item xs={12} sm={6} md={4} lg={2}>
                            <StatCard loading={loading} icon={DomainIcon} color="primary" title="Total Sites" value={data.stats.totalSites || 0} trend="+1 this month" />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4} lg={2}>
                            <StatCard loading={loading} icon={PeopleOutlineIcon} color="success" title="Total Users" value={data.stats.totalUsers || 0} trend="Active users" />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4} lg={2}>
                            <StatCard loading={loading} icon={WarningAmberIcon} color="warning" title="Open Concerns" value={data.stats.openActions || 0} trend="Awaiting review" />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4} lg={2}>
                            <StatCard loading={loading} icon={AccessTimeIcon} color="error" title="Overdue" value={data.stats.overdue || 0} trend="Remedial actions" />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4} lg={2}>
                            <StatCard loading={loading} icon={AssignmentTurnedInIcon} color="primary" title="Reports" value={data.stats.inspectionsCount || 0} trend="Weekly total" />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4} lg={2}>
                            <StatCard loading={loading} icon={GppGoodOutlinedIcon} color="success" title="Compliance" value={data.stats.complianceRate || "0%"} trend="Avg Site Rating" />
                        </Grid>
                    </Grid>

                    {/* Charts Row */}
                    <Grid container spacing={3} mb={4}>
                        <Grid item xs={12} lg={8}>
                            <StyledPaper>
                                <Box display="flex" alignItems="center" mb={3}>
                                    <TrendingUpIcon sx={{ color: "primary.main", mr: 1 }} />
                                    <Typography variant="subtitle1" fontWeight={700}>Report Trends</Typography>
                                </Box>
                                <Box height={300}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data.charts.areaChartData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorScheduled" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ffb300" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#ffb300" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2196f3" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#2196f3" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#eee" />
                                            <XAxis dataKey="name" axisLine={true} tickLine={false} tick={{ fill: "#888", fontSize: 12 }} />
                                            <YAxis axisLine={true} tickLine={false} tick={{ fill: "#888", fontSize: 12 }} />
                                            <RechartsTooltip content={<CustomAreaTooltip />} />
                                            <Area type="monotone" dataKey="scheduled" name="Scheduled" stroke="#ffb300" strokeWidth={2} fillOpacity={1} fill="url(#colorScheduled)" />
                                            <Area type="monotone" dataKey="completed" name="Completed" stroke="#2196f3" strokeWidth={2} fillOpacity={1} fill="url(#colorCompleted)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Box>
                            </StyledPaper>
                        </Grid>

                        <Grid item xs={12} lg={4}>
                            <StyledPaper>
                                <Box display="flex" alignItems="center" mb={1}>
                                    <WarningAmberIcon sx={{ color: "warning.main", mr: 1 }} />
                                    <Typography variant="subtitle1" fontWeight={700}>Concerns by Category</Typography>
                                </Box>
                                <Box height={280} display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                                    {data.charts.pieChartData?.length > 0 ? (
                                        <>
                                            <ResponsiveContainer width="100%" height="80%">
                                                <PieChart>
                                                    <Pie
                                                        data={data.charts.pieChartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={100}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        {data.charts.pieChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <Box display="flex" justifyContent="center" gap={2} mt={2}>
                                                {data.charts.pieChartData.map((item, index) => (
                                                    <Box key={index} display="flex" alignItems="center" gap={0.5}>
                                                        <Box width={12} height={12} bgcolor={item.color} borderRadius="2px" />
                                                        <Typography variant="caption" color="text.secondary">{item.name}</Typography>
                                                    </Box>
                                                ))}
                                            </Box>
                                        </>
                                    ) : (
                                        <Typography color="text.secondary">No data available</Typography>
                                    )}
                                </Box>
                            </StyledPaper>
                        </Grid>
                    </Grid>

                    <Grid container spacing={3} mb={4}>
                        <Grid item xs={12} lg={8}>
                            <Box>
                                <Box display="flex" alignItems="center" mb={2} px={1}>
                                    <FormatListBulletedIcon sx={{ color: "primary.main", mr: 1 }} />
                                    <Typography variant="subtitle1" fontWeight={700}>Latest Reports</Typography>
                                </Box>
                                <Box display="flex" flexDirection="column" gap={2}>
                                    {filteredActions.map((action, index) => (
                                        <Paper
                                            key={index}
                                            elevation={0}
                                            sx={{
                                                p: 2,
                                                borderRadius: 3,
                                                border: "1px solid #f0f0f0",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                bgcolor: "white"
                                            }}
                                        >
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={600}>{action.title}</Typography>
                                                <Typography variant="caption" color="text.secondary">{action.subtitle}</Typography>
                                            </Box>
                                            <Box display="flex" gap={1}>
                                                <Chip 
                                                    label={action.status} 
                                                    size="small" 
                                                    color="success"
                                                    sx={{ borderRadius: 2, height: 24, fontSize: '0.75rem', fontWeight: 500, bgcolor: '#e8f5e9', color: '#2e7d32' }}
                                                />
                                            </Box>
                                        </Paper>
                                    ))}
                                    {filteredActions.length === 0 && !loading && (
                                        <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No recent reports found.</Typography>
                                    )}
                                </Box>
                            </Box>
                        </Grid>

                        <Grid item xs={12} lg={4}>
                            <StyledPaper>
                                <Box display="flex" alignItems="center" mb={3}>
                                    <WarningAmberIcon sx={{ color: "error.main", mr: 1 }} />
                                    <Typography variant="subtitle1" fontWeight={700}>Reports by Category</Typography>
                                </Box>
                                <Box height={300}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            layout="vertical"
                                            data={data.charts.barChartData}
                                            margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} />
                                            <XAxis type="number" tick={{ fontSize: 12, fill: '#888' }} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#888' }} width={80} />
                                            <RechartsTooltip cursor={{fill: 'transparent'}} />
                                            <Bar dataKey="value" fill="#2196f3" radius={[0, 4, 4, 0]} barSize={24} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            </StyledPaper>
                        </Grid>
                    </Grid>
                </Box>
            </Box>
        </Layout>
    );
}
