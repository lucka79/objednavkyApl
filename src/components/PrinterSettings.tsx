import { useState } from "react";
import { Button } from "./ui/button";

import { ThermalPrinterService } from "@/services/ThermalPrinterService";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";

export function PrinterSettings() {
  const [isPrinterConnected, setIsPrinterConnected] = useState(
    !!localStorage.getItem("thermal_printer_connected")
  );
  const [error, setError] = useState<string>("");

  const isAndroid = /Android/i.test(navigator.userAgent);

  const handleConnect = async () => {
    const printer = ThermalPrinterService.getInstance();
    try {
      setError("");
      await printer.connectToPrinter();
      localStorage.setItem("thermal_printer_connected", "true");
      setIsPrinterConnected(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to connect printer"
      );
      console.error("Failed to connect printer:", error);
    }
  };

  const handleDisconnect = () => {
    const printer = ThermalPrinterService.getInstance();
    printer.disconnect();
    setIsPrinterConnected(false);
    localStorage.removeItem("thermal_printer_connected");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Printer Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAndroid && (
          <div className="text-amber-500 text-sm space-y-2">
            <p>For Android devices:</p>
            <ol className="list-decimal list-inside">
              <li>Go to Android Settings → Bluetooth</li>
              <li>Make sure Bluetooth is turned on</li>
              <li>Find and pair your printer (named "Printer001")</li>
              <li>
                When asked for a PIN code, enter:{" "}
                <span className="font-bold">0000</span>
              </li>
            </ol>
          </div>
        )}

        {!isAndroid && (
          <div className="text-amber-500 text-sm space-y-2">
            <p>For USB Connection (Windows):</p>
            <ol className="list-decimal list-inside">
              <li>Connect printer via USB</li>
              <li>Go to Windows Settings → Devices → Printers & scanners</li>
              <li>Click "Add a printer or scanner"</li>
              <li>Wait for Windows to find the printer</li>
              <li>If not found automatically:</li>
              <ul className="list-disc list-inside ml-4">
                <li>Click "The printer that I want isn't listed"</li>
                <li>Choose "Add a local printer"</li>
                <li>Select the USB port</li>
                <li>Choose "XPrinter" from manufacturer list</li>
                <li>If not listed, use "Generic / Text Only" printer</li>
              </ul>
              <li>Complete the installation</li>
              <li>Print a test page to verify</li>
            </ol>
            <p className="mt-2">For Mac OS:</p>
            <ol className="list-decimal list-inside">
              <li>Connect printer via USB</li>
              <li>Go to System Preferences → Printers & Scanners</li>
              <li>Click "+" to add printer</li>
              <li>Select the XPrinter from the list</li>
              <li>Choose "Generic" driver if printer not listed</li>
            </ol>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleConnect}
            variant={isPrinterConnected ? "default" : "outline"}
          >
            {isPrinterConnected ? "Printer Connected" : "Connect Printer"}
          </Button>

          {isPrinterConnected && (
            <Button onClick={handleDisconnect} variant="destructive">
              Disconnect Printer
            </Button>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm">
            {error.includes("already connected") || error.includes("busy") ? (
              <>
                Printer is busy or connected to another device. Please
                disconnect from other devices first.
              </>
            ) : (
              error
            )}
          </p>
        )}
        {!navigator.bluetooth && !isAndroid && (
          <p className="text-amber-500 text-sm">
            Web Bluetooth is only supported in Chrome and Edge browsers.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
