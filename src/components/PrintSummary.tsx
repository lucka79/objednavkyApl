interface PrintSummaryTotalReceiptsProps {
  date: string;
  userName: string;
  total: number;
}

export function PrintSummaryTotalReceipts({
  date,
  userName,
  total,
}: PrintSummaryTotalReceiptsProps) {
  return (
    <div className="p-8 hidden print:block">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold">Souhrn tržeb</h2>
        <div className="space-y-2">
          <p>Období: {date}</p>
          <p>Prodejce: {userName}</p>

          <div className="mt-6 mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Datum</th>
                  <th className="text-right py-2">Částka</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>

          <div className="mt-4">
            <p className="text-xl font-bold border-t pt-2">
              Celkem: {total.toFixed(2)} Kč
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
