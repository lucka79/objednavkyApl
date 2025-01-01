declare global {
  interface Window {
    IminPrinter: {
      openPrinter: () => void;
      closePrinter: () => void;
      printText: (text: string) => void;
      setAlignment: (align: number) => void;
      cutPaper: () => void;
    }
  }
}

export {};

export const printReceipt = async (data: any) => {
  try {
    // Check if IMIN printer is available
    if (typeof window.IminPrinter !== 'undefined') {
      // Initialize printer
      const printer = window.IminPrinter;
      
      // Start printing
      printer.openPrinter();
      
      // Set text alignment (0: left, 1: center, 2: right)
      printer.setAlignment(1);
      
      // Print header
      printer.printText("Your Store Name\n");
      printer.printText("------------------------\n");
      
      // Print items
      printer.setAlignment(0);
      data.items.forEach((item: any) => {
        printer.printText(`${item.name}\n`);
        printer.printText(`${item.quantity} x ${item.price} = ${item.total}\n`);
      });
      
      // Print total
      printer.printText("------------------------\n");
      printer.printText(`Total: ${data.total}\n`);
      
      // Cut paper
      printer.cutPaper();
      
      // Close printer
      printer.closePrinter();
    } else {
      console.error('IMIN printer not found');
    }
  } catch (error) {
    console.error('Printing error:', error);
  }
} 