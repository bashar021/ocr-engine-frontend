import {
  ApiOutlined,
  ClusterOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EditOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  ScanOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Layout, Menu } from "antd";
import type { MenuProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { TaskSwitcher } from "@/features/tasks/TaskSwitcher";
import { useTaskContext } from "@/features/tasks/TaskContext";

const { Sider } = Layout;

type MenuItem = Required<MenuProps>["items"][number];

/**
 * Product navigation is always visible so every tab renders for every task.
 * Task-specific capability gating happens inside pages, not by hiding routes.
 */
export function AppSidebar() {
  const location = useLocation();
  const { activeTask } = useTaskContext();

  const navItems: MenuItem[] = useMemo(
    () => [
      {
        key: "/overview",
        icon: <DashboardOutlined />,
        label: <Link to="/overview">Overview</Link>,
      },
      {
        key: "/ocr",
        icon: <ScanOutlined />,
        label: <Link to="/ocr">Live OCR</Link>,
      },
      {
        key: "models-group",
        icon: <ClusterOutlined />,
        label: "Models",
        children: [
          {
            key: "/models/list",
            icon: <OrderedListOutlined />,
            label: <Link to="/models/list">Model list</Link>,
          },
          {
            key: "/models/refs",
            icon: <LinkOutlined />,
            label: <Link to="/models/refs">Model refs</Link>,
          },
          {
            key: "/models/recognition-configs",
            icon: <SettingOutlined />,
            label: (
              <Link to="/models/recognition-configs">Recognition configs</Link>
            ),
          },
          {
            key: "/releases",
            icon: <RocketOutlined />,
            label: <Link to="/releases">Releases</Link>,
          },
          {
            key: "/deployments",
            icon: <RocketOutlined />,
            label: <Link to="/deployments">Deployments</Link>,
          },
        ],
      },
      {
        key: "evaluation-group",
        icon: <DatabaseOutlined />,
        label: "Datasets",
        children: [
          {
            key: "/evaluation/datasets",
            icon: <OrderedListOutlined />,
            label: <Link to="/evaluation/datasets">Datasets</Link>,
          },
          {
            key: "/evaluation/dataset-list",
            icon: <DatabaseOutlined />,
            label: <Link to="/evaluation/dataset-list">Dataset list</Link>,
          },
          {
            key: "/data-explorer",
            icon: <ExperimentOutlined />,
            label: <Link to="/data-explorer">Data explorer</Link>,
          },
          {
            key: "/annotation",
            icon: <EditOutlined />,
            label: <Link to="/annotation">Annotation review</Link>,
          },
          {
            key: "/evaluation/training-datasets",
            icon: <ThunderboltOutlined />,
            label: (
              <Link to="/evaluation/training-datasets">Training datasets</Link>
            ),
          },
          {
            key: "/evaluation/runs",
            icon: <PlayCircleOutlined />,
            label: <Link to="/evaluation/runs">Evaluation runs</Link>,
          },
        ],
      },
      {
        key: "training-group",
        icon: <ThunderboltOutlined />,
        label: "Training",
        children: [
          {
            key: "/training-center",
            icon: <DashboardOutlined />,
            label: <Link to="/training-center">Training Center</Link>,
          },
          {
            key: "/training/runs",
            icon: <PlayCircleOutlined />,
            label: <Link to="/training/runs">Runs</Link>,
          },
          {
            key: "/training/curate",
            icon: <EditOutlined />,
            label: <Link to="/training/curate">Curate failures</Link>,
          },
          {
            key: "/training",
            icon: <DashboardOutlined />,
            label: <Link to="/training">Legacy overview</Link>,
          },
        ],
      },
      {
        key: "/clients",
        icon: <ApiOutlined />,
        label: <Link to="/clients">API clients</Link>,
      },
      {
        key: "/history",
        icon: <HistoryOutlined />,
        label: <Link to="/history">Audit / history</Link>,
      },
      {
        key: "/jobs",
        icon: <PlayCircleOutlined />,
        label: <Link to="/jobs">Jobs</Link>,
      },
      {
        key: "/import-export",
        icon: <DatabaseOutlined />,
        label: <Link to="/import-export">Import / Export</Link>,
      },
      {
        key: "/settings",
        icon: <SettingOutlined />,
        label: <Link to="/settings">Settings</Link>,
      },
    ],
    [activeTask?.key],
  );

  const selectedKey = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/overview")) return "/overview";
    if (path.startsWith("/releases")) return "/releases";
    if (path.startsWith("/deployments")) return "/deployments";
    if (path.startsWith("/clients")) return "/clients";
    if (path.startsWith("/history")) return "/history";
    if (path.startsWith("/jobs")) return "/jobs";
    if (path.startsWith("/import-export")) return "/import-export";
    if (path.startsWith("/ocr")) return "/ocr";
    if (path.startsWith("/models/refs")) return "/models/refs";
    if (path.startsWith("/models/recognition-configs"))
      return "/models/recognition-configs";
    if (path.startsWith("/models")) return "/models/list";
    if (path.startsWith("/data-explorer")) return "/data-explorer";
    if (path.startsWith("/annotation")) return "/annotation";
    if (path.startsWith("/settings")) return "/settings";
    if (path.startsWith("/evaluation/runs")) return "/evaluation/runs";
    if (path.startsWith("/evaluation/training-datasets"))
      return "/evaluation/training-datasets";
    if (path.startsWith("/evaluation/dataset-list"))
      return "/evaluation/dataset-list";
    if (path.startsWith("/evaluation")) return "/evaluation/datasets";
    if (path.startsWith("/training-center")) return "/training-center";
    if (path.startsWith("/training/runs")) return "/training/runs";
    if (path.startsWith("/training/curate")) return "/training/curate";
    if (path.startsWith("/training")) return "/training";
    return path;
  }, [location.pathname]);

  const [openKeys, setOpenKeys] = useState<string[]>(() => [
    "models-group",
    "evaluation-group",
    "training-group",
  ]);

  useEffect(() => {
    if (
      location.pathname.startsWith("/models") ||
      location.pathname.startsWith("/releases") ||
      location.pathname.startsWith("/deployments")
    ) {
      setOpenKeys((keys) =>
        keys.includes("models-group") ? keys : [...keys, "models-group"],
      );
    }
    if (
      location.pathname.startsWith("/evaluation") ||
      location.pathname.startsWith("/data-explorer") ||
      location.pathname.startsWith("/annotation")
    ) {
      setOpenKeys((keys) =>
        keys.includes("evaluation-group")
          ? keys
          : [...keys, "evaluation-group"],
      );
    }
    if (
      location.pathname.startsWith("/training") ||
      location.pathname.startsWith("/training-center")
    ) {
      setOpenKeys((keys) =>
        keys.includes("training-group") ? keys : [...keys, "training-group"],
      );
    }
  }, [location.pathname]);

  return (
    <Sider
      breakpoint="lg"
      collapsedWidth={64}
      width={248}
      className="!h-full !overflow-y-auto !bg-slate-950"
      theme="dark"
    >
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <ScanOutlined className="text-lg text-cyan-400" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-wide text-white">
            OCR Platform
          </div>
          <div className="truncate text-[11px] text-slate-400">
            {activeTask?.display_name ?? "Select task"}
          </div>
        </div>
      </div>
      <TaskSwitcher />
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        openKeys={openKeys}
        onOpenChange={setOpenKeys}
        items={navItems}
        className="!border-none !bg-transparent pt-2"
      />
    </Sider>
  );
}
