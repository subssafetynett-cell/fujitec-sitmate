import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

/**
 * Helper to load an image from a URL or Base64 string as an ArrayBuffer,
 * which is required by docx ImageRun.
 */
const fetchImageAsArrayBuffer = async (src) => {
    try {
        if (src.startsWith('data:')) {
            // It's a base64 string
            const base64Data = src.split(',')[1];
            const binaryString = window.atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        } else {
            // It's a regular URL
            const response = await fetch(src);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            return arrayBuffer;
        }
    } catch (error) {
        console.error("Failed to load image for word document:", error);
        return null;
    }
};

/**
 * Generates and downloads a Word Document (.docx) from form data.
 * @param {Object} form - The form structure containing title and fields.
 * @param {Object} values - The submitted values mapped by field id.
 * @param {string} fileName - The desired name of the downloaded file.
 * @param {function} onComplete - Callback executed after generation.
 */
export const downloadWordFromForm = async (form, values, fileName = "document", onComplete = null) => {
    if (!form || !form.fields) {
        console.error("Invalid form data provided to downloadWordFromForm.");
        if (onComplete) onComplete(new Error("Invalid form data"));
        return;
    }

    try {
        const childrenElements = [];

        // 1. Add Form Title
        childrenElements.push(
            new Paragraph({
                text: form.title || "Form Submission",
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 400 },
            })
        );
        
        // Add Date
        childrenElements.push(
            new Paragraph({
                text: `Downloaded on: ${new Date().toLocaleDateString('en-GB')}`,
                spacing: { after: 400 },
            })
        );

        // 2. Add Fields and Values
        const processFieldToElements = async (field, isNested = false) => {
            const childrenElements = [];

            // Section Header
            if (field.type === "section_header") {
                childrenElements.push(
                    new Paragraph({
                        text: field.subheading || "",
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 400, after: 200 },
                    })
                );
                return childrenElements;
            }

            // Logo Renderer (New)
            if (field.type === "logo") {
                const alignMap = {
                    left: AlignmentType.LEFT,
                    center: AlignmentType.CENTER,
                    right: AlignmentType.RIGHT
                };
                const imgAlignment = alignMap[field.alignment] || AlignmentType.LEFT;

                if (field.url) {
                    const imgBuffer = await fetchImageAsArrayBuffer(field.url);
                    if (imgBuffer) {
                        childrenElements.push(
                            new Paragraph({
                                alignment: imgAlignment,
                                children: [
                                    new ImageRun({
                                        data: imgBuffer,
                                        transformation: {
                                            width: isNested ? 80 : 150, // Logos are usually smaller
                                            height: isNested ? 30 : 60,
                                        },
                                        type: "png",
                                    })
                                ],
                                spacing: { after: isNested ? 50 : 200 }
                            })
                        );
                    }
                }
                return childrenElements;
            }

            // Grid / Table Renderer (New)
            if (field.type === "grid") {
                const rows = field.rows || 3;
                const cols = field.cols || 3;
                const gridValues = values[field.id] || {};
                const cellLabels = field.cellLabels || {};
                const cellFields = field.cellFields || {};

                // Map field.colWidths to docx percent widths dynamically
                const colWidths = field.colWidths || [];
                const totalWidth = colWidths.reduce((a,b) => a+b, 0) || cols;
                let parsedWidths = colWidths.map(w => ({ size: Math.round((w / totalWidth) * 100), type: WidthType.PERCENTAGE }));
                if (parsedWidths.length < cols) {
                    parsedWidths = Array(cols).fill({ size: Math.floor(100/cols), type: WidthType.PERCENTAGE });
                }

                if (field.label) {
                    childrenElements.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: field.label,
                                    bold: true,
                                }),
                            ],
                            spacing: { before: 200, after: 100 },
                        })
                    );
                }

                const tableRows = [];

                for (let r = 0; r < rows; r++) {
                    const tableCells = [];
                    for (let c = 0; c < cols; c++) {
                        const cellKey = `${r}_${c}`;
                        const cellVal = gridValues[cellKey] || "";
                        const isHeaderInfo = !!cellLabels[cellKey];
                        const nestedFields = cellFields[cellKey] || [];
                        
                        const cellChildren = [];

                        if (isHeaderInfo) {
                            cellChildren.push(new Paragraph({
                                children: [new TextRun({ text: cellLabels[cellKey], bold: true, color: "333333" })],
                                spacing: { before: 100, after: 100 },
                                alignment: AlignmentType.CENTER
                            }));
                        }

                        if (nestedFields.length > 0) {
                            for (const nf of nestedFields) {
                                const nfElements = await processFieldToElements(nf, true);
                                cellChildren.push(...nfElements);
                            }
                        } else if (!isHeaderInfo) {
                            cellChildren.push(new Paragraph({ 
                                children: [new TextRun({ text: cellVal, color: "000000" })], 
                                spacing: { before: 100, after: 100 },
                                alignment: AlignmentType.LEFT
                            }));
                        }

                        // Fallback empty paragraph if nothing rendered into cell buffer
                        if (cellChildren.length === 0) {
                            cellChildren.push(new Paragraph({ text: "" }));
                        }

                        tableCells.push(
                            new TableCell({
                                width: parsedWidths[c],
                                children: cellChildren,
                                borders: {
                                    top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                                    left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                                    right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                                },
                                shading: isHeaderInfo ? { fill: "F8FAFC" } : undefined
                            })
                        );
                    }
                    tableRows.push(new TableRow({ children: tableCells }));
                }

                childrenElements.push(
                    new Table({
                        rows: tableRows,
                        width: {
                            size: 100,
                            type: WidthType.PERCENTAGE,
                        },
                    })
                );
                
                // Extra spacing after table
                childrenElements.push(new Paragraph({ text: "", spacing: { after: 200 }}));
                return childrenElements;
            }

            // Construct Field Label
            childrenElements.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: field.label || "Untitled Field",
                            bold: true,
                        }),
                    ],
                    spacing: { before: 200, after: 100 },
                })
            );

            // Handle Value
            const val = values[field.id];

            if (field.type === "image_upload") {
                // Determine the image src
                const previewSrc = values[`${field.id}_preview`]; // Typically used in active form filling
                const valueSrc = typeof val === 'string' ? val : null; // Usually a base64 string
                const imgSrc = previewSrc || valueSrc;

                if (imgSrc) {
                    const imgBuffer = await fetchImageAsArrayBuffer(imgSrc);
                    if (imgBuffer) {
                        childrenElements.push(
                            new Paragraph({
                                children: [
                                    new ImageRun({
                                        data: imgBuffer,
                                        transformation: {
                                            width: isNested ? 140 : 400,
                                            height: isNested ? 105 : 300,
                                        },
                                        type: "png", // fallback type
                                    })
                                ],
                                spacing: { after: isNested ? 100 : 200 }
                            })
                        );
                    } else {
                        childrenElements.push(
                            new Paragraph({
                                text: "[Image was provided but could not be embedded]",
                                spacing: { after: 200 },
                            })
                        );
                    }
                } else {
                    childrenElements.push(
                        new Paragraph({
                            text: "No image uploaded.",
                            spacing: { after: 200 },
                        })
                    );
                }
            } else if (field.type === "signature") {
                const alignMap = {
                    left: AlignmentType.LEFT,
                    center: AlignmentType.CENTER,
                    right: AlignmentType.RIGHT
                };
                const imgAlignment = alignMap[field.alignment] || AlignmentType.LEFT;

                const previewSrc = values[`${field.id}_preview`]; 
                const valueSrc = typeof val === 'string' ? val : null; 
                const imgSrc = previewSrc || valueSrc;

                if (imgSrc) {
                    const imgBuffer = await fetchImageAsArrayBuffer(imgSrc);
                    if (imgBuffer) {
                        childrenElements.push(
                            new Paragraph({
                                alignment: imgAlignment,
                                children: [
                                    new ImageRun({
                                        data: imgBuffer,
                                        transformation: {
                                            width: isNested ? 120 : 200,
                                            height: isNested ? 60 : 100,
                                        },
                                        type: "png",
                                    })
                                ],
                                spacing: { after: isNested ? 100 : 200 }
                            })
                        );
                    } else {
                        childrenElements.push(
                            new Paragraph({
                                alignment: imgAlignment,
                                text: "[Signature image was provided but could not be embedded]",
                                spacing: { after: 200 },
                            })
                        );
                    }
                } else {
                    childrenElements.push(
                        new Paragraph({
                            alignment: imgAlignment,
                            text: "Signature (Pending)",
                            italics: true,
                            spacing: { after: 200 },
                        })
                    );
                }
            } else {
                // Text, Checkbox, Radio, Select, Date, Textarea
                let displayVal = val;
                if (Array.isArray(val)) {
                    displayVal = val.join(', ');
                } else if (!val) {
                    displayVal = "-";
                }

                childrenElements.push(
                    new Paragraph({
                        text: String(displayVal),
                        spacing: { after: 200 },
                    })
                );
            }
            
            return childrenElements;
        };

        for (const field of form.fields) {
            const elements = await processFieldToElements(field);
            childrenElements.push(...elements);
        }

        // 3. Create Document
        const doc = new Document({
            sections: [
                {
                    properties: {},
                    children: childrenElements,
                },
            ],
        });

        // 4. Generate and Save
        const blob = await Packer.toBlob(doc);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        a.href = url;
        a.download = `${fileName}.docx`;
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        if (onComplete) onComplete();

    } catch (err) {
        console.error("Word generation failed:", err);
        if (onComplete) onComplete(err);
    }
};
