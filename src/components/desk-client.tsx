"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { money } from "@/lib/catalog";
import type { Payment, Preview } from "@/lib/store";
import type { PaymentErrors, PaymentField } from "@/lib/payment-validation";

type FormFields = {
  email: string;
  sku: string;
  extraCode: string;
  externalChargeId: string;
};

export function DeskClient({ initialPayments }: { initialPayments: Payment[] }) {
  const [payments, setPayments] = useState(initialPayments);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const {
    register, handleSubmit, watch, setValue, setError, clearErrors, reset,
    formState: { errors },
  } = useForm<FormFields>({
    defaultValues: { email: "", sku: "", extraCode: "", externalChargeId: "" },
  });
  const selectedSku = watch("sku");

  const submit = handleSubmit(async (values, event) => {
    const action = (event?.nativeEvent as SubmitEvent | undefined)?.submitter as HTMLButtonElement | null;
    const isPreview = action?.value === "preview";
    clearErrors();
    setNotice("");
    setBusy(true);
    try {
      const response = await fetch(isPreview ? "/api/payments/preview" : "/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          sku: values.sku,
          externalChargeId: values.externalChargeId,
          extraCode: values.extraCode || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setPreview(null);
        const fieldErrors = (result.errors ?? {}) as PaymentErrors;
        for (const [field, message] of Object.entries(fieldErrors)) {
          if (message) setError(field as PaymentField, { type: "server", message });
        }
        setNotice("Please correct the fields below.");
        return;
      }
      if (isPreview) {
        setPreview(result.preview as Preview);
      } else {
        setPreview(null);
        if (!result.replayed) setPayments((current) => [result.payment as Payment, ...current]);
        setNotice(result.replayed ? "Charge already recorded. Original payment shown in the queue." : "Payment recorded successfully.");
      }
    } catch {
      setNotice("Unable to reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <form className="panel space-y-5 border-[#eae4da] bg-white p-7" onSubmit={submit} noValidate>
          <div className="border-b border-[#f0eae1] pb-3">
            <h2 className="text-lg font-bold tracking-tight text-[#2c1a12]">Record Staff Payment</h2>
            <p className="text-xs text-[#6e655d]">Manual terminal entry for Maple lamp and Cedar stool orders.</p>
          </div>

          <div>
            <label htmlFor="desk-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6e655d]">
              Email <span className="text-[#b91c1c]">*</span>
            </label>
            <input
              id="desk-email"
              className="field"
              type="email"
              autoComplete="email"
              placeholder="customer@example.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p className="error mt-1 flex items-center gap-1" id="email-error" role="alert">
                <span>⚠</span> {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="desk-sku" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6e655d]">
              Item <span className="text-[#b91c1c]">*</span>
            </label>
            <select
              id="desk-sku"
              className="field"
              aria-invalid={!!errors.sku}
              aria-describedby={errors.sku ? "sku-error" : undefined}
              {...register("sku", {
                onChange: (event) => {
                  if (event.target.value === "lamp") {
                    setValue("extraCode", "", { shouldDirty: true });
                    clearErrors("extraCode");
                  }
                  clearErrors("sku");
                },
              })}
            >
              <option value="">Choose an item</option>
              <option value="lamp">Maple lamp ($80)</option>
              <option value="stool">Cedar stool ($120)</option>
            </select>
            {errors.sku && (
              <p className="error mt-1 flex items-center gap-1" id="sku-error" role="alert">
                <span>⚠</span> {errors.sku.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="desk-extra" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6e655d]">
              Extra
            </label>
            <select
              id="desk-extra"
              className="field"
              aria-invalid={!!errors.extraCode}
              aria-describedby={errors.extraCode ? "extra-error" : undefined}
              disabled={selectedSku !== "stool"}
              {...register("extraCode")}
            >
              <option value="">None</option>
              {selectedSku === "stool" && <option value="cushion">Cushion (+$25)</option>}
            </select>
            {selectedSku !== "stool" && (
              <p className="mt-1 text-[11px] text-[#9c9388]">Cushion is available only with Cedar stool.</p>
            )}
            {errors.extraCode && (
              <p className="error mt-1 flex items-center gap-1" id="extra-error" role="alert">
                <span>⚠</span> {errors.extraCode.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="desk-charge" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#6e655d]">
              Charge id <span className="text-[#b91c1c]">*</span>
            </label>
            <input
              id="desk-charge"
              className="field font-mono text-sm"
              type="text"
              autoComplete="off"
              placeholder="ch_12345678"
              aria-invalid={!!errors.externalChargeId}
              aria-describedby={errors.externalChargeId ? "charge-error" : undefined}
              {...register("externalChargeId")}
            />
            {errors.externalChargeId && (
              <p className="error mt-1 flex items-center gap-1" id="charge-error" role="alert">
                <span>⚠</span> {errors.externalChargeId.message}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap gap-2.5">
              <button className="secondary" type="submit" value="preview" disabled={busy}>
                Preview
              </button>
              <button className="primary" type="submit" value="record" disabled={busy}>
                Record payment
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                reset();
                setPreview(null);
                setNotice("");
                clearErrors();
              }}
              className="text-xs font-semibold text-[#9c9388] hover:text-[#2c1a12]"
            >
              Clear form
            </button>
          </div>

          {notice && (
            <div
              role="status"
              className={`rounded-lg p-3 text-sm font-medium ${notice.includes("Please correct") || notice.includes("Unable")
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : "bg-amber-50 text-amber-900 border border-amber-200"
                }`}
            >
              {notice}
            </div>
          )}
        </form>

        <section className="panel space-y-3 border-[#eae4da] bg-white p-6" aria-label="Payment preview">
          <div className="flex items-center justify-between border-b border-[#f0eae1] pb-2.5">
            <h2 className="text-base font-bold text-[#2c1a12]">Payment preview</h2>
            {preview && <span className="badge-instock">Verified</span>}
          </div>
          {preview ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
              <dt className="text-[#6e655d]">Email</dt>
              <dd className="font-medium text-[#1f1b18]">{preview.email}</dd>
              <dt className="text-[#6e655d]">Item</dt>
              <dd className="font-medium text-[#1f1b18]">{preview.itemName}</dd>
              <dt className="text-[#6e655d]">Extra</dt>
              <dd className="font-medium text-[#1f1b18]">{preview.extraName ?? "None"}</dd>
              <dt className="text-[#6e655d]">Total</dt>
              <dd className="text-base font-bold text-[#2c1a12]">{money(preview.totalCents)}</dd>
              <dt className="text-[#6e655d]">Remaining after</dt>
              <dd className="font-semibold text-[#b45309]">{preview.remainingAfter} left</dd>
            </dl>
          ) : (
            <p className="text-xs text-[#9c9388]">Fill the form and press Preview to inspect total and inventory impact without charging.</p>
          )}
        </section>
      </div>

      <section className="panel space-y-4 border-[#eae4da] bg-white p-7" aria-label="Payment queue">
        <div className="flex items-center justify-between border-b border-[#f0eae1] pb-3">
          <div>
            <h2 className="text-lg font-bold text-[#2c1a12]">Payment queue</h2>
            <p className="text-xs text-[#6e655d]">Transactions captured in this Node process.</p>
          </div>
          <span className="badge-unlimited">{payments.length} recorded</span>
        </div>
        {payments.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#9c9388]">
            <p>No payments recorded.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#f0eae1]">
            {payments.map((payment) => (
              <li className="space-y-1.5 py-3.5 first:pt-0" key={payment.externalChargeId}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-bold text-[#2c1a12]">{payment.itemName}</p>
                  <p className="font-mono text-base font-extrabold text-[#2c1a12]">{money(payment.totalCents)}</p>
                </div>
                <p className="text-xs text-[#6e655d]">{payment.email}</p>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-[#9c9388]">{payment.externalChargeId}</span>
                  {payment.extraCode && (
                    <span className="rounded-md bg-[#faf8f5] px-1.5 py-0.5 text-[#b45309] border border-[#eae4da]">
                      +{payment.extraCode}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
