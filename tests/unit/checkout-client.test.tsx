import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CheckoutClient } from "@/components/checkout-client";
import { INITIAL_CATALOG } from "@/lib/catalog";

const products = INITIAL_CATALOG.filter((item) =>
  ["notebook", "pen", "case"].includes(item.sku),
);

describe("checkout cart and immutable payment snapshot", () => {
  it("does not open an attempt for an empty cart", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CheckoutClient products={[...products]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pay" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add an item before paying");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("charges the notebook snapshot even if a pen is added after Pay", async () => {
    const notebook = { sku: "notebook", name: "Field notebook", unitPriceCents: 1500, qty: 1 };
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => url.endsWith("/begin")
        ? { attemptId: "attempt-1", lines: [notebook], amountCents: 1500 }
        : { orderId: "order-1", attemptId: "attempt-1", lines: [notebook], amountCents: 1500 },
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckoutClient products={[...products]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Field notebook" }));
    fireEvent.click(screen.getByRole("button", { name: "Pay" }));

    const payment = await screen.findByRole("region", { name: "Payment in progress" });
    expect(within(payment).getByText(/Amount due:/).parentElement).toHaveTextContent("$15");
    fireEvent.click(screen.getByRole("button", { name: "Add Gel pen" }));
    expect(screen.getByText(/Cart total:/).parentElement).toHaveTextContent("$19");
    expect(within(payment).getByText(/Amount due:/).parentElement).toHaveTextContent("$15");
    expect(within(payment).getByRole("status")).toHaveTextContent(
      "Your cart changed after payment started. You will be charged the amount below.",
    );

    fireEvent.click(within(payment).getByRole("button", { name: "Complete payment" }));
    const confirmation = await screen.findByRole("region", { name: "Order confirmation" });
    expect(within(confirmation).getByRole("heading", { name: "Order placed" })).toBeInTheDocument();
    expect(within(confirmation).getByText(/Amount charged:/).parentElement).toHaveTextContent("$15");
    expect(within(confirmation).getByText(/Field notebook × 1/)).toBeInTheDocument();
    expect(within(confirmation).queryByText(/Gel pen/)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const completedBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(completedBody).toEqual({ attemptId: "attempt-1" });
    vi.unstubAllGlobals();
  });
});
