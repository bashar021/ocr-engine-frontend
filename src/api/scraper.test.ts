import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  getLabelJob,
  listLabelJobs,
  promoteToDatabank,
  startLabelJob,
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
