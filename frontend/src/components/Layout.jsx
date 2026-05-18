import React, { useState } from "react";
import { Box, Drawer } from "@mui/material";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import { useTheme } from "../context/ThemeContext";
import { useLocation } from "react-router-dom";

const Layout = ({ children, pageTitle, disablePadding = false }) => {
    const { isDarkMode } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const location = useLocation();
    const previewParams = new URLSearchParams(location.search);
    const isPreview = previewParams.get("preview") === "true";
    const isPreviewFill =
        isPreview &&
        previewParams.get("siteId") &&
        previewParams.get("fromTemplate");

    if (isPreview) {
        return (
            <Box sx={{ bgcolor: isDarkMode ? "#1B212C" : "#fff", height: "100vh", overflow: "auto", p: { xs: 1, md: 3 } }}>
                {!isPreviewFill && (
                    <style>
                        {`
                            button, a, [role="button"] { display: none !important; }
                            input, textarea, select { pointer-events: none !important; }
                        `}
                    </style>
                )}
                {children}
            </Box>
        );
    }

    return (
        <Box sx={{
            display: "flex",
            height: "100vh",
            overflow: "hidden",
            bgcolor: isDarkMode ? "#0A0A0A" : "#F3F1ED",
            gap: 0,
            p: 0
        }}>
            {/* Desktop Sidebar */}
            <Box
                component="aside"
                sx={{
                    display: { xs: "none", md: "block" },
                    width: 280, // Matches Sidebar.jsx width
                    flexShrink: 0,
                    height: "100%",
                }}
            >
                <Sidebar sx={{ height: "100%", width: "100%" }} />
            </Box>

            {/* Mobile Sidebar Drawer */}
            <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{
                    keepMounted: true, // Better open performance on mobile.
                }}
                sx={{
                    display: { xs: "block", md: "none" },
                    "& .MuiDrawer-paper": { boxSizing: "border-box", width: 280, backgroundColor: "transparent", border: "none" },
                }}
            >
                <Sidebar sx={{ height: "100%", width: "100%", p: 2 }} />
            </Drawer>

            {/* Right Content Area */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", gap: 0 }}>
                <TopNav pageTitle={pageTitle} onMobileMenuClick={handleDrawerToggle} />

                <Box
                    component="main"
                    sx={{
                        flex: 1,
                        overflow: "auto",
                        bgcolor: isDarkMode ? "#111827" : "#fff",
                        borderRadius: 0,
                        boxShadow: "none",
                        px: disablePadding ? 0 : { xs: 2, sm: 3, md: 4 },
                        py: disablePadding ? 0 : { xs: 3, md: 4 },
                        color: isDarkMode ? "#F9FAFB" : "inherit",
                    }}
                >
                    {children}
                </Box>
            </Box>
        </Box>
    );
};

export default Layout;
