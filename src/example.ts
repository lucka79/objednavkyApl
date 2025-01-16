import { ThermalPrinterService } from "./services/ThermalPrinterService";

export async function printExample() {
  const printer = ThermalPrinterService.getInstance();

  try {
    await printer.connectToPrinter();

    const receipt = [
      '\x1B\x40',      // Initialize printer
      '\x1B\x61\x01',  // Center alignment
      'My Store\n',
      'Receipt #1234\n',
      '\n',
      'Item 1............$10.00\n',
      'Item 2............$15.00\n',
      '\n',
      'Total.............$25.00\n',
      '\n',
      'Thank you for your purchase!\n'
    ].join('');

    await printer.printReceipt(receipt);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    printer.disconnect();
  }
}

printExample(); 