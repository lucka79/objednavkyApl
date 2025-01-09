import { format } from "date-fns";

interface AdminTablePrintProps {
  users: any[];
  currentUser?: any;
}

export const AdminTablePrint = ({
  users,
  //   currentUser,
}: AdminTablePrintProps) => {
  // Filter active users and sort by name
  const sortedUsers = [...users]
    .filter((user) => user.active) // Only include active users
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  return (
    <div style={{ fontSize: "12px", margin: "0 5px" }}>
      <h2 className="text-2xl font-bold mb-6">Přehled aktivních uživatelů</h2>
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th style={{ textAlign: "left" }}>Jméno</th>
            <th style={{ textAlign: "left" }}>IČO</th>
            {/* <th style={{ textAlign: "left" }}>Email</th> */}
            <th style={{ textAlign: "left" }}>Telefon</th>
            <th style={{ textAlign: "left" }}>Adresa</th>
            <th style={{ textAlign: "center" }}>Přepravky V</th>
            <th style={{ textAlign: "center" }}>Přepravky M</th>
            <th style={{ textAlign: "left" }}>Platba</th>
            {/* <th style={{ textAlign: "left" }}>Role</th> */}
            <th style={{ textAlign: "left" }}>OZ</th>
            <th style={{ textAlign: "left" }}>MO_P</th>
            {/* <th style={{ textAlign: "left" }}>Aktivní</th> */}
          </tr>
        </thead>
        <tbody style={{ textAlign: "left", fontSize: "12px" }}>
          {sortedUsers.map((user) => (
            <tr key={user.id} className="border-b">
              <td className="py-2">{user.full_name || "-"}</td>
              <td className="py-2">{user.ico || "-"}</td>
              {/* <td className="py-2">{user.email || "-"}</td> */}
              <td className="py-2 px-2">{user.phone || "-"}</td>
              <td style={{ paddingLeft: "8px" }}>{user.address || "-"}</td>
              <td className="py-2" style={{ textAlign: "center" }}>
                {user.crateBig || 0}
              </td>
              <td className="py-2" style={{ textAlign: "center" }}>
                {user.crateSmall || 0}
              </td>
              <td className="py-2">{user.paid_by || "-"}</td>
              {/* <td className="py-2">
                {user.role
                  ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                  : "-"}
              </td> */}
              <td className="py-2" style={{ textAlign: "center" }}>
                {user.oz ? "✓" : "-"}
              </td>
              <td className="py-2" style={{ textAlign: "center" }}>
                {user.mo_partners ? "✓" : "-"}
              </td>
              {/* <td className="py-2" style={{ textAlign: "center" }}>
                {user.active ? "✓" : "-"}
              </td> */}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6">
        <div className="text-sm">
          <strong>Legenda:</strong>
          <br />
          Přepravky V - Velké přepravky
          <br />
          Přepravky M - Malé přepravky
          <br />
          OZ - Obchodní zástupce
          <br />
          MO_P - MO Partner
        </div>
      </div>

      <div className="text-right text-sm text-gray-500 mt-4">
        Vytištěno: {format(new Date(), "dd.MM.yyyy HH:mm")}
      </div>
    </div>
  );
};
