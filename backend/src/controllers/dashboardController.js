const asyncHandler = require("express-async-handler");
const prisma = require("../prismaClient");

exports.getDashboardStats = asyncHandler(async (req, res) => {
    const user = req.user;
    const isSuper = user.role === "superadmin";

    // Build filter based on role/clientId if needed (assuming multi-tenant)
    const filter = isSuper ? {} : { submittedBy: { clientId: user.clientId } };

    try {
        const [
            totalSites,
            totalUsers,
            allResponses
        ] = await Promise.all([
            prisma.site.count(isSuper ? {} : { where: { manager: { clientId: user.clientId } } }),
            prisma.user.count(isSuper ? {} : { where: { clientId: user.clientId } }),
            prisma.formResponse.findMany({
                where: filter,
                include: { form: true },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        // Process Responses
        const categories = {};
        const inspectionScores = [];
        const monthlyTrends = {};
        const recentActions = [];

        allResponses.forEach(resp => {
            const cat = resp.category || resp.form?.title || "Other";
            categories[cat] = (categories[cat] || 0) + 1;

            // Monthly Trend
            const month = new Date(resp.createdAt).toLocaleString('default', { month: 'short' });
            monthlyTrends[month] = (monthlyTrends[month] || 0) + 1;

            // Extract Inspection Data
            if (cat.includes("Weekly supervisor")) {
                const answers = resp.answers || {};
                // The WeeklySupervisorInspectionForm calculates Site Rating
                // We'll try to find it in the stored answers
                const siteRating = answers.siteRating || 0;
                inspectionScores.push(parseFloat(siteRating));
            }

            // Recent Actions (extracting from answers if they have remedial actions)
            // This is a bit complex as answers are dynamic, but we can sample
            if (recentActions.length < 5) {
                recentActions.push({
                    title: cat,
                    subtitle: new Date(resp.createdAt).toLocaleDateString(),
                    priority: "Medium", // Default
                    status: "Completed",
                    id: resp.id
                });
            }
        });

        // Calculate Average Compliance
        const avgCompliance = inspectionScores.length > 0 
            ? (inspectionScores.reduce((a, b) => a + b, 0) / inspectionScores.length).toFixed(1)
            : "0";

        // Format for Charts
        const barChartData = Object.keys(categories).map(cat => ({
            name: cat.length > 15 ? cat.substring(0, 15) + "..." : cat,
            value: categories[cat]
        }));

        const areaChartData = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            .map(m => ({ name: m, completed: monthlyTrends[m] || 0, scheduled: (monthlyTrends[m] || 0) + 5 }));

        res.json({
            success: true,
            stats: {
                totalSites,
                totalUsers,
                openActions: 12, // Mocking for now as we don't have a clear "action" model yet
                overdue: 4,
                inspectionsCount: inspectionScores.length,
                complianceRate: `${avgCompliance}%`
            },
            charts: {
                areaChartData: areaChartData.slice(-6), // Last 6 months
                barChartData: barChartData.slice(0, 5), // Top 5
                pieChartData: [
                    { name: "H&S", value: categories["Health & Safety concern"] || 0, color: "#f44336" },
                    { name: "Env", value: categories["Sustainability concern"] || 0, color: "#4caf50" },
                    { name: "Quality", value: categories["Quality concern"] || 0, color: "#2196f3" },
                    { name: "Positive", value: categories["Positive observation"] || 0, color: "#ffb300" },
                ].filter(d => d.value > 0)
            },
            recentActions
        });

    } catch (err) {
        console.error("Dashboard Stats Error:", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
