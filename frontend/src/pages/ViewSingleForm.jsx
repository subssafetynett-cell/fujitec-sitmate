import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  TextField,
  MenuItem,
  Checkbox,
  Radio,
  RadioGroup,
  FormControlLabel,
} from "@mui/material";
import { useParams } from "react-router-dom";
import api from "../services/api";
import Layout from "../components/Layout";
import FormRenderer from "../components/FormRenderer";




export default function ViewSingleForm() {
  const { id } = useParams();

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState({});



  const handleRadioChange = (fieldId, value) => {
    setValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const res = await api.get(`/forms/${id}`);
        if (res?.data?.success) {
          setForm(res.data.data);
        }
      } catch (err) {
        console.error("Failed to load form", err);
      } finally {
        setLoading(false);
      }
    };
    fetchForm();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!form) {
    return (
      <Typography sx={{ p: 4 }}>
        Form not found
      </Typography>
    );
  }

  return (
    <Layout>
      {/* HEADER */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          gap: 2,
          flexWrap: "wrap",
        }}
      >


        <Box sx={{ display: "flex", gap: 1 }}>
          {/* Edit */}


          {/* Use Form */}

        </Box>
      </Box>

      {/* FORM CONTENT */}
      <Paper sx={{ p: 3, maxWidth: 900 }}>
        <FormRenderer 
          form={form}
          values={values}
          readOnly={true}
        />
      </Paper>
      {/* LOGO at Bottom Right */}
      {form.createdBy?.clientId?.logo && (
        <Box
          component="img"
          src={form.createdBy.clientId.logo}
          alt="Company Logo"
          sx={{
            position: "fixed",
            bottom: 24,
            right: 32,
            height: 80,
            width: "auto",
            objectFit: "contain",
            zIndex: 10,
            opacity: 0.9,
          }}
        />
      )}
    </Layout>
  );
}
