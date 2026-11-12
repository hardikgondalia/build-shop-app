import { CheckoutClient } from "@/components/checkout-client";
import { CHECKOUT_SKUS } from "@/lib/catalog";
import { getLiveCatalog } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Checkout | Shop counter",
  description: "Checkout with a server-priced, immutable cart snapshot.",
};

export default function CheckoutPage() {
  const products = getLiveCatalog().filter((item) =>
    CHECKOUT_SKUS.some((sku) => item.sku === sku),
  );
  return (
    <div className="space-y-8">
      <div className="border-b border-[#eae4da] pb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">Instant Cart</span>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#2c1a12]">Checkout</h1>
        <p className="mt-1.5 text-sm text-[#6e655d]">
          The payable amount is permanently frozen on the server the moment you press Pay.
        </p>
      </div>
      <CheckoutClient products={products} />
    </div>
  );
}
