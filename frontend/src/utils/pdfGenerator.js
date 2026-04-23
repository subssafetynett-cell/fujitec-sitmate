import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Generates and downloads a PDF from a given HTML element reference.
 * 
 * @param {React.RefObject} printRef - The useRef hook pointing to the component to print
 * @param {string} fileName - The desired name of the downloaded file
 * @param {function} onComplete - Callback executed after generation (e.g. to close the window)
 */
export const downloadPdfFromRef = async (printRef, fileName = "document", onComplete = null, options = {}) => {
    if (!printRef || !printRef.current) {
        console.error("No print reference provided for PDF generation.");
        return;
    }

    const { onePageOnly = false } = options;

    try {
        // Use a slightly lower scale (1.5) for better file size management while keeping text sharp
        const canvas = await html2canvas(printRef.current, {
            useCORS: true,
            scale: 1.5, 
            logging: false,
            windowWidth: printRef.current.scrollWidth,
            windowHeight: printRef.current.scrollHeight,
        });

        // Use JPEG with 0.75 quality for significantly smaller file sizes compared to PNG
        const imgData = canvas.toDataURL("image/jpeg", 0.75);
        const marginX = options.marginX !== undefined ? options.marginX : 0; 
        const marginY = options.marginY !== undefined ? options.marginY : 20; 
        
        // Enable internal PDF compression
        const pdf = new jsPDF({
            orientation: "p",
            unit: "mm",
            format: "a4",
            compress: true
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        const availableWidth = pageWidth - (marginX * 2);
        const availableHeight = pageHeight - (marginY * 2);
        
        let imgWidth = availableWidth;
        let imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        if (onePageOnly && imgHeight > availableHeight) {
            const ratio = availableHeight / imgHeight;
            imgHeight = availableHeight;
            imgWidth = imgWidth * ratio;
        }

        const totalPages = onePageOnly ? 1 : Math.ceil(imgHeight / availableHeight);
        const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const addHeader = (pageNum) => {
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, marginY, 'F');
        };

        const addFooter = (pageNum) => {
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, pageHeight - marginY, pageWidth, marginY, 'F');

            pdf.setFontSize(8);
            pdf.setTextColor(150);
            pdf.text(currentDate, marginX + 10, pageHeight - 10);
            pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - marginX - 10, pageHeight - 10, { align: 'right' });
            
            pdf.setDrawColor(240);
            pdf.line(marginX + 10, pageHeight - 14, pageWidth - marginX - 10, pageHeight - 14);
        };

        const xPos = (pageWidth - imgWidth) / 2;
        let position = marginY;
        
        // Use FAST compression for adding the image
        pdf.addImage(imgData, "JPEG", xPos, position, imgWidth, imgHeight, undefined, 'FAST');
        addHeader(1);
        addFooter(1);
        
        if (!onePageOnly) {
            let heightLeft = imgHeight - availableHeight;
            let currentPage = 2;
            while (heightLeft > 0) {
                position = marginY - (availableHeight * (currentPage - 1)); 
                pdf.addPage();
                pdf.addImage(imgData, "JPEG", xPos, position, imgWidth, imgHeight, undefined, 'FAST');
                addHeader(currentPage);
                addFooter(currentPage);
                heightLeft -= availableHeight;
                currentPage++;
            }
        }

        pdf.save(`${fileName}.pdf`);
        
        if (onComplete) onComplete();
    } catch (err) {
        console.error("PDF generation failed:", err);
        if (onComplete) onComplete(err);
    }
};
