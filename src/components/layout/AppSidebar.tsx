import {
  ApiOutlined,
  AuditOutlined,
  AlertOutlined,
  AppstoreOutlined,
  BranchesOutlined,
  ClusterOutlined,
  CommentOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PlayCircleOutlined,
  ProfileOutlined,
  RocketOutlined,
  ScanOutlined,
  SettingOutlined,
  TagsOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Layout, Menu } from "antd";
import type { MenuProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { TaskSwitcher } from "@/features/tasks/TaskSwitcher";
import { useTaskContext } from "@/features/tasks/TaskContext";

const { Sider } = Layout;

type MenuItem = Required<MenuProps>["items"][number];

/**
 * Shared platform nav is always visible.
 * Bill OCR workspace tabs appear only when OCR type = bill.
 */
export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeTaskKey } = useTaskContext();
  const isBillTask = activeTaskKey === "bill";

  // Leave Bill routes when switching away from the bill task
  useEffect(() => {
    if (!isBillTask && location.pathname.startsWith("/bill")) {
      navigate("/ocr", { replace: true });
    }
  }, [isBillTask, location.pathname, navigate]);

  const navItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [
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
    ];

    if (isBillTask) {
      items.push({
        key: "bill-group",
        icon: <FileTextOutlined />,
        label: "Bill OCR",
        children: [
          {
            key: "/bill/documents",
            icon: <FileTextOutlined />,
            label: <Link to="/bill/documents">Documents</Link>,
          },
          {
            key: "/bill/review",
            icon: <AuditOutlined />,
            label: <Link to="/bill/review">Review queue</Link>,
          },
          {
            key: "/bill/profiles",
            icon: <ProfileOutlined />,
            label: <Link to="/bill/profiles">Profiles</Link>,
          },
          {
            key: "/bill/feedback",
            icon: <CommentOutlined />,
            label: <Link to="/bill/feedback">Feedback</Link>,
          },
          {
            key: "/bill/system",
            icon: <ToolOutlined />,
            label: <Link to="/bill/system">System / models</Link>,
          },
        ],
      });
      items.push({
        key: "bill-dataset-group",
        icon: <DatabaseOutlined />,
        label: "Bill Dataset",
        children: [
          {
            key: "/bill/datasets",
            icon: <AppstoreOutlined />,
            label: <Link to="/bill/datasets">Datasets</Link>,
          },
          {
            key: "/bill/data",
            icon: <UnorderedListOutlined />,
            label: <Link to="/bill/data">Data list</Link>,
          },
          {
            key: "/bill/annotations",
            icon: <TagsOutlined />,
            label: <Link to="/bill/annotations">Annotations</Link>,
          },
          {
            key: "/bill/dataset-review",
            icon: <AuditOutlined />,
            label: <Link to="/bill/dataset-review">Review queue</Link>,
          },
          {
            key: "/bill/jobs",
            icon: <PlayCircleOutlined />,
            label: <Link to="/bill/jobs">Processing jobs</Link>,
          },
          {
            key: "/bill/evaluation",
            icon: <ExperimentOutlined />,
            label: <Link to="/bill/evaluation">Evaluation</Link>,
          },
          {
            key: "/bill/versions",
            icon: <BranchesOutlined />,
            label: <Link to="/bill/versions">Versions & splits</Link>,
          },
          {
            key: "/bill/issues",
            icon: <AlertOutlined />,
            label: <Link to="/bill/issues">Issues</Link>,
          },
        ],
      });
    }

    items.push(
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
            key: "/evaluation/hard-cases",
            icon: <ExperimentOutlined />,
            label: (
              <Link to="/evaluation/hard-cases">Evaluated hard dataset</Link>
            ),
          },
        ],
      },
      {
        key: "training-dataset-group",
        icon: <ThunderboltOutlined />,
        label: "Training Dataset",
        children: [
          {
            key: "/evaluation/training-datasets",
            icon: <DatabaseOutlined />,
            label: (
              <Link to="/evaluation/training-datasets">Training datasets</Link>
            ),
          },
          {
            key: "/training/curate",
            icon: <EditOutlined />,
            label: <Link to="/training/curate">Curate failures</Link>,
          },
          {
            key: "/training/augmentation",
            icon: <ExperimentOutlined />,
            label: (
              <Link to="/training/augmentation">Augmentation Dataset</Link>
            ),
          },
        ],
      },
      {
        key: "eval-runs-group",
        icon: <PlayCircleOutlined />,
        label: "Evaluation",
        children: [
          {
            key: "/evaluation/runs",
            icon: <PlayCircleOutlined />,
            label: <Link to="/evaluation/runs">Evaluation runs</Link>,
          },
          {
            key: "/evaluation/comparison",
            icon: <ExperimentOutlined />,
            label: <Link to="/evaluation/comparison">Comparison</Link>,
          },
        ],
      },
      {
        key: "training-group",
        icon: <ThunderboltOutlined />,
        label: "Training",
        children: [
          {
            key: "/training/runs",
            icon: <PlayCircleOutlined />,
            label: <Link to="/training/runs">Runs</Link>,
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
    );

    return items;
  }, [isBillTask]);

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
    if (isBillTask) {
      if (path.startsWith("/bill/dataset-review"))
        return "/bill/dataset-review";
      if (path.startsWith("/bill/datasets")) return "/bill/datasets";
      if (path.startsWith("/bill/data")) return "/bill/data";
      if (path.startsWith("/bill/annotations")) return "/bill/annotations";
      if (path.startsWith("/bill/jobs")) return "/bill/jobs";
      if (path.startsWith("/bill/evaluation")) return "/bill/evaluation";
      if (path.startsWith("/bill/versions")) return "/bill/versions";
      if (path.startsWith("/bill/issues")) return "/bill/issues";
      if (path.startsWith("/bill/review")) return "/bill/review";
      if (path.startsWith("/bill/profiles")) return "/bill/profiles";
      if (path.startsWith("/bill/feedback")) return "/bill/feedback";
      if (path.startsWith("/bill/system")) return "/bill/system";
      if (path.startsWith("/bill")) return "/bill/documents";
    }
    if (path.startsWith("/models/refs")) return "/models/refs";
    if (path.startsWith("/models/recognition-configs"))
      return "/models/recognition-configs";
    if (path.startsWith("/models")) return "/models/list";
    if (path.startsWith("/settings")) return "/settings";
    if (path.startsWith("/evaluation/comparison"))
      return "/evaluation/comparison";
    if (path.startsWith("/evaluation/runs")) return "/evaluation/runs";
    if (path.startsWith("/evaluation/hard-cases"))
      return "/evaluation/hard-cases";
    if (path.startsWith("/evaluation/training-datasets"))
      return "/evaluation/training-datasets";
    if (path.startsWith("/evaluation/dataset-list"))
      return "/evaluation/dataset-list";
    if (path.startsWith("/evaluation")) return "/evaluation/datasets";
    if (path.startsWith("/training-center")) return "/training/runs";
    if (path.startsWith("/training/runs")) return "/training/runs";
    if (path.startsWith("/training/augmentation"))
      return "/training/augmentation";
    if (path.startsWith("/training/curate")) return "/training/curate";
    if (path.startsWith("/training")) return "/training/runs";
    return path;
  }, [location.pathname, isBillTask]);

  const [openKeys, setOpenKeys] = useState<string[]>(() => [
    "models-group",
    "evaluation-group",
    "training-dataset-group",
    "eval-runs-group",
    "training-group",
    "bill-dataset-group",
  ]);

  useEffect(() => {
    if (isBillTask && location.pathname.startsWith("/bill")) {
      setOpenKeys((keys) => {
        let next = keys.includes("bill-group") ? keys : [...keys, "bill-group"];
        if (
          location.pathname.startsWith("/bill/datasets") ||
          location.pathname.startsWith("/bill/data") ||
          location.pathname.startsWith("/bill/annotations") ||
          location.pathname.startsWith("/bill/dataset-review") ||
          location.pathname.startsWith("/bill/jobs") ||
          location.pathname.startsWith("/bill/evaluation") ||
          location.pathname.startsWith("/bill/versions") ||
          location.pathname.startsWith("/bill/issues")
        ) {
          next = next.includes("bill-dataset-group")
            ? next
            : [...next, "bill-dataset-group"];
        }
        return next;
      });
    }
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
      location.pathname.startsWith("/evaluation/datasets") ||
      location.pathname.startsWith("/evaluation/dataset-list") ||
      location.pathname.startsWith("/evaluation/hard-cases")
    ) {
      setOpenKeys((keys) =>
        keys.includes("evaluation-group")
          ? keys
          : [...keys, "evaluation-group"],
      );
    }
    if (
      location.pathname.startsWith("/evaluation/training-datasets") ||
      location.pathname.startsWith("/training/curate") ||
      location.pathname.startsWith("/training/augmentation")
    ) {
      setOpenKeys((keys) =>
        keys.includes("training-dataset-group")
          ? keys
          : [...keys, "training-dataset-group"],
      );
    }
    if (
      location.pathname.startsWith("/evaluation/runs") ||
      location.pathname.startsWith("/evaluation/comparison")
    ) {
      setOpenKeys((keys) =>
        keys.includes("eval-runs-group") ? keys : [...keys, "eval-runs-group"],
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
  }, [location.pathname, isBillTask]);

  return (
    <Sider
      breakpoint="lg"
      collapsedWidth={64}
      width={248}
      className="!h-full !overflow-y-auto !bg-slate-950"
      theme="dark"
    >
      <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-950 px-4 py-3">
        <TaskSwitcher variant="title" />
      </div>
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
