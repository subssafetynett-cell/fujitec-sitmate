import React, { useState, useCallback } from "react";
import { Box, Drawer } from "@mui/material";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import ActingCompanyBanner from "./ActingCompanyBanner";
import ViewOnlyBanner from "./ViewOnlyBanner";
import { useTheme } from "../context/ThemeContext";
import { useLocation } from "react-router-dom";

const SIDEBAR_WIDTH = 280;
const SIDEBAR_STORAGE_KEY = "site-mate-sidebar-open";

const Layout = ({ children, pageTitle, disablePadding = false }) => {
    const { isDarkMode } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
        if (typeof window === "undefined") return true;
        return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "false";
    });

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const toggleDesktopSidebar = useCallback(() => {
        setDesktopSidebarOpen((open) => {
            const next = !open;
            localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
            return next;
        });
    }, []);

    const location = useLocation();
    const previewParams = new URLSearchParams(location.search);
    const isPreview = previewParams.get("preview") === "true";
    const isEmbedded = previewParams.get("embedded") === "true";
    const isPreviewFill =
        isPreview &&
        previewParams.get("siteId") &&
        previewParams.get("fromTemplate");

    if (isPreview || isEmbedded) {
        return (
            <Box sx={{ bgcolor: isDarkMode ? "#1B212C" : "#fff", height: "100vh", overflow: "auto", p: { xs: 1, md: 3 } }}>
                {isPreview && !isPreviewFill && (
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
                    width: desktopSidebarOpen ? SIDEBAR_WIDTH : 0,
                    flexShrink: 0,
                    height: "100%",
                    overflow: "hidden",
                    transition: "width 0.25s ease",
                }}
            >
                <Sidebar
                    className="h-full shrink-0"
                    style={{ width: SIDEBAR_WIDTH }}
                />
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
                    "& .MuiDrawer-paper": { boxSizing: "border-box", width: 280, backgroundColor: "#1B212C", border: "none" },
                }}
            >
                <div className="h-full w-full bg-[#1B212C] p-2">
                    <Sidebar className="h-full w-full border-0" />
                </div>
            </Drawer>

            {/* Right Content Area */}
            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    overflow: "hidden",
                    gap: 0,
                    minWidth: 0,
                    width: "100%",
                }}
            >
                <TopNav
                    pageTitle={pageTitle}
                    onMobileMenuClick={handleDrawerToggle}
                    desktopSidebarOpen={desktopSidebarOpen}
                    onDesktopSidebarToggle={toggleDesktopSidebar}
                />

                <Box
                    component="main"
                    sx={{
                        flex: 1,
                        overflow: "auto",
                        width: "100%",
                        minWidth: 0,
                        bgcolor: isDarkMode ? "#111827" : "#fff",
                        borderRadius: 0,
                        boxShadow: "none",
                        px: disablePadding ? 0 : { xs: 2, sm: 3, md: 4, xl: 5 },
                        py: disablePadding ? 0 : { xs: 2.5, sm: 3, md: 3.5 },
                        color: isDarkMode ? "#F9FAFB" : "inherit",
                    }}
                >
                    {!disablePadding && <ActingCompanyBanner />}
                    {!disablePadding && <ViewOnlyBanner />}
                    {children}
                </Box>
            </Box>
        </Box>
    );
};

export default Layout;
