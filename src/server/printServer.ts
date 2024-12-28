import express from 'express';
import cors from 'cors';
import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';

const app = express();
app.use(cors());
app.use(express.json());

const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON,  // Change according to your printer
  interface: 'printer:POS-58',  // Change to your printer name/path
  characterSet: CharacterSet.PC852_LATIN2,
  removeSpecialCharacters: false,
  options: {
    timeout: 5000
  }
});

app.post('/print', async (req, res) => {
  try {
    const { receipt, userName } = req.body;

    // Configure the print job
    printer.clear();
    printer.setCharacterSet(CharacterSet.PC852_LATIN2);
    printer.alignCenter();
    printer.bold(true);
    printer.println(userName);
    printer.println(`Doklad #${receipt.receipt_no}`);
    printer.println(new Date(receipt.date).toLocaleDateString());
    printer.bold(false);
    printer.drawLine();

    // Print items
    receipt.receipt_items?.forEach((item: {
      product: { name: string };
      quantity: number;
      price: number;
    }) => {
      printer.alignLeft();
      printer.println(item.product.name);
      printer.leftRight(
        `${item.quantity}x @ ${item.price.toFixed(2)}`,
        `${(item.quantity * item.price).toFixed(2)} Kč`
      );
    });

    printer.drawLine();

    // Print totals
    printer.alignRight();
    printer.bold(true);
    printer.println(`Celkem: ${receipt.total.toFixed(2)} Kč`);
    printer.bold(false);

    // Cut the paper
    printer.cut();

    // Execute print job
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      throw new Error('Printer not connected');
    }

    await printer.execute();
    res.json({ success: true });
  } catch (error) {
    console.error('Print error:', error);
    res.status(500).json({ error: 'Print failed' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Print server running on port ${PORT}`);
}); 