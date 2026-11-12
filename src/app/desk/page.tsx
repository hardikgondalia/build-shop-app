import { DeskClient } from "@/components/desk-client";
import { getPayments } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Staff desk | Shop counter",
  description: "Preview and record staff payments.",
};

export default function DeskPage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-[#eae4da] pb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">Staff Portal</span>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#2c1a12]">Staff desk</h1>
        <p className="mt-1.5 text-sm text-[#6e655d]">
          Validate, preview, and record manual in-person payments for Maple lamp and Cedar stool.
        </p>
      </div>
      <DeskClient initialPayments={getPayments()} />
    </div>
  );
}
