import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import robotoFont from "../assets/fonts/Roboto-Regular.ttf";

export const generatePDF = async (data: {
  invoiceNumber: string;
  customerInfo: {
    full_name: string;
    company?: string | null;
    email?: string;
    address?: string;
    ico?: string;
    dic?: string;
  };
  dateRange: { start: Date; end: Date };
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    total: number;
  }>;
  total: number;
}) => {
  const doc = new jsPDF("p", "mm", "a4", true);
  doc.addFont(robotoFont, "Roboto", "normal");
  doc.setFont("Roboto");

  // Enable Czech characters encoding
  doc.setLanguage("cs");

  // Add company logo/header
  doc.setFontSize(20);
  doc.text("FAKTURA - DAŇOVÝ DOKLAD", 105, 20, { align: "center" });
  doc.setFontSize(12);
  doc.text(`Variabilní symbol: ${data.invoiceNumber}`, 105, 30, {
    align: "center",
  });

  // Add dates
  doc.text(
    `Datum vystavení: ${format(new Date(), "d. M. yyyy", { locale: cs })}`,
    20,
    45
  );
  doc.text(
    `Období: ${format(data.dateRange.start, "d. M. yyyy", { locale: cs })} - ${format(data.dateRange.end, "d. M. yyyy", { locale: cs })}`,
    20,
    52
  );

  // Add customer info
  doc.text("Odběratel:", 20, 65);
  doc.text(data.customerInfo.company ?? data.customerInfo.full_name, 20, 72);
  doc.text(data.customerInfo.address ?? "", 20, 79);
  if (data.customerInfo.ico) doc.text(`IČO: ${data.customerInfo.ico}`, 20, 86);
  if (data.customerInfo.dic) doc.text(`DIČ: ${data.customerInfo.dic}`, 20, 93);

  // Add items table
  const tableData = data.items.map((item) => [
    item.name,
    item.quantity.toString(),
    `${item.price.toLocaleString("cs-CZ")} Kč`,
    `${item.total.toLocaleString("cs-CZ")} Kč`,
  ]);

  (doc as any).autoTable({
    startY: 105,
    head: [["Položka", "Množství", "Cena/ks", "Celkem"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [51, 51, 51] },
    foot: [["", "", "Celkem:", `${data.total.toLocaleString("cs-CZ")} Kč`]],
    footStyles: { fillColor: [240, 240, 240] },
  });

  // Save the PDF
  doc.save(`faktura-${data.invoiceNumber}.pdf`);
};
