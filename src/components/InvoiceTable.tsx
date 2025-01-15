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
      const formattedItems =
        invoice.items?.map((item: any) => ({
          name: item.products?.name ?? "",
          quantity: item.quantity ?? 0,
          price: item.price ?? 0,
          total: (item.quantity ?? 0) * (item.price ?? 0),
        })) ?? [];

      const invoiceData = {
        invoiceNumber: invoice.invoice_number,
        customerInfo: {
          full_name: invoice.profiles?.full_name ?? "",
          company: invoice.profiles?.company ?? null,
          email: invoice.profiles?.email ?? "",
          address: invoice.profiles?.address ?? "",
          ico: invoice.profiles?.ico ?? "",
          dic: invoice.profiles?.dic ?? "",
        },
        dateRange: {
          start: new Date(invoice.start_date),
          end: new Date(invoice.end_date),
        },
        items: formattedItems,
        total: invoice.total ?? 0,
        orders:
          invoice.orders?.map((order: any) => ({
            id: order.id,
            date: new Date(order.date),
            total: order.total ?? 0,
          })) ?? [],
      };

      const pdfBlob = await generatePDF(invoiceData);

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
        await sendEmail({
          to: invoice.profiles.email,
          subject: `Faktura ${invoice.invoice_number}`,
          text: `Vážený zákazníku,\n\nv příloze najdete fakturu ${invoice.invoice_number}.\n\nS pozdravem`,
          attachments: [
            {
              filename: `faktura-${invoice.invoice_number}.pdf`,
              content: pdfBlob,
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
        invoiceNumber: invoice.invoice_number as string,
        customerInfo: {
          full_name: invoice.profiles?.full_name ?? "",
          company: invoice.profiles?.company ?? null,
          email: invoice.profiles?.email ?? "",
          address: invoice.profiles?.address ?? "",
          ico: invoice.profiles?.ico ?? "",
          dic: invoice.profiles?.dic ?? "",
        },
        dateRange: {
          start: new Date(invoice.start_date),
          end: new Date(invoice.end_date),
        },
        items:
          invoice.items?.map((item: any) => ({
            name: item.products?.name ?? "",
            quantity: item.quantity ?? 0,
            price: item.price ?? 0,
            total: (item.quantity ?? 0) * (item.price ?? 0),
          })) ?? [],
        total: Number(invoice.total ?? 0),
        orders:
          invoice.orders?.map((order: any) => ({
            id: order.id,
            date: new Date(order.date),
            total: Number(order.total ?? 0),
          })) ?? [],
      };

      const pdfBlob = await generatePDF(invoiceData);

      // Send email with PDF attachment
      await sendEmail({
        to: invoice.profiles?.email,
        subject: `Faktura ${invoice.invoice_number}`,
        text: `Vážený zákazníku,\n\nv příloze najdete fakturu ${invoice.invoice_number}.\n\nS pozdravem`,
        attachments: [
          {
            filename: `faktura-${invoice.invoice_number}.pdf`,
            content: pdfBlob,
          },
        ],
      });

      toast({
        title: "Úspěch",
        description: "Email byl odeslán",
      });
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se odeslat email",
        variant: "destructive",
      });
    }
  };

  const handleTestEmail = async () => {
    try {
      console.log("Sending test email...");
      await sendEmail({
        to: "l.batelkova@gmail.com",
        subject: "Test Email from Resend",
        text: "This is a test email sent using Resend",
        attachments: [],
      });
      console.log("Test email sent successfully");
    } catch (error) {
      console.error("Test email failed:", error);
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
                            onClick={handleTestEmail}
                          >
                            Test Email
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
