/* PDF Export utility */
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExportOptions {
  element: HTMLElement;
  datasetName: string;
  filters: {
    team: string;
    person: string;
    status: string;
    dateFrom?: Date;
    dateTo?: Date;
  };
}

export async function exportDashboardToPDF(options: ExportOptions): Promise<void> {
  const { element, datasetName, filters } = options;

  // Wait for animations
  await new Promise(resolve => setTimeout(resolve, 500));

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // A4 landscape dimensions in mm
  const pdfWidth = 297;
  const pdfHeight = 210;

  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
  const finalWidth = imgWidth * ratio;
  const finalHeight = imgHeight * ratio;

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Header
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Dashboard: ${datasetName}`, 10, 15);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  const dateStr = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
  pdf.text(`Gerado em: ${dateStr}`, 10, 22);

  // Filters info
  let filterInfo = "Filtros: ";
  if (filters.team !== "ALL") filterInfo += `Equipe: ${filters.team} | `;
  if (filters.person !== "ALL") filterInfo += `Pessoa: ${filters.person} | `;
  if (filters.status !== "ALL") filterInfo += `Status: ${filters.status} | `;
  if (filters.dateFrom || filters.dateTo) {
    filterInfo += `Periodo: ${filters.dateFrom ? format(filters.dateFrom, "dd/MM/yy") : "..."} a ${filters.dateTo ? format(filters.dateTo, "dd/MM/yy") : "..."}`;
  }
  if (filterInfo === "Filtros: ") filterInfo += "Nenhum filtro aplicado";
  pdf.text(filterInfo, 10, 28);

  // Add image
  const xOffset = (pdfWidth - finalWidth) / 2;
  pdf.addImage(imgData, "PNG", xOffset, 35, finalWidth, finalHeight);

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(128);
  pdf.text("Pagina 1 de 1", pdfWidth - 25, pdfHeight - 5);

  pdf.save(`dashboard_${datasetName}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
