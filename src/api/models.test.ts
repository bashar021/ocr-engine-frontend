import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  activatePipelineRef,
  disablePipelineRef,
  listArtifacts,
  listPipelineRefs,
  setDefaultPipelineRef,
  uploadArtifact,
} from "@/api/models";
import { server } from "@/test/mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("models api", () => {
  it("lists artifacts with pagination", async () => {
    const result = await listArtifacts({
      limit: 1,
      offset: 0,
    });
    expect(result.total).toBe(2);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]?.name).toBe("odometer-detector");
    expect(result.artifacts[0]?.version).toBe("1.0.0");
  });

  it("lists pipeline refs with evaluation metrics", async () => {
    const result = await listPipelineRefs({ include_metrics: true });
    expect(result.total).toBe(1);
    expect(result.refs[0]?.model_ref).toBe("v1");
    expect(result.refs[0]?.evaluation_metrics?.end_to_end_accuracy).toBe(0.9);
    expect(result.refs[0]?.evaluation_metrics?.total_images_evaluated).toBe(
      100,
    );
  });

  it("filters by search and role", async () => {
    const result = await listArtifacts({
      search: "recognizer",
      role: "recognition",
    });
    expect(result.total).toBe(1);
    expect(result.artifacts[0]?.role).toBe("recognition");
  });

  it("uploads an artifact", async () => {
    const file = new File(["weights"], "detection.pt", {
      type: "application/octet-stream",
    });
    const created = await uploadArtifact({
      file,
      ocr_type: "odometer",
      role: "detection",
      name: "odometer-detector",
      version: "2.0.0",
      runtime: "pytorch",
    });
    expect(created.version).toBe("2.0.0");
    expect(created.id).toBeTruthy();
  });

  it("activates, sets default, and disables a pipeline ref", async () => {
    const activated = await activatePipelineRef("odometer", "v2", true);
    expect(activated.status).toBe("active");
    expect(activated.is_default).toBe(true);

    const asDefault = await setDefaultPipelineRef("odometer", "v2");
    expect(asDefault.is_default).toBe(true);

    const disabled = await disablePipelineRef("odometer", "v2");
    expect(disabled.status).toBe("disabled");
    expect(disabled.is_default).toBe(false);
  });
});
