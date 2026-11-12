import { test, expect } from "@playwright/test";

function chargeId() {
  return `ch_${Math.random().toString(36).slice(2, 12).padEnd(8, "0")}`;
}

test("URL search remains after reload, and Back restores the five-item catalogue", async ({ page }) => {
  await page.goto("/shop");
  const catalogue = page.getByRole("list", { name: "Catalogue items" });
  await expect(catalogue.locator("li")).toHaveCount(5);
  await page.getByRole("searchbox", { name: "Search" }).fill("lamp");
  await expect(page).toHaveURL(/\?q=lamp/);
  await expect(catalogue.locator("li")).toHaveCount(1);
  await expect(catalogue.getByRole("link", { name: "Maple lamp" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Search" })).toHaveValue("lamp");
  await expect(catalogue.locator("li")).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(catalogue.locator("li")).toHaveCount(5);
});

test("query and descending price sort work on a direct load", async ({ page }) => {
  await page.goto("/shop?q=sto&sort=price-desc");
  await expect(page.getByRole("list", { name: "Catalogue items" }).locator("li")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Cedar stool" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("price-desc");
});

test("unknown sku is HTTP 404 and product metadata is specific", async ({ page, request }) => {
  const missing = await request.get("/shop/unavailable-sku");
  expect(missing.status()).toBe(404);
  await page.goto("/shop/stool");
  await expect(page).toHaveTitle("Cedar stool | Shop counter");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Cedar stool/);
});

test("a completed order uses only the notebook snapshot", async ({ page }) => {
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Add Field notebook" }).click();
  await page.getByRole("button", { name: "Pay" }).click();
  const payment = page.getByRole("region", { name: "Payment in progress" });
  await expect(payment.getByText(/Amount due:/).locator("..")).toContainText("$15");
  await page.getByRole("button", { name: "Add Gel pen" }).click();
  await expect(page.getByText(/Cart total:/).locator("..")).toContainText("$19");
  await expect(payment.getByText(/Amount due:/).locator("..")).toContainText("$15");
  await expect(payment.getByRole("status")).toHaveText(
    "Your cart changed after payment started. You will be charged the amount below.",
  );
  await payment.getByRole("button", { name: "Complete payment" }).click();
  const confirmation = page.getByRole("region", { name: "Order confirmation" });
  await expect(confirmation.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect(confirmation.getByText(/Amount charged:/).locator("..")).toContainText("$15");
  await expect(confirmation.getByText(/Field notebook × 1/)).toBeVisible();
  await expect(confirmation.getByText(/Gel pen/)).toHaveCount(0);
});

test("preview and record share validation; preview never reduces inventory; replay is idempotent", async ({ request }) => {
  const id = chargeId();
  const invalid = { email: "Ada@Example.com", sku: "lamp", extraCode: "cushion", externalChargeId: id };
  for (const path of ["/api/payments/preview", "/api/payments"]) {
    const response = await request.post(path, { data: invalid });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({
      ok: false, errors: { extraCode: "That extra is not sold with this item." },
    });
  }
  const stockBefore = (await (await request.get("/api/catalog")).json())
    .find((item: { sku: string }) => item.sku === "lamp").remaining;
  const input = { ...invalid, extraCode: null, email: " ADA@example.COM " };
  const preview = await request.post("/api/payments/preview", { data: input });
  expect(preview.status()).toBe(200);
  expect((await preview.json()).preview).toMatchObject({
    email: "ada@example.com", itemName: "Maple lamp", totalCents: 8000, remainingAfter: stockBefore - 1,
  });
  const stockAfterPreview = (await (await request.get("/api/catalog")).json())
    .find((item: { sku: string }) => item.sku === "lamp").remaining;
  expect(stockAfterPreview).toBe(stockBefore);
  const first = await request.post("/api/payments", { data: input });
  const replay = await request.post("/api/payments", {
    data: { ...input, sku: "stool", extraCode: "cushion" },
  });
  expect(first.status()).toBe(201);
  expect(replay.status()).toBe(200);
  expect(await replay.json()).toEqual({ replayed: true, payment: (await first.json()).payment });
  const stockAfterRecord = (await (await request.get("/api/catalog")).json())
    .find((item: { sku: string }) => item.sku === "lamp").remaining;
  expect(stockAfterRecord).toBe(stockBefore - 1);
});

test("shop cache hits do not count and payment invalidation is visible immediately", async ({ request }) => {
  const reads = async () => (await (await request.get("/api/debug/reads")).json()).catalogReads as number;
  await request.get("/shop");
  await request.get("/shop/stool");
  const beforeRepeat = await reads();
  await request.get("/shop");
  await request.get("/shop/stool");
  expect(await reads()).toBe(beforeRepeat);

  const beforeStock = (await (await request.get("/api/catalog")).json())
    .find((item: { sku: string }) => item.sku === "stool").remaining as number;
  const result = await request.post("/api/payments", {
    data: { email: "stock@example.com", sku: "stool", externalChargeId: chargeId(), extraCode: null },
  });
  expect(result.status()).toBe(201);
  const pageResponse = await request.get("/shop/stool");
  expect(await pageResponse.text()).toContain(`${beforeStock - 1} left`);
  const listResponse = await request.get("/shop");
  expect(await listResponse.text()).toContain(`${beforeStock - 1} left`);
  expect(await reads()).toBe(beforeRepeat + 1);
});

test("checkout ignores client prices and completion body lines and is idempotent", async ({ request }) => {
  const invalid = await request.post("/api/checkout/begin", { data: { lines: [] } });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toEqual({ error: "invalid_cart" });

  const begin = await request.post("/api/checkout/begin", {
    data: { lines: [{ sku: "notebook", qty: 1, unitPriceCents: 1 }] },
  });
  const attempt = await begin.json();
  expect(attempt).toMatchObject({ amountCents: 1500, lines: [{ unitPriceCents: 1500, qty: 1 }] });
  const body = {
    attemptId: attempt.attemptId,
    lines: [{ sku: "pen", qty: 9999, unitPriceCents: 1 }],
    amountCents: 1,
  };
  const first = await (await request.post("/api/checkout/complete", { data: body })).json();
  const second = await (await request.post("/api/checkout/complete", { data: body })).json();
  expect(second).toEqual(first);
  expect(first).toMatchObject({ amountCents: 1500, lines: [{ sku: "notebook", qty: 1 }] });
});
