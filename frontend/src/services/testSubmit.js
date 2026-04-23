import api from './api';

async function testSubmit() {
    try {
        const category = "SHQ Inspection service report";
        const res = await api.get('/forms');
        const form = res.data.data.find(f => f.title === "SHQ Inspection Service Report");
        if (!form) {
            console.error("Form template not found!");
            return;
        }

        const payload = {
            docInfo: { date: "Test Date" },
            headerLabels: { formTitle: "Test Title" },
            formData: { client: "Automated Test Client", siteAddress: "123 Test St" }
        };

        const saveRes = await api.post(`/forms/${form.id || form._id}/responses`, {
            answers: payload,
            category: category
        });

        if (saveRes.data.success) {
            console.log("Submission successful!");
        } else {
            console.error("Submission failed:", saveRes.data);
        }
    } catch (e) {
        console.error("Error:", e.response?.data || e.message);
    }
}

testSubmit();
