import React from "react";
import {
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
} from "@mui/material";
import ShieldIcon from "@mui/icons-material/Security";
import { motion } from "framer-motion";

import IsoTrustSection from "../components/IsoTrustSection";
import IsoFeaturesSection from "../components/IsoFeaturesSection";
import IsoFooter from "../components/IsoFooter";
import FAQSection from "../components/FAQSection";
import { Link as RouterLink } from "react-router-dom";

export default function Home() {
    const heroVariants = {
        hidden: { y: -40, opacity: 0 },
        visible: (i) => ({
            y: 0,
            opacity: 1,
            transition: { delay: 0.3 + i * 0.3, duration: 0.6, ease: "easeOut" }, // starts after navbar (0.7s)
        }),
    };

    const cardVariants = {
        hiddenLeft: { x: -100, opacity: 0 },
        hiddenRight: { x: 100, opacity: 0 },
        hiddenDown: { y: 100, opacity: 0 },
        visible: (i) => ({
            x: 0,
            y: 0,
            opacity: 1,
            transition: { delay: 1 + i * 0.3, duration: 0.6, ease: "easeOut" }
            // starts after hero (~2s), each staggered
        }),
    };


    return (
        <>
            <Box
                sx={{
                    minHeight: "100vh",
                    width: "100%",
                    backgroundColor: "#f0f7fa",
                    backgroundImage: 'url("/image.png")',
                    backgroundPosition: "center",
                    backgroundRepeat: "repeat",
                }}
            >
                {/* Navbar with animation */}
                <AppBar
                    position="sticky"
                    elevation={0}
                    sx={{ bgcolor: "#F6F6F4", color: "black", py: 1 }}
                >
                    <Container maxWidth="lg">
                        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
                            <motion.div
                                initial={{ y: -50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.7, ease: "easeOut" }}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    width: "100%",
                                }}
                            >
                                {/* Logo */}
                                <Box sx={{ display: "flex", alignItems: "center" }}>
                                    <Box component="img" src="/logo.png" alt="Logo" sx={{ height: 40 }} />
                                </Box>

                                {/* Menu */}
                                <Box sx={{ display: "flex", gap: 4, alignItems: "center" }}>
                                    {["Home", "How it works?", "Contact Us",].map((item) => (
                                        <Button
                                            key={item}
                                            disableRipple
                                            sx={{
                                                textTransform: "none",
                                                backgroundColor: "transparent !important",
                                                color: "inherit",
                                                "&:hover": {
                                                    backgroundColor: "transparent",
                                                    color: "#F8AC2D",
                                                },
                                            }}
                                        >
                                            {item}
                                        </Button>
                                    ))}
                                </Box>

                                {/* Actions */}
                                <Box sx={{ display: "flex", gap: 2 }}>
                                    <Button
                                        component={RouterLink}
                                        to="/login"
                                        variant="outlined"
                                        sx={{
                                            borderRadius: "10px",
                                            borderColor: "#013a63",
                                            color: "#013a63",
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
                                        }}
                                    >
                                        Sign Up
                                    </Button>
                                </Box>
                            </motion.div>
                        </Toolbar>
                    </Container>
                </AppBar>

                {/* Hero Section */}
                <Box
                    sx={{
                        minHeight: "80vh",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        backgroundColor: "#F6F6F4",
                        textAlign: "center",
                        py: 8,
                        overflow: "hidden",
                    }}
                >
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0, // full cover
                            backgroundImage: `
        linear-gradient(to right, #e0e0e0 1px, transparent 1px),
        linear-gradient(to bottom, #e0e0e0 1px, transparent 1px)
      `,
                            backgroundSize: "80px 60px",

                            // fade effect toward edges
                            WebkitMaskImage: `
        radial-gradient(circle at center,
          rgba(0,0,0,1) 20%,
          rgba(0,0,0,0) 60%)
      `,
                            WebkitMaskRepeat: "no-repeat",
                            WebkitMaskPosition: "center",
                            WebkitMaskSize: "cover",

                            maskImage: `
        radial-gradient(circle at center,
          rgba(0,0,0,1) 20%,
          rgba(0,0,0,0) 60%)
      `,
                            maskRepeat: "no-repeat",
                            maskPosition: "center",
                            maskSize: "cover",

                            zIndex: 0, // stays behind content
                        }}
                    />
                    <Container sx={{ position: "relative", zIndex: 1 }}>
                        {/* Tagline */}
                        <motion.div
                            custom={0}
                            variants={heroVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            <Paper
                                elevation={0}
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 1,
                                    backgroundColor: "white",
                                    borderRadius: "9999px",
                                    px: 2,
                                    py: 1,
                                    mb: 2,
                                    border: "1px solid rgba(255,255,255,0.2)",
                                }}
                            >
                                <ShieldIcon sx={{ fontSize: 18, color: "#013a63" }} />
                                <Typography variant="body2" fontWeight={500}>
                                    ISO Reporting Excellence
                                </Typography>
                            </Paper>
                        </motion.div>

                        {/* Heading */}
                        <motion.div
                            custom={1}
                            variants={heroVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            <Typography variant="h3" sx={{ fontWeight: 700, my: 3 }}>
                                Welcome to{" "}
                                <Box
                                    component="span"
                                    sx={{
                                        textDecoration: "underline",
                                        textDecorationColor: "#a9d6e5",
                                        transition: "color 0.3s ease",
                                        "&:hover": {
                                            color: "#F8AC2D", // hover color
                                        },
                                    }}
                                >
                                    Sitemate
                                </Box>{" "}
                                <br />
                                Tech Solutions
                            </Typography>

                        </motion.div>

                        {/* Subtext */}
                        <motion.div
                            custom={2}
                            variants={heroVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            <Typography variant="body1" sx={{ color: "gray", mb: 4 }}>
                                Improve your business with Sitemate Application.
                                We help <br />
                                organisations embed best practice, excellence, and capability for
                                sustainable growth.
                            </Typography>
                        </motion.div>

                        {/* Buttons */}
                        <motion.div
                            custom={3}
                            variants={heroVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            <Box sx={{ display: "flex", justifyContent: "center", gap: 3 }}>
                                <Button
                                    variant="contained"
                                    sx={{
                                        bgcolor: "#013a63",
                                        textTransform: "none",
                                        borderRadius: "15px",
                                        px: 3,
                                        py: 1.5,
                                        fontSize: "1rem",
                                        ":hover": { bgcolor: "#F8AC2D" },
                                    }}
                                >
                                    Get Started
                                </Button>

                                <Button
                                    sx={{
                                        textTransform: "none",
                                        borderRadius: "15px",
                                        px: 4,
                                        py: 1.5,
                                        fontSize: "1rem",
                                        backgroundColor: "white",
                                    }}
                                >
                                    Learn More
                                </Button>
                            </Box>
                        </motion.div>



                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "row",
                                justifyContent: "center",
                                alignItems: "flex-start",
                                gap: 4,
                                mt: 0.5,
                                flexWrap: "wrap",     // ✅ wrap into new row if needed
                                overflow: "hidden",   // ✅ removes scrollbar completely
                                width: "100%",
                            }}
                        >

                            {/* Card 1 - from Left */}
                            <motion.div
                                custom={0}
                                variants={cardVariants}
                                initial="hiddenLeft"
                                animate="visible"
                            >
                                <Box
                                    component="img"
                                    src="/factorry.jpeg"
                                    alt="Factory"
                                    sx={{
                                        width: "200px",
                                        height: "300px",
                                        objectFit: "cover",
                                        borderRadius: 6,
                                        mt: 2,
                                        transition: "transform 0.3s ease",
                                        "&:hover": {
                                            transform: "scale(1.05)",
                                        },
                                    }}
                                />
                            </motion.div>

                            {/* Card 2 - from Left */}
                            <motion.div
                                custom={1}
                                variants={cardVariants}
                                initial="hiddenLeft"
                                animate="visible"
                            >
                                <Paper
                                    elevation={0}
                                    sx={{
                                        borderRadius: 6,
                                        bgcolor: "#013a63",
                                        color: "white",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 160,
                                        height: 225,
                                        textAlign: "center",
                                        p: 4,
                                        mt: 12,
                                        transition: "transform 0.3s ease",
                                        "&:hover": {
                                            transform: "scale(1.05)",
                                        },
                                    }}
                                >
                                    <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                                        100+
                                    </Typography>
                                    <Typography variant="body2">
                                        Our Esteemed Clients and Partners
                                    </Typography>
                                </Paper>
                            </motion.div>

                            {/* Card 3 - from Down */}
                            <motion.div
                                custom={2}
                                variants={cardVariants}
                                initial="hiddenDown"
                                animate="visible"
                            >
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 3,
                                        borderRadius: 6,
                                        bgcolor: "white",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 0.5,
                                        width: 250,
                                        height: 160,
                                        alignItems: "flex-start",
                                        mt: 20,
                                        transition: "transform 0.3s ease",
                                        "&:hover": {
                                            transform: "scale(1.05)",
                                        },
                                    }}
                                >
                                    <Box sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        width: "100%",
                                    }} >
                                        <Box
                                            sx={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 2,
                                                bgcolor: "#e0f7fa",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }} >
                                            <ShieldIcon sx={{ color: "#013a63", fontSize: 20 }} />
                                        </Box>
                                        <Typography variant="h6"
                                            sx={{ cursor: "pointer" }}> ⋮
                                        </Typography>
                                    </Box>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Total ISO Audits </Typography>
                                    <Typography variant="h5" fontWeight={700}>
                                        351+ </Typography>
                                    <Typography variant="body2" sx={{ color: "green" }}>
                                        Increase of 23 this month </Typography>
                                </Paper>
                            </motion.div>

                            {/* Card 4 - from Right */}
                            <motion.div
                                custom={3}
                                variants={cardVariants}
                                initial="hiddenRight"
                                animate="visible"
                            >
                                <Paper
                                    elevation={0}
                                    sx={{
                                        borderRadius: 6,
                                        bgcolor: "#2a6f97",
                                        color: "white",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 160,
                                        height: 225,
                                        textAlign: "center",
                                        p: 4,
                                        mt: 12,
                                        transition: "transform 0.3s ease",
                                        "&:hover": {
                                            transform: "scale(1.05)",
                                        },
                                    }}
                                >
                                    <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                                        6+
                                    </Typography>
                                    <Typography variant="body2">
                                        Years of Industry Experience
                                    </Typography>
                                </Paper>
                            </motion.div>

                            {/* Card 5 - from Right */}
                            <motion.div
                                custom={4}
                                variants={cardVariants}
                                initial="hiddenRight"
                                animate="visible"
                            >
                                <Paper
                                    elevation={3}
                                    sx={{
                                        position: "relative",
                                        width: 200,
                                        height: 300,
                                        borderRadius: 6,
                                        overflow: "hidden",
                                        mt: 3,
                                        transition: "transform 0.3s ease",
                                        "&:hover": {
                                            transform: "scale(1.05)",
                                        },
                                    }}
                                >
                                    <Box component="img" src="/image.png" alt="Factory"
                                        sx={{ width: "100%", height: "100%", objectFit: "cover", }} />

                                    <Box sx={{
                                        position: "absolute", top: 0, left: 0, width: "100%",
                                        height: "100%", color: "white", display: "flex",
                                        flexDirection: "column", justifyContent: "flex-end",
                                        alignItems: "flex-start", p: 3,
                                    }} >
                                        <ShieldIcon sx={{ fontSize: 35, mb: 2, color: "#F8AC2D" }} />
                                        <Typography variant="body2" sx={{
                                            textAlign: "left",
                                        }} >
                                            Achieve ISO Excellence Improve compliance, efficiency, and trust with ISO standards.
                                        </Typography>
                                    </Box>
                                    {/* image + overlay content unchanged */}
                                </Paper>
                            </motion.div>
                        </Box>



                    </Container>

                </Box>


            </Box>
            <IsoTrustSection />
            <IsoFeaturesSection />
            <FAQSection />

            <IsoFooter />
        </>
    );
}
