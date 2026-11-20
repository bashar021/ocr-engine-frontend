import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  getImages,
  getLabelJob,
  listLabelJobs,
  promoteToDatabank,
  startLabelJob,
  startScrape,
  stopLabelJob,
  updateImageGroundTruth,
} from "@/api/scraper";
import { server } from "@/test/mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("scraper databank + label-job api", () => {
  it("promoteToDatabank posts image_ids and returns the promote result", async () => {
    const res = await promoteToDatabank(["img-1", "img-2"]);
    expect(res.promoted).toBe(2);
    expect(res.skipped).toEqual([]);
    expect(res.sample_ids).toEqual(["sample-img-1", "sample-img-2"]);
    expect(res.dataset_id).toBe("cat-dataset-1");
  });

  it("updateImageGroundTruth sends ground_truth and bbox together", async () => {
    const bbox = { x1: 10, y1: 20, x2: 30, y2: 40 };
    const updated = await updateImageGroundTruth("img-1", "123456", bbox);
    expect(updated.ground_truth).toBe("123456");
    expect(updated.gt_bbox).toEqual(bbox);
  });

  it("startLabelJob unwraps the .job envelope", async () => {
    const job = await startLabelJob({ category_id: "cat-1" });
    expect(job.id).toBe("label-job-1");
    expect(job.category_id).toBe("cat-1");
    expect(job.status).toBe("pending");
  });

  it("getLabelJob and stopLabelJob unwrap .job", async () => {
    const running = await getLabelJob("label-job-1");
    expect(running.status).toBe("running");
    expect(running.processed).toBe(4);

    const stopped = await stopLabelJob("label-job-1");
    expect(stopped.status).toBe("stopped");
  });

  it("listLabelJobs unwraps the .jobs array", async () => {
    const jobs = await listLabelJobs({ category_id: "cat-1" });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe("completed");
    expect(jobs[0]?.category_id).toBe("cat-1");
  });
});

describe("scraper part 2: sources + license api", () => {
  it("startScrape forwards sources and max_per_source in the POST body", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("*/v1/scraper/sessions", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "s1", status: "pending", config: body });
      }),
    );
    await startScrape({
      keywords: "odometer",
      sources: ["bing", "flickr"],
      max_per_source: 25,
    });
    expect(body).toMatchObject({
      keywords: "odometer",
      sources: ["bing", "flickr"],
      max_per_source: 25,
    });
  });

  it("getImages forwards provider and has_license and exposes license fields", async () => {
    let search: URLSearchParams | null = null;
    server.use(
      http.get("*/v1/scraper/images", ({ request }) => {
        search = new URL(request.url).searchParams;
        return HttpResponse.json({
          images: [
            {
              id: "i1",
              provider: "wikimedia",
              license: "CC BY-SA 4.0",
              license_url: "https://example.com/l",
            },
          ],
          total: 1,
        });
      }),
    );
    const res = await getImages({ provider: "wikimedia", has_license: true });
    expect(search!.get("provider")).toBe("wikimedia");
    expect(search!.get("has_license")).toBe("true");
    expect(res.images[0]?.provider).toBe("wikimedia");
    expect(res.images[0]?.license).toBe("CC BY-SA 4.0");
    expect(res.images[0]?.license_url).toBe("https://example.com/l");
  });

  it("getImages omits provider and has_license when unset", async () => {
    let search: URLSearchParams | null = null;
    server.use(
      http.get("*/v1/scraper/images", ({ request }) => {
        search = new URL(request.url).searchParams;
        return HttpResponse.json({ images: [], total: 0 });
      }),
    );
    await getImages({ provider: undefined, has_license: undefined });
    expect(search!.has("provider")).toBe(false);
    expect(search!.has("has_license")).toBe(false);
  });
});
