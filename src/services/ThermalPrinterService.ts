/// <reference types="web-bluetooth" />

export class ThermalPrinterService {
  private static instance: ThermalPrinterService;
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  // Singleton pattern
  static getInstance() {
    if (!ThermalPrinterService.instance) {
      ThermalPrinterService.instance = new ThermalPrinterService();
    }
    return ThermalPrinterService.instance;
  }

  async connectToPrinter(): Promise<void> {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API is not available. Please use Chrome or Edge browser.');
      }

      // Request device selection dialog
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          {
            services: ['000018f0-0000-1000-8000-00805f9b34fb']
          }
        ]
      });

      const server = await this.device.gatt?.connect();
      if (!server) {
        throw new Error('Printer is busy or connected to another device');
      }

      await this.reconnect();
      localStorage.setItem('thermal_printer_connected', 'true');
    } catch (error) {
      localStorage.removeItem('thermal_printer_connected');
      console.error('Connection error:', error);
      throw error;
    }
  }

  private async reconnect(): Promise<void> {
    if (!this.device?.gatt) return;
    
    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    this.characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
  }

  async printReceipt(text: string): Promise<void> {
    if (!this.characteristic) {
      throw new Error('Printer not connected');
    }

    try {
      // Convert text to printer commands
      const encoder = new TextEncoder();
      const data = encoder.encode(text);

      // Split data into chunks (many BLE devices have a limit on packet size)
      const CHUNK_SIZE = 20;
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        await this.characteristic.writeValue(chunk);
      }

      // Add paper cut command
      const cutCommand = new Uint8Array([0x1D, 0x56, 0x41, 0x03]);
      await this.characteristic.writeValue(cutCommand);
    } catch (error) {
      console.error('Printing error:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
    localStorage.removeItem('thermal_printer_connected');
  }

  async connectByNamePrefix(namePrefix: string): Promise<void> {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API is not available. Please use Chrome or Edge browser.');
      }

      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          {
            namePrefix: namePrefix || "Printer001",
            services: ['000018f0-0000-1000-8000-00805f9b34fb']
          }
        ],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      await this.reconnect();
      localStorage.setItem('thermal_printer_connected', 'true');
    } catch (error) {
      localStorage.removeItem('thermal_printer_connected');
      console.error('Connection error:', error);
      throw error;
    }
  }

  async connectByIpAddress(ipAddress: string): Promise<void> {
    try {
      // Add validation for IP address
      if (!ipAddress.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
        throw new Error('Invalid IP address format');
      }

      // XPrinter specific connection
      const response = await fetch(`http://${ipAddress}:9100`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        // Add timeout
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        throw new Error('Printer connection failed');
      }

      localStorage.setItem('thermal_printer_connected', 'true');
    } catch (error) {
      localStorage.removeItem('thermal_printer_connected');
      console.error('Connection error:', error);
      throw new Error(
        'Connection failed. Please check:\n' +
        '1. Printer is powered on\n' +
        '2. Printer and device are on same network\n' +
        '3. IP address is correct\n' +
        '4. Try port 9100 specifically'
      );
    }
  }
} 