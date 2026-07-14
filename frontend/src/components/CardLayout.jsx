import React from 'react';
import { Box, Paper } from '@mui/material';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

// Three-card floating layout exactly matching the mockup
export default function CardLayout({ children }) {
    return (
        <Box
            sx={{
                display: 'flex',
                height: '100vh',
                bgcolor: '#EDEDED',
                p: 2,
                gap: 2,
                overflow: 'hidden',
                boxSizing: 'border-box'
            }}
        >
            {/* Sidebar Card - Full height floating card */}
            <Box
                sx={{
                    display: { xs: 'none', md: 'block' },
                    flexShrink: 0
                }}
            >
                <Paper
                    elevation={0}
                    sx={{
                        width: 260,
                        height: '100%',
                        bgcolor: '#1B212C',
                        borderRadius: 4,
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
                    }}
                >
                    <Sidebar className="h-full w-full border-0" />
                </Paper>
            </Box>

            {/* Right side: TopNav and Content cards with gaps */}
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    overflow: 'hidden',
                    minWidth: 0
                }}
            >
                {/* TopNav Card */}
                <Paper
                    elevation={0}
                    sx={{
                        bgcolor: '#FFFFFF',
                        borderRadius: 4,
                        flexShrink: 0,
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
                    }}
                >
                    <TopNav />
                </Paper>

                {/* Content Card */}
                <Paper
                    elevation={0}
                    sx={{
                        flex: 1,
                        bgcolor: '#FFFFFF',
                        borderRadius: 4,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
                    }}
                >
                    <Box
                        component="main"
                        sx={{
                            flex: 1,
                            overflowY: 'auto',
                            p: 3
                        }}
                    >
                        {children}
                    </Box>
                </Paper>
            </Box>
        </Box>
    );
}
