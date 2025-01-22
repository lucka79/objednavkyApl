import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import { useInvoices } from "@/hooks/useInvoices";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Button } from "./ui/button";
import { generatePDF } from "./InvoicePdf";
import { InvoiceDialog } from "./InvoiceDialog";
import { Invoice } from "../../types";
import { sendEmail } from "@/lib/email";
import { Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const InvoiceTable = () => {
  const parentRef = useRef<HTMLDivElement>(null);
  const { data: invoices = [], isLoading } = useInvoices();
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const virtualizer = useVirtualizer({
    count: invoices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 10,
  });

  const handleGeneratePDF = async (invoice: any) => {
    try {
      const invoiceData = {
        invoiceNumber: invoice.invoice_number,
        customerInfo: {
          full_name: invoice.profiles?.full_name ?? "",
          email: invoice.profiles?.email ?? "",
          address: invoice.profiles?.address ?? "",
          ico: invoice.profiles?.ico ?? "",
          dic: invoice.profiles?.dic ?? "",
        },
        dateRange: {
          start: new Date(invoice.start_date),
          end: new Date(invoice.end_date),
        },
        items: invoice.items ?? [],
        total: invoice.total ?? 0,
        orders: invoice.orders ?? [],
      };

      console.log("Generating PDF...");
      const pdfBlob = await generatePDF(invoiceData);
      console.log("Generated PDF blob size:", pdfBlob.size);

      // Create a URL for the blob
      const url = window.URL.createObjectURL(pdfBlob);
      // Create a temporary link element
      const link = document.createElement("a");
      link.href = url;
      link.download = `faktura-${invoice.invoice_number}.pdf`;
      // Trigger the download
      document.body.appendChild(link);
      link.click();
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      if (invoice.profiles?.email) {
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () =>
            resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(pdfBlob);
        });

        await sendEmail({
          to: invoice.profiles.email,
          subject: `Faktura ${invoice.invoice_number}`,
          text: `Vážený zákazníku,\n\nv příloze najdete fakturu ${invoice.invoice_number}.\n\nS pozdravem`,
          attachments: [
            {
              filename: `faktura-${invoice.invoice_number}.pdf`,
              content: base64Data,
              contentType: "application/pdf",
              encoding: "base64",
            },
          ],
        });
      }
    } catch (error) {
      console.error("Error generating/sending PDF:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se vygenerovat PDF",
        variant: "destructive",
      });
    }
  };

  const handleEmailPDF = async (invoice: any) => {
    try {
      const invoiceData = {
        invoiceNumber: invoice.invoice_number,
        customerInfo: {
          full_name: invoice.profiles?.full_name ?? "",
          email: invoice.profiles?.email ?? "",
          address: invoice.profiles?.address ?? "",
          ico: invoice.profiles?.ico ?? "",
          dic: invoice.profiles?.dic ?? "",
        },
        dateRange: {
          start: invoice.start_date ? new Date(invoice.start_date) : new Date(),
          end: invoice.end_date ? new Date(invoice.end_date) : new Date(),
        },
        items:
          invoice.items?.map((item: any) => ({
            name: item.products?.name ?? "",
            quantity: item.quantity ?? 0,
            price: item.price ?? 0,
            total: (item.quantity ?? 0) * (item.price ?? 0),
          })) ?? [],
        total: Number(invoice.total) ?? 0,
        orders:
          invoice.orders?.map((order: any) => ({
            id: order.id,
            date: order.date ? new Date(order.date) : new Date(),
            total: Number(order.total) ?? 0,
          })) ?? [],
      };

      console.log("Generating PDF...");
      const pdfBlob = await generatePDF(invoiceData);
      console.log("PDF blob size:", pdfBlob.size);

      // Convert PDF to base64 in one piece
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(",")[1]); // Remove data URL prefix
        };
        reader.readAsDataURL(pdfBlob);
      });

      console.log("Sending email with PDF attachment...");
      await sendEmail({
        to: invoice.profiles.email,
        subject: `Faktura ${invoice.invoice_number}`,
        text: `Vážený zákazníku,\n\nv příloze najdete fakturu ${invoice.invoice_number}.\n\nS pozdravem`,
        attachments: [
          {
            filename: `faktura-${invoice.invoice_number}.pdf`,
            content: base64Data,
            contentType: "application/pdf",
            encoding: "base64",
          },
        ],
      });

      toast({
        title: "Úspěch",
        description: "Email byl úspěšně odeslán",
      });
    } catch (error) {
      console.error("Error in handleEmailPDF:", error);
      toast({
        title: "Chyba",
        description: (error as Error).message || "Nepodařilo se odeslat email",
        variant: "destructive",
      });
    }
  };

  const handleTestEmailPDF = async () => {
    try {
      // Create a simple test PDF
      const testData = {
        invoiceNumber: "TEST-001",
        customerInfo: {
          full_name: "Test Customer",
          email: "l.batelkova@gmail.com",
          address: "Test Address",
          ico: "12345678",
          dic: "CZ12345678",
        },
        dateRange: {
          start: new Date(),
          end: new Date(),
        },
        items: [
          {
            name: "Test Item",
            quantity: 1,
            price: 100,
            total: 100,
          },
        ],
        total: 100,
        orders: [],
      };

      const pdfBlob = await generatePDF(testData);

      // Test if PDF is valid by downloading it directly
      const testUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = testUrl;
      a.download = "test-direct.pdf";
      a.click();
      URL.revokeObjectURL(testUrl);

      // Now try sending via email
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          console.log("Base64 prefix:", base64.substring(0, 50));
          resolve(base64.split(",")[1]);
        };
        reader.readAsDataURL(pdfBlob);
      });

      console.log("Test PDF base64 length:", base64Data.length);

      await sendEmail({
        to: "l.batelkova@gmail.com",
        subject: "Test PDF Email",
        text: "This is a test email with PDF attachment",
        attachments: [
          {
            filename: "test.pdf",
            content: base64Data,
          },
        ],
      });

      toast({
        title: "Úspěch",
        description: "Test email byl odeslán",
      });
    } catch (error) {
      console.error("Error sending test email:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se odeslat test email",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div
        ref={parentRef}
        className="h-[600px] overflow-auto border rounded-md"
      >
        <table className="w-full">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b">
              <th className="p-2 text-left w-[200px]">Číslo faktury</th>
              <th className="p-2 text-left w-[300px]">Odběratel</th>
              <th className="p-2 text-right w-[100px]">Datum vytvoření</th>
              <th className="p-2 text-right w-[100px]">Období od</th>
              <th className="p-2 text-right w-[100px]">Období do</th>
              <th className="p-2 text-right w-[100px]">Celkem</th>
              <th className="p-2 text-right w-[100px]">Akce</th>
            </tr>
          </thead>
        </table>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const invoice = invoices[virtualRow.index] as Invoice & {
              profiles?: any;
            };
            if (!invoice) return null;

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <table className="w-full">
                  <tbody>
                    <tr
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedInvoice(invoice)}
                    >
                      <td className="p-2 text-left w-[200px]">
                        {invoice.invoice_number}
                      </td>
                      <td className="p-2 text-left w-[300px]">
                        {invoice.profiles?.full_name}
                      </td>
                      <td className="p-2 text-right w-[100px]">
                        {format(new Date(invoice.created_at), "d. M. yyyy", {
                          locale: cs,
                        })}
                      </td>
                      <td className="p-2 text-right w-[100px]">
                        {format(new Date(invoice.start_date), "d. M. yyyy", {
                          locale: cs,
                        })}
                      </td>
                      <td className="p-2 text-right w-[100px]">
                        {format(new Date(invoice.end_date), "d. M. yyyy", {
                          locale: cs,
                        })}
                      </td>
                      <td className="p-2 text-right w-[100px] font-semibold">
                        {invoice.total.toFixed(2)} Kč
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleGeneratePDF(invoice);
                            }}
                          >
                            PDF
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEmailPDF(invoice);
                            }}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTestEmailPDF}
                          >
                            Test PDF Email
                          </Button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>

      <InvoiceDialog
        invoice={selectedInvoice}
        open={!!selectedInvoice}
        onOpenChange={(open) => !open && setSelectedInvoice(null)}
      />
    </>
  );
};
