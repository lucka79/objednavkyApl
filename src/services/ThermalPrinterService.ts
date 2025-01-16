/// <reference types="web-bluetooth" />

export class ThermalPrinterService {
  private static instance: ThermalPrinterService;
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  static getInstance(): ThermalPrinterService {
    if (!this.instance) {
      this.instance = new ThermalPrinterService();
    }
    return this.instance;
  }

  async printReceipt(content: string): Promise<void> {
    try {
      if (!this.device || !this.device.gatt?.connected) {
        if (localStorage.getItem("thermal_printer_connected")) {
          await this.reconnect();
        } else {
          throw new Error("Printer not connected");
        }
      }

      if (!this.characteristic) {
        throw new Error("Printer not initialized");
      }

      // Replace Czech characters with basic ones
      const normalizedContent = content
        .replace(/[áā]/g, 'a')
        .replace(/[čc]/g, 'c')
        .replace(/[ďd]/g, 'd')
        .replace(/[éě]/g, 'e')
        .replace(/[í]/g, 'i')
        .replace(/[ň]/g, 'n')
        .replace(/[óō]/g, 'o')
        .replace(/[řr]/g, 'r')
        .replace(/[šs]/g, 's')
        .replace(/[ťt]/g, 't')
        .replace(/[úůū]/g, 'u')
        .replace(/[ýy]/g, 'y')
        .replace(/[žz]/g, 'z')
        .replace(/[ÁĀÀÃ]/g, 'A')
        .replace(/[ČC]/g, 'C')
        .replace(/[ĎD]/g, 'D')
        .replace(/[ÉĚ]/g, 'E')
        .replace(/[Í]/g, 'I')
        .replace(/[Ň]/g, 'N')
        .replace(/[ÓŌ]/g, 'O')
        .replace(/[ŘR]/g, 'R')
        .replace(/[ŠS]/g, 'S')
        .replace(/[ŤT]/g, 'T')
        .replace(/[ÚŮŪ]/g, 'U')
        .replace(/[ÝY]/g, 'Y')
        .replace(/[ŽZ]/g, 'Z');

      // Print normalized content
      await this.characteristic.writeValue(new TextEncoder().encode(normalizedContent));
      
      // Add line feeds and cut paper
      const cutCommand = '\n\n\n\n\x1B\x6D';
      await this.characteristic.writeValue(new TextEncoder().encode(cutCommand));
      
    } catch (error) {
      console.error("Printing error:", error);
      localStorage.removeItem("thermal_printer_connected");
      throw error;
    }
  }

  async reconnect(): Promise<void> {
    try {
      if (!this.device) {
        throw new Error("No device to reconnect to");
      }

      const server = await this.device.gatt?.connect();
      if (!server) {
        throw new Error("Failed to connect to printer");
      }

      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      this.characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      
      localStorage.setItem("thermal_printer_connected", "true");
    } catch (error) {
      localStorage.removeItem("thermal_printer_connected");
      throw error;
    }
  }

  // Add event listener for disconnection
  private setupDisconnectListener() {
    this.device?.addEventListener('gattserverdisconnected', async () => {
      console.log('Printer disconnected, attempting to reconnect...');
      try {
        await this.reconnect();
        console.log('Reconnected successfully');
      } catch (error) {
        console.error('Failed to reconnect:', error);
        localStorage.removeItem("thermal_printer_connected");
      }
    });
  }

  async connectToPrinter(): Promise<void> {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API is not available');
      }

      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          {
            services: ['000018f0-0000-1000-8000-00805f9b34fb']
          }
        ]
      });

      await this.reconnect();
      this.setupDisconnectListener();
    } catch (error) {
      localStorage.removeItem("thermal_printer_connected");
      throw error;
    }
  }

  disconnect(): void {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
    localStorage.removeItem("thermal_printer_connected");
  }
} 