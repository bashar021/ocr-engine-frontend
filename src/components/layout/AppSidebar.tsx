import {
  ClusterOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EditOutlined,
  FileSearchOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PlayCircleOutlined,
  ScanOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Layout, Menu } from "antd";
import type { MenuProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const { Sider } = Layout;

type MenuItem = Required<MenuProps>["items"][number];

const NAV_ITEMS: MenuItem[] = [
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
        key: "/models/overview",
        icon: <FileSearchOutlined />,
        label: <Link to="/models/overview">Overview</Link>,
      },
    ],
  },
  {
    key: "evaluation-group",
    icon: <DatabaseOutlined />,
    label: "Dataset",
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
        key: "/training",
        icon: <DashboardOutlined />,
        label: <Link to="/training">Overview</Link>,
      },
      {
        key: "/training/curate",
        icon: <EditOutlined />,
        label: <Link to="/training/curate">Curate failures</Link>,
      },
      {
        key: "/training/runs",
        icon: <PlayCircleOutlined />,
        label: <Link to="/training/runs">Runs</Link>,
      },
    ],
  },
  {
    key: "/ocr",
    icon: <ScanOutlined />,
    label: <Link to="/ocr">OCR playground</Link>,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const selectedKey = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/models/refs")) return "/models/refs";
    if (path.startsWith("/models/recognition-configs"))
      return "/models/recognition-configs";
    if (path.startsWith("/models/overview")) return "/models/overview";
    if (path.startsWith("/models")) return "/models/list";
    if (path.startsWith("/evaluation/runs")) return "/evaluation/runs";
    if (path.startsWith("/evaluation/training-datasets"))
      return "/evaluation/training-datasets";
    if (path.startsWith("/evaluation/dataset-list"))
      return "/evaluation/dataset-list";
    if (path.startsWith("/evaluation")) return "/evaluation/datasets";
    if (path.startsWith("/training/runs/")) return "/training/runs";
    if (path.startsWith("/training/runs")) return "/training/runs";
    if (path.startsWith("/training/curate")) return "/training/curate";
    if (path.startsWith("/training")) return "/training";
    if (path.startsWith("/ocr")) return "/ocr";
    return path;
  }, [location.pathname]);

  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const keys: string[] = [];
    if (location.pathname.startsWith("/models")) keys.push("models-group");
    if (location.pathname.startsWith("/evaluation"))
      keys.push("evaluation-group");
    if (location.pathname.startsWith("/training")) keys.push("training-group");
    return keys.length
      ? keys
      : ["models-group", "evaluation-group", "training-group"];
  });

  useEffect(() => {
    if (location.pathname.startsWith("/models")) {
      setOpenKeys((keys) =>
        keys.includes("models-group") ? keys : [...keys, "models-group"],
      );
    }
    if (location.pathname.startsWith("/evaluation")) {
      setOpenKeys((keys) =>
        keys.includes("evaluation-group")
          ? keys
          : [...keys, "evaluation-group"],
      );
    }
    if (location.pathname.startsWith("/training")) {
      setOpenKeys((keys) =>
        keys.includes("training-group") ? keys : [...keys, "training-group"],
      );
    }
  }, [location.pathname]);

  return (
    <Sider
      breakpoint="lg"
      collapsedWidth={64}
      width={240}
      className="!h-full !overflow-y-auto !bg-slate-950"
      theme="dark"
    >
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <DashboardOutlined className="text-lg text-sky-400" />
        <span className="truncate text-sm font-semibold tracking-wide text-white">
          OCR Console
        </span>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        openKeys={openKeys}
        onOpenChange={setOpenKeys}
        items={NAV_ITEMS}
        className="!border-none !bg-transparent pt-2"
      />
    </Sider>
  );
}
