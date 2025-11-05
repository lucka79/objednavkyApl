import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, TestTube, Check, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function NotificationSettings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [browserSupport, setBrowserSupport] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if browser supports notifications
    if ("Notification" in window) {
      setBrowserSupport(true);
      setPermission(Notification.permission);
      setNotificationsEnabled(Notification.permission === "granted");
    }

    // Subscribe to real-time invoice updates
    if (Notification.permission === "granted") {
      setupRealtimeNotifications();
    }
  }, []);

  const setupRealtimeNotifications = () => {
    const channel = supabase
      .channel("invoice-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "invoices_received",
        },
        async (payload) => {
          console.log("New invoice received:", payload);

          // Get supplier name
          const { data: supplier } = await supabase
            .from("users")
            .select("full_name")
            .eq("id", payload.new.supplier_id)
            .single();

          // Show browser notification
          if (Notification.permission === "granted") {
            new Notification("🧾 Nová faktura přijata!", {
              body: `Dodavatel: ${supplier?.full_name || "Neznámý"}\nČástka: ${payload.new.total_amount || "N/A"} Kč`,
              icon: "/favicon.ico",
              badge: "/favicon.ico",
              tag: `invoice-${payload.new.id}`,
              requireInteraction: true,
            });
          }

          // Show toast notification
          toast({
            title: "🧾 Nová faktura",
            description: `${supplier?.full_name || "Neznámý"} - ${payload.new.total_amount || "N/A"} Kč`,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const requestNotificationPermission = async () => {
    if (!browserSupport) {
      toast({
        title: "Nepodporováno",
        description: "Váš prohlížeč nepodporuje notifikace",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === "granted") {
        setNotificationsEnabled(true);
        setupRealtimeNotifications();

        toast({
          title: "✅ Notifikace povoleny",
          description: "Budete upozorněni na nové faktury",
        });
      } else {
        toast({
          title: "❌ Notifikace zamítnuty",
          description: "Změňte nastavení v prohlížeči",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se povolit notifikace",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testNotification = async () => {
    setIsLoading(true);

    try {
      // Test browser notification
      if (Notification.permission === "granted") {
        new Notification("🧪 Testovací notifikace", {
          body: "Notifikace fungují správně! ✅",
          icon: "/favicon.ico",
          badge: "/favicon.ico",
        });
      }

      // Test Telegram notification (if configured)
      const { error } = await supabase.functions.invoke("notify-telegram", {
        body: {
          type: "INSERT",
          record: {
            table: "invoices_received",
            invoice_number: "TEST-001",
            supplier_id: "test-supplier",
            invoice_date: new Date().toISOString(),
            total_amount: 1500.0,
            items_count: 3,
          },
        },
      });

      if (error) {
        console.error("Telegram test error:", error);
        toast({
          title: "⚠️ Test částečně úspěšný",
          description:
            "Prohlížečová notifikace OK, Telegram není nakonfigurován",
        });
      } else {
        toast({
          title: "✅ Test úspěšný",
          description: "Zkontrolujte prohlížeč a Telegram",
        });
      }
    } catch (error) {
      console.error("Test notification error:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se odeslat testovací notifikaci",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disableNotifications = () => {
    setNotificationsEnabled(false);
    toast({
      title: "Notifikace zakázány",
      description: "Pro opětovné povolení změňte nastavení prohlížeče",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Nastavení notifikací
          </CardTitle>
          <CardDescription>
            Přijímejte upozornění na nové faktury přímo na váš telefon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Browser Support Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {browserSupport ? (
                <Check className="h-5 w-5 text-green-600" />
              ) : (
                <X className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className="font-medium">Podpora prohlížeče</p>
                <p className="text-sm text-muted-foreground">
                  {browserSupport
                    ? "Váš prohlížeč podporuje notifikace"
                    : "Váš prohlížeč nepodporuje notifikace"}
                </p>
              </div>
            </div>
            <Badge variant={browserSupport ? "default" : "destructive"}>
              {browserSupport ? "Podporováno" : "Nepodporováno"}
            </Badge>
          </div>

          {/* Permission Status */}
          {browserSupport && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {permission === "granted" ? (
                  <Bell className="h-5 w-5 text-green-600" />
                ) : permission === "denied" ? (
                  <BellOff className="h-5 w-5 text-red-600" />
                ) : (
                  <Bell className="h-5 w-5 text-gray-400" />
                )}
                <div>
                  <p className="font-medium">Stav oprávnění</p>
                  <p className="text-sm text-muted-foreground">
                    {permission === "granted"
                      ? "Notifikace jsou povoleny"
                      : permission === "denied"
                        ? "Notifikace jsou zamítnuty"
                        : "Notifikace nejsou povoleny"}
                  </p>
                </div>
              </div>
              <Badge
                variant={
                  permission === "granted"
                    ? "default"
                    : permission === "denied"
                      ? "destructive"
                      : "secondary"
                }
              >
                {permission === "granted"
                  ? "Povoleno"
                  : permission === "denied"
                    ? "Zamítnuto"
                    : "Nevyřízeno"}
              </Badge>
            </div>
          )}

          {/* Enable/Disable Toggle */}
          {browserSupport && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label
                  htmlFor="notifications"
                  className="text-base font-medium"
                >
                  Notifikace nových faktur
                </Label>
                <p className="text-sm text-muted-foreground">
                  Dostávejte upozornění při příjmu nové faktury
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    requestNotificationPermission();
                  } else {
                    disableNotifications();
                  }
                }}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {browserSupport && permission !== "granted" && (
              <Button
                onClick={requestNotificationPermission}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? "Načítání..." : "Povolit notifikace"}
              </Button>
            )}

            {permission === "granted" && (
              <Button
                onClick={testNotification}
                disabled={isLoading}
                variant="outline"
                className="flex-1 gap-2"
              >
                <TestTube className="h-4 w-4" />
                {isLoading ? "Odesílání..." : "Testovat notifikaci"}
              </Button>
            )}
          </div>

          {/* Telegram Info */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">
              💡 Tip: Telegram notifikace
            </h4>
            <p className="text-sm text-blue-700">
              Pro nejlepší zážitek doporučujeme nastavit Telegram bot
              notifikace. Budete dostávat upozornění i když není prohlížeč
              otevřený.
            </p>
            <Button
              variant="link"
              className="mt-2 px-0 h-auto text-blue-600"
              onClick={() => window.open("/NOTIFICATION_SETUP.md", "_blank")}
            >
              Zobrazit návod na nastavení →
            </Button>
          </div>

          {/* Instructions */}
          {permission === "denied" && (
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-medium text-yellow-900 mb-2">
                ⚠️ Notifikace jsou blokované
              </h4>
              <p className="text-sm text-yellow-700 mb-3">
                Pro povolení notifikací:
              </p>
              <ol className="text-sm text-yellow-700 space-y-1 ml-4 list-decimal">
                <li>Klikněte na ikonu zámku v adresním řádku</li>
                <li>Najděte "Notifikace" a změňte na "Povolit"</li>
                <li>Obnovte stránku</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
