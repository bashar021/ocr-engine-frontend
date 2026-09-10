import { DownOutlined, ScanOutlined } from "@ant-design/icons";
import { Select } from "antd";
import { useMemo } from "react";

import { useTaskContext } from "@/features/tasks/TaskContext";

type TaskSwitcherProps = {
  variant?: "default" | "title";
};

export function TaskSwitcher({ variant = "default" }: TaskSwitcherProps) {
  const { tasks, activeTaskKey, setActiveTaskKey, isLoading, activeTask } =
    useTaskContext();

  const options = useMemo(
    () =>
      tasks.map((t) => ({
        value: t.key,
        label: t.display_name,
      })),
    [tasks],
  );

  if (variant === "title") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ScanOutlined className="shrink-0 text-lg text-cyan-400" />
        <Select
          className="task-switcher-title min-w-0 flex-1 [&_.ant-select-selector]:!border-none [&_.ant-select-selector]:!bg-transparent [&_.ant-select-selector]:!px-0 [&_.ant-select-selector]:!shadow-none [&_.ant-select-selection-item]:!text-base [&_.ant-select-selection-item]:!font-semibold [&_.ant-select-selection-item]:!tracking-wide [&_.ant-select-selection-item]:!text-white"
          loading={isLoading}
          value={activeTaskKey}
          options={options}
          onChange={setActiveTaskKey}
          popupMatchSelectWidth={false}
          suffixIcon={
            <DownOutlined className="!text-xs !text-slate-400" />
          }
          placeholder={activeTask?.display_name ?? "Select task"}
          popupClassName="task-switcher-title-popup"
        />
      </div>
    );
  }

  return (
    <Select
      className="w-full"
      loading={isLoading}
      value={activeTaskKey}
      options={options}
      onChange={setActiveTaskKey}
      popupMatchSelectWidth={false}
    />
  );
}
