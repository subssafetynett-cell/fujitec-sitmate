import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
} from "@mui/material";
import { Eye, Trash2, Edit } from "lucide-react";

import { useNavigate, useSearchParams } from "react-router-dom";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import AddIcon from "@mui/icons-material/Add";

import Layout from "../components/Layout";
import api from "../services/api";
import { useTheme } from "../context/ThemeContext";

export default function ViewForms() {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const search = searchParams.get("search") || "";
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccessOpen, setDeleteSuccessOpen] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (_event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const openDeleteDialog = (id, event) => {
    // Blur the trigger so MUI does not leave focus inside #root when aria-hidden is applied.
    event?.currentTarget?.blur?.();
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setDeleteId(id);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteId(null);
  };

  const deleteForm = async (id) => {
    if (!id || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/forms/${id}`);
      setForms((prev) => prev.filter((f) => (f.id || f._id) !== id));
      setDeleteId(null);
      setDeleteSuccessOpen(true);
    } catch (err) {
      console.error("Delete failed", err);
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;
      const message =
        serverMsg ||
        (status === 503 || status === 502 || status === 504
          ? "Server temporarily unavailable. Please try again in a moment."
          : "Failed to delete form. Please try again.");
      alert(message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredForms = forms.filter((form) =>
    (form.title || "").toLowerCase().includes(search.toLowerCase())
  );

  const fetchForms = async () => {
    try {
      const res = await api.get("/forms");
      if (res?.data?.success && Array.isArray(res.data.data)) {
        const userCreatedForms = res.data.data.filter(
          (f) => !(f.fields?.length === 1 && f.fields[0].id === "custom_hardcoded_form_data")
        );
        setForms(userCreatedForms);
      } else {
        setForms([]);
      }
    } catch (err) {
      console.error("Failed to load forms", err);
      setForms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  return (
    <Layout>
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
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: isDarkMode ? "#F9FAFB" : "inherit" }}>
            All Forms
          </Typography>
          <Typography variant="body2" sx={{ color: isDarkMode ? "#9CA3AF" : "text.secondary" }}>
            Create and manage your forms
          </Typography>
        </Box>

        <Button
          variant="contained"
          onClick={() => navigate("/form-build")}
          startIcon={<AddIcon />}
          sx={{
            textTransform: "none",
            borderRadius: 3,
            boxShadow: "none",
            bgcolor: "hsl(38, 70%, 55%)",
            "&:hover": { bgcolor: "hsl(38, 70%, 45%)", boxShadow: "none" },
          }}
        >
          Create New Form
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && forms.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            No forms created yet
          </Typography>
          <Typography color="text.secondary">
            Click “Create New Form” to build your first form.
          </Typography>
        </Box>
      )}

      {!loading && forms.length > 0 && (
        <>
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              borderRadius: 2,
              border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
              bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
            }}
          >
            <Table>
              <TableHead sx={{ bgcolor: isDarkMode ? "#111827" : "#F9FAFB" }}>
                <TableRow>
                  <TableCell sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7281", fontWeight: 600 }}>
                    Form Title
                  </TableCell>
                  <TableCell sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7281", fontWeight: 600 }}>
                    Fields
                  </TableCell>
                  <TableCell sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7281", fontWeight: 600 }}>
                    Created Date
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: isDarkMode ? "#9CA3AF" : "#6B7281", fontWeight: 600 }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredForms
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((form) => {
                    const formId = form.id || form._id;
                    return (
                      <TableRow
                        key={formId}
                        hover
                        sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                      >
                        <TableCell
                          component="th"
                          scope="row"
                          sx={{ color: isDarkMode ? "#F9FAFB" : "inherit", fontWeight: 500 }}
                        >
                          {form.title || "Untitled Form"}
                        </TableCell>
                        <TableCell sx={{ color: isDarkMode ? "#D1D5DB" : "inherit" }}>
                          {form.fields?.length || 0} fields
                        </TableCell>
                        <TableCell sx={{ color: isDarkMode ? "#D1D5DB" : "inherit" }}>
                          {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                            <IconButton
                              onClick={() => navigate(`/forms/${formId}`)}
                              size="small"
                              sx={{ color: isDarkMode ? "#60A5FA" : "#0B4DA6" }}
                              aria-label="View form"
                            >
                              <Eye size={20} />
                            </IconButton>

                            <IconButton
                              onClick={() => navigate(`/form-build?id=${formId}`)}
                              size="small"
                              sx={{ color: isDarkMode ? "#10B981" : "#115E59" }}
                              aria-label="Edit form"
                            >
                              <Edit size={20} />
                            </IconButton>

                            <IconButton
                              onClick={(e) => openDeleteDialog(formId, e)}
                              size="small"
                              color="error"
                              aria-label="Delete form"
                            >
                              <Trash2 size={20} />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredForms.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              color: isDarkMode ? "#F9FAFB" : "inherit",
              "& .MuiTablePagination-selectIcon": {
                color: isDarkMode ? "#F9FAFB" : "inherit",
              },
              "& .MuiTablePagination-actions": {
                color: isDarkMode ? "#F9FAFB" : "inherit",
              },
            }}
          />
        </>
      )}

      <Dialog
        open={!!deleteId}
        onClose={closeDeleteDialog}
        disableRestoreFocus
        PaperProps={{
          sx: {
            borderRadius: 3,
            padding: 2,
            minWidth: 320,
            bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
            color: isDarkMode ? "#F9FAFB" : "inherit",
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 600, fontSize: "1.25rem" }}>
          Delete Form?
        </DialogTitle>

        <DialogContent>
          <Typography
            variant="body2"
            sx={{ mb: 2, color: isDarkMode ? "#9CA3AF" : "text.secondary" }}
          >
            Are you sure you want to delete this form? This also removes any submissions for this
            form and cannot be undone.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ borderTop: isDarkMode ? "1px solid #374151" : "none", pt: 2 }}>
          <Button
            onClick={closeDeleteDialog}
            variant="outlined"
            disabled={deleting}
            sx={{
              textTransform: "none",
              color: isDarkMode ? "#9CA3AF" : "text.primary",
              borderColor: isDarkMode ? "#374151" : "divider",
              borderRadius: 50,
              px: 3,
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            color="error"
            disableElevation
            disabled={deleting}
            onClick={() => deleteForm(deleteId)}
            sx={{
              textTransform: "none",
              borderRadius: 50,
              px: 3,
              bgcolor: "#EF4444",
            }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteSuccessOpen}
        onClose={() => setDeleteSuccessOpen(false)}
        disableRestoreFocus
        PaperProps={{
          sx: {
            borderRadius: 3,
            padding: 2,
            minWidth: 300,
            bgcolor: isDarkMode ? "#1B212C" : "#FFFFFF",
            color: isDarkMode ? "#F9FAFB" : "inherit",
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 1,
            fontWeight: 600,
            fontSize: "1.25rem",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          Deleted Successfully
        </DialogTitle>

        <DialogContent>
          <Typography
            variant="body2"
            sx={{ mb: 2, color: isDarkMode ? "#9CA3AF" : "text.secondary" }}
          >
            The form has been deleted successfully.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ pt: 1 }}>
          <Button
            variant="contained"
            onClick={() => setDeleteSuccessOpen(false)}
            disableElevation
            sx={{
              textTransform: "none",
              borderRadius: 50,
              px: 4,
              bgcolor: "#10B981",
              "&:hover": { bgcolor: "#059669" },
            }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
