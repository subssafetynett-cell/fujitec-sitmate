import fs from 'fs';

const file = '/Users/jinsiyajasmin/safetyapp/frontend/src/pages/Home.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add missing imports
if (!content.includes('useState')) {
    content = content.replace("import React from \"react\";", "import React, { useState } from \"react\";");
}
content = content.replace(
    /import \{\s*AppBar,[\s\S]*?\} from "@mui\/material";/,
    `import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Box,
    Container,
    TextField,
    Grid,
    Paper,
    Avatar,
    InputAdornment,
    IconButton,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Divider
} from "@mui/material";`
);
if (!content.includes('MenuIcon')) {
    content = content.replace(
        /import ShieldIcon from "@mui\/icons-material\/Security";/,
        `import ShieldIcon from "@mui/icons-material/Security";\nimport MenuIcon from "@mui/icons-material/Menu";`
    );
}

// 2. Add Mobile State & Drawer
content = content.replace(
    /export default function Home\(\) \{/,
    `export default function Home() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const navItems = ["Home", "How it works?", "Contact Us"];

    const drawer = (
        <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
            <Box sx={{ my: 2 }}>
                <Box component="img" src="/logo.png" alt="Logo" sx={{ height: 40 }} />
            </Box>
            <Divider />
            <List>
                {navItems.map((item) => (
                    <ListItem key={item} disablePadding>
                        <ListItemButton sx={{ textAlign: 'center' }}>
                            <ListItemText primary={item} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );`
);

// 3. Inject Toolbar modifications (Hamburger, Desktop Hide, Responsive Buttons)
// Remove existing Toolbar inner mapping and replace with responsive version
content = content.replace(
    /<Toolbar sx=\{\{ display: "flex", justifyContent: "space-between" \}\}>[\s\S]*?<\/Toolbar>/,
    `<Toolbar sx={{ display: "flex", justifyContent: "space-between", px: { xs: 0, sm: 2 } }}>
                            <motion.div
                                initial={{ y: -50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.7, ease: "easeOut" }}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    width: "100%",
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    {/* Hamburger */}
                                    <IconButton
                                        color="inherit"
                                        aria-label="open drawer"
                                        edge="start"
                                        onClick={handleDrawerToggle}
                                        sx={{ mr: 1, display: { md: 'none' }, color: '#013a63' }}
                                    >
                                        <MenuIcon />
                                    </IconButton>

                                    {/* Logo */}
                                    <Box component="img" src="/logo.png" alt="Logo" sx={{ height: { xs: 28, md: 40 } }} />
                                </Box>

                                {/* Desktop Menu */}
                                <Box sx={{ display: { xs: "none", md: "flex" }, gap: 4, alignItems: "center" }}>
                                    {navItems.map((item) => (
                                        <Button
                                            key={item}
                                            disableRipple
                                            sx={{
                                                textTransform: "none",
                                                backgroundColor: "transparent !important",
                                                color: "inherit",
                                                "&:hover": { color: "#F8AC2D" },
                                            }}
                                        >
                                            {item}
                                        </Button>
                                    ))}
                                </Box>

                                {/* Actions */}
                                <Box sx={{ display: "flex", gap: { xs: 1, sm: 2 } }}>
                                    <Button
                                        component={RouterLink}
                                        to="/login"
                                        variant="outlined"
                                        sx={{
                                            borderRadius: "10px",
                                            borderColor: "#013a63",
                                            color: "#013a63",
                                            px: { xs: 1.5, sm: 3 },
                                            py: { xs: 0.5, sm: 1 },
                                            fontSize: { xs: '0.75rem', sm: '1rem' },
                                            minWidth: 'auto'
                                        }}
                                    >
                                        Login
                                    </Button>
                                    <Button
                                        component={RouterLink}
                                        to="/signup"
                                        variant="contained"
                                        sx={{
                                            borderRadius: "10px",
                                            bgcolor: "#013a63",
                                            ":hover": { bgcolor: "#F8AC2D" },
                                            px: { xs: 1.5, sm: 3 },
                                            py: { xs: 0.5, sm: 1 },
                                            fontSize: { xs: '0.75rem', sm: '1rem' },
                                            minWidth: 'auto',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        Sign Up
                                    </Button>
                                </Box>
                            </motion.div>
                        </Toolbar>

                {/* Mobile Drawer */}
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
                    }}
                >
                    {drawer}
                </Drawer>`
);

// 4. Hero Title typography scaling
content = content.replace(
    /<Typography variant="h3" sx=\{\{ fontWeight: 700, my: 3 \}\}>/,
    '<Typography variant="h3" sx={{ fontWeight: 700, my: 3, fontSize: { xs: "2rem", md: "3rem" }, lineHeight: 1.2 }}>'
);

// 5. Center body text scaling and padding
content = content.replace(
    /<Typography variant="body1" sx=\{\{ color: "gray", mb: 4 \}\}>/,
    '<Typography variant="body1" sx={{ color: "gray", mb: 4, px: { xs: 2, md: 0 }, fontSize: { xs: "0.9rem", md: "1rem" } }}>'
);

// 6. Action Button spacing
content = content.replace(
    /<Box sx=\{\{ display: "flex", justifyContent: "center", gap: 3 \}\}>/,
    '<Box sx={{ display: "flex", justifyContent: "center", gap: { xs: 1.5, sm: 3 }, flexWrap: "wrap", px: { xs: 2, md: 0 } }}>'
);

// 7. Make staggers and alignments responsive internally
content = content.replace(/mt: 12/g, 'mt: { xs: 2, md: 12 }');
content = content.replace(/mt: 20/g, 'mt: { xs: 2, md: 20 }');
content = content.replace(/mt: 2,/g, 'mt: { xs: 2, md: 2 },');
content = content.replace(/mt: 3,/g, 'mt: { xs: 2, md: 3 },');

fs.writeFileSync(file, content);
console.log('Mobile responsiveness applied successfully to Home.jsx');
