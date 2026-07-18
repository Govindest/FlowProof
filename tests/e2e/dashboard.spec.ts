import { expect, test } from "@playwright/test";

test("dashboard shows seeded workflows and status summary", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Critical work, proven." }),
  ).toBeVisible();
  await expect(
    page.getByText("Offboard Contractor", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Refund Customer", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Access Policy Drift", { exact: true }).first(),
  ).toBeVisible();
});

test("fixture control exposes seeded fault and control cases", async ({
  page,
}) => {
  await page.goto("/fixtures");
  await expect(
    page.getByRole("heading", { name: "Inject failure on demand." }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(7);
});

test("judge loop catches retained repository access and proves recovery", async ({
  page,
}) => {
  await page.goto("/fixtures");
  const fault = page.getByRole("checkbox", {
    name: "Inject Repository permission drift",
  });
  await fault.check();

  await page.goto("/");
  const workflow = page
    .locator(".workflow-row")
    .filter({ hasText: "Offboard Contractor" });
  await workflow.getByRole("button", { name: "Verify now" }).click();

  await expect(page.getByText("FAIL", { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("Repository membership removed", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByTestId("step-screenshot").first()).toBeVisible();
  await expect(page.getByTestId("trace-download")).toBeVisible();
  await expect(page.getByTestId("diagnosis")).toContainText(
    /GPT-5\.6 diagnosis/i,
  );
  await expect(page.getByTestId("diagnosis")).toContainText(
    "invariant:membership-removed",
  );

  const failedRun = page.url();
  await page.getByRole("button", { name: "Repair & rerun" }).click();
  await expect(page).not.toHaveURL(failedRun);
  await expect(page.getByText("PASS", { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "Workflow proven end to end" }),
  ).toBeVisible();
});
