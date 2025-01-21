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
        <CardTitle>Nastavení pokladní tiskárny</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAndroid && (
          <div className="text-amber-500 text-sm space-y-2">
            <p>For Android devices:</p>
            <ol className="list-decimal list-inside">
              <li>Přejděte do Android Settings → Bluetooth</li>
              <li>Ujistěte se, že Bluetooth je zapnutý</li>
              <li>Najděte a párujte svou tiskárnu (nazvanou "Printer001")</li>
              <li>
                Když vás bude žádat PIN kód, zadejte:{" "}
                <span className="font-bold">0000</span>
              </li>
            </ol>
          </div>
        )}

        {!isAndroid && (
          <div className="text-amber-500 text-sm space-y-2">
            <p>Pro USB připojení (Windows):</p>
            <ol className="list-decimal list-inside">
              <li>Připojte tiskárnu přes USB</li>
              <li>Přejděte do Windows Settings → Devices → Tiskárny</li>
              <li>Klikněte na "Přidat tiskárnu nebo skener"</li>
              <li>Počkejte, až Windows najde tiskárnu</li>
              <li>Pokud se tiskárna nenajde automaticky:</li>
              <ul className="list-disc list-inside ml-4">
                <li>Klikněte na "Tiskárna, kterou chcete, není v seznamu"</li>
                <li>Vyberte "Přidat místní tiskárnu"</li>
                <li>Vyberte USB port</li>
                <li>Vyberte "XPrinter" z výrobního listu</li>
                <li>
                  Pokud není uveden, použijte "Generická / Text Only" tiskárnu
                </li>
              </ul>
              <li>Dokončete instalaci</li>
              <li>Vytiskněte testovací stránku pro ověření</li>
            </ol>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleConnect}
            variant={isPrinterConnected ? "secondary" : "outline"}
          >
            {isPrinterConnected ? "Tiskárna připojena" : "Připojit tiskárnu"}
          </Button>

          {isPrinterConnected && (
            <Button onClick={handleDisconnect} variant="destructive">
              Odpojit tiskárnu
            </Button>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm">
            {error.includes("already connected") || error.includes("busy") ? (
              <>
                Tiskárna je zaneprázdněna nebo připojena k jinému zařízení.
                Nejdříve odpojte jiné zařízení.
              </>
            ) : (
              error
            )}
          </p>
        )}
        {!navigator.bluetooth && !isAndroid && (
          <p className="text-amber-500 text-sm">
            Web Bluetooth je podporován pouze v prohlížečích Chrome a Edge.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
