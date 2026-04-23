import React from "react";
import { useCompanyLogo } from "../hooks/useCompanyLogo";
import {
  Box,
  Container,
  Typography,
  Grid,
  Link,
  IconButton,
} from "@mui/material";
import { motion } from "framer-motion"; // 🚀 import
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import TwitterIcon from "@mui/icons-material/Twitter";
import FacebookIcon from "@mui/icons-material/Facebook";
import InstagramIcon from "@mui/icons-material/Instagram";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.3 }, // 👈 delay between children
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export default function IsoFooter() {
  const logoUrl = useCompanyLogo();
  return (
    <Box sx={{ bgcolor: "#012a4a", color: "white", pt: 12, pb: 4 }}>
      <Container
        component={motion.div}
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        {/* Top Section */}
        <Grid container spacing={6} sx={{ mb: 12 }}>
          {/* Left Side */}
          <Grid item xs={12} md={6}>
            <motion.div variants={itemVariants}>
              <Typography variant="h4" sx={{ fontWeight: 500, lineHeight: 1.4 }}>
                Driving Excellence with ISO Standards, Ready{" "}
                <Box
                  component="span"
                  sx={{
                    color: "#a2a3a4ff",
                    transition: "color 0.3s ease",
                    "&:hover": { color: "#F8AC2D" },
                  }}
                >
                  <br /> to Transform Your Compliance Management?
                </Box>
              </Typography>
            </motion.div>

            {/* Points with Ticks */}
            <Box sx={{ display: "flex", gap: 6, mt: 4 }}>
              <motion.div variants={itemVariants}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <CheckCircleIcon sx={{ color: "green", fontSize: 20, mr: 1 }} />
                  <Typography>Experience more than 10 Years</Typography>
                </Box>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <CheckCircleIcon sx={{ color: "green", fontSize: 20, mr: 1 }} />
                  <Typography>Support for Latest Technology</Typography>
                </Box>
              </motion.div>
            </Box>
          </Grid>

          {/* Right Side */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: { xs: "flex-start", md: "flex-end" },
            }}
          >
            <motion.div variants={itemVariants}>
              <Typography
                variant="body2"
                sx={{
                  color: "white",
                  lineHeight: 1.8,
                  fontSize: "1rem",
                  mb: 4,
                }}
              >
                Empowering organizations to achieve compliance, <br />
                improve performance, and drive continuous improvement <br />
                with globally recognized ISO frameworks.
              </Typography>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Link
                href="#contact"
                underline="none"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  bgcolor: "white",
                  color: "#012a4a",
                  px: 2.5,
                  py: 1.5,
                  borderRadius: "50px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    bgcolor: "#F8AC2D",
                    color: "black",
                  },
                }}
              >
                Get in Touch <NorthEastIcon sx={{ fontSize: 18, ml: 1 }} />
              </Link>
            </motion.div>
          </Grid>
        </Grid>

        {/* Middle Bar */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            mb: 4,
          }}
        >
          <motion.div variants={itemVariants}>
            <Box
              component="img"
              src={logoUrl}
              alt="Sitemate Logo"
              sx={{ height: 40, width: "auto", mr: 1 }}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <Box sx={{ display: "flex", gap: 4 }}>
              <Link href="#home" underline="none" sx={{ color: "white" }}>
                Home
              </Link>
              <Link href="#about" underline="none" sx={{ color: "white" }}>
                About Us
              </Link>
              <Link href="#features" underline="none" sx={{ color: "white" }}>
                Features
              </Link>
              
              <Link href="#contact" underline="none" sx={{ color: "white" }}>
                Contact
              </Link>
            </Box>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <IconButton sx={{ color: "#a2a3a4ff" }}>
                <LinkedInIcon />
              </IconButton>
              <IconButton sx={{ color: "#a2a3a4ff" }}>
                <TwitterIcon />
              </IconButton>
              <IconButton sx={{ color: "#a2a3a4ff" }}>
                <FacebookIcon />
              </IconButton>
              <IconButton sx={{ color: "#a2a3a4ff" }}>
                <InstagramIcon />
              </IconButton>
            </Box>
          </motion.div>
        </Box>

        {/* Bottom Bar */}
        <motion.div variants={itemVariants}>
          <Box
            sx={{
              pt: 3,
              borderTop: "1px solid #a2a3a4ff",
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <Typography variant="body2" sx={{ color: "white" }}>
              © {new Date().getFullYear()} ISOComply Inc. All rights reserved.
            </Typography>
            <Box>
              <Link href="#terms" underline="none" sx={{ color: "white", mr: 2 }}>
                Terms of Service
              </Link>
              <Link href="#privacy" underline="none" sx={{ color: "white" }}>
                Privacy Policy
              </Link>
            </Box>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
}
