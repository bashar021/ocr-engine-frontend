import { Tag } from "antd";

const STATUS_COLOR: Record<string, string> = {
  uploaded: "blue",
  verified: "green",
  active_eligible: "cyan",
  retired: "default",
  missing_file: "red",
  digest_mismatch: "orange",
  draft: "gold",
  active: "green",
  disabled: "default",
  uploading: "blue",
  processing: "processing",
  ready: "green",
  failed: "red",
  archived: "default",
  consumed: "purple",
  queued: "gold",
  starting: "processing",
  running: "processing",
  completed: "green",
  cancelled: "default",
};

interface StatusTagProps {
  status: string;
}

export function StatusTag({ status }: StatusTagProps) {
  return <Tag color={STATUS_COLOR[status] ?? "default"}>{status}</Tag>;
}
