import { PropsWithChildren } from "react";

export function PageLayout({ children }: PropsWithChildren) {
  return <main className="min-h-screen bg-gray-50">{children}</main>;
}
