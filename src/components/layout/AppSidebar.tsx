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

const ODOMETER_ONLY_PREFIXES = [
  "/models",
  "/releases",
  "/deployments",
  "/evaluation",
  "/training",
  "/training-center",
  "/clients",
  "/history",
  "/jobs",
  "/import-export",
] as const;

function isOdometerOnlyPath(pathname: string): boolean {
  return ODOMETER_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Sidebar is task-scoped:
 * - odometer → platform / odometer tabs only
 * - bill → Bill OCR + Bill Dataset tabs only
 */
export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeTaskKey } = useTaskContext();
  const isBillTask = activeTaskKey === "bill";

  // Keep the user on routes that match the active OCR type
  useEffect(() => {
    if (!isBillTask && location.pathname.startsWith("/bill")) {
      navigate("/ocr", { replace: true });
      return;
    }
    if (isBillTask && isOdometerOnlyPath(location.pathname)) {
      navigate("/bill/documents", { replace: true });
    }
  }, [isBillTask, location.pathname, navigate]);

  const navItems: MenuItem[] = useMemo(() => {
    if (isBillTask) {
      return [
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
              key: "/bill/feedback",
              icon: <CommentOutlined />,
              label: <Link to="/bill/feedback">Feedback</Link>,
            },
          ],
        },
        {
          key: "bill-models-group",
          icon: <ClusterOutlined />,
          label: "Bill Models",
          children: [
            {
              key: "/bill/models/profiles",
              icon: <ProfileOutlined />,
              label: <Link to="/bill/models/profiles">Profiles & versions</Link>,
            },
            {
              key: "/bill/models/fields",
              icon: <SettingOutlined />,
              label: <Link to="/bill/models/fields">Field extraction</Link>,
            },
            {
              key: "/bill/models/pipeline",
              icon: <ToolOutlined />,
              label: <Link to="/bill/models/pipeline">Pipeline</Link>,
            },
          ],
        },
        {
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
              key: "/bill/evaluation-datasets",
              icon: <ExperimentOutlined />,
              label: (
                <Link to="/bill/evaluation-datasets">Evaluation datasets</Link>
              ),
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
              label: <Link to="/bill/evaluation">Evaluation runs</Link>,
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
        },
        {
          key: "/settings",
          icon: <SettingOutlined />,
          label: <Link to="/settings">Settings</Link>,
        },
      ];
    }

    return [
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
    ];
  }, [isBillTask]);

  const selectedKey = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/overview")) return "/overview";
    if (path.startsWith("/ocr")) return "/ocr";
    if (path.startsWith("/settings")) return "/settings";

    if (isBillTask) {
      if (path.startsWith("/bill/models/fields")) return "/bill/models/fields";
      if (path.startsWith("/bill/models/pipeline"))
        return "/bill/models/pipeline";
      if (path.startsWith("/bill/models")) return "/bill/models/profiles";
      if (path.startsWith("/bill/evaluation-datasets"))
        return "/bill/evaluation-datasets";
      if (path.startsWith("/bill/dataset-review")) return "/bill/dataset-review";
      if (path.startsWith("/bill/datasets")) return "/bill/datasets";
      if (path.startsWith("/bill/data")) return "/bill/data";
      if (path.startsWith("/bill/annotations")) return "/bill/annotations";
      if (path.startsWith("/bill/jobs")) return "/bill/jobs";
      if (path.startsWith("/bill/evaluation")) return "/bill/evaluation";
      if (path.startsWith("/bill/versions")) return "/bill/versions";
      if (path.startsWith("/bill/issues")) return "/bill/issues";
      if (path.startsWith("/bill/review")) return "/bill/review";
      if (path.startsWith("/bill/profiles")) return "/bill/models/profiles";
      if (path.startsWith("/bill/feedback")) return "/bill/feedback";
      if (path.startsWith("/bill/system")) return "/bill/models/pipeline";
      if (path.startsWith("/bill")) return "/bill/documents";
      return path;
    }

    if (path.startsWith("/releases")) return "/releases";
    if (path.startsWith("/deployments")) return "/deployments";
    if (path.startsWith("/clients")) return "/clients";
    if (path.startsWith("/history")) return "/history";
    if (path.startsWith("/jobs")) return "/jobs";
    if (path.startsWith("/import-export")) return "/import-export";
    if (path.startsWith("/models/refs")) return "/models/refs";
    if (path.startsWith("/models/recognition-configs"))
      return "/models/recognition-configs";
    if (path.startsWith("/models")) return "/models/list";
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

  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    isBillTask
      ? ["bill-group", "bill-models-group", "bill-dataset-group"]
      : [
          "models-group",
          "evaluation-group",
          "training-dataset-group",
          "eval-runs-group",
          "training-group",
        ],
  );

  useEffect(() => {
    if (isBillTask) {
      setOpenKeys((keys) => {
        const billKeys = new Set(
          keys.filter(
            (k) =>
              k === "bill-group" ||
              k === "bill-models-group" ||
              k === "bill-dataset-group",
          ),
        );
        billKeys.add("bill-group");
        if (location.pathname.startsWith("/bill/models")) {
          billKeys.add("bill-models-group");
        }
        if (
          location.pathname.startsWith("/bill/datasets") ||
          location.pathname.startsWith("/bill/data") ||
          location.pathname.startsWith("/bill/evaluation-datasets") ||
          location.pathname.startsWith("/bill/annotations") ||
          location.pathname.startsWith("/bill/dataset-review") ||
          location.pathname.startsWith("/bill/jobs") ||
          location.pathname.startsWith("/bill/evaluation") ||
          location.pathname.startsWith("/bill/versions") ||
          location.pathname.startsWith("/bill/issues")
        ) {
          billKeys.add("bill-dataset-group");
        }
        return Array.from(billKeys);
      });
      return;
    }

    setOpenKeys((keys) => {
      let next = keys.filter(
        (k) =>
          k !== "bill-group" &&
          k !== "bill-dataset-group" &&
          k !== "bill-models-group",
      );
      if (
        location.pathname.startsWith("/models") ||
        location.pathname.startsWith("/releases") ||
        location.pathname.startsWith("/deployments")
      ) {
        next = next.includes("models-group") ? next : [...next, "models-group"];
      }
      if (
        location.pathname.startsWith("/evaluation/datasets") ||
        location.pathname.startsWith("/evaluation/dataset-list") ||
        location.pathname.startsWith("/evaluation/hard-cases")
      ) {
        next = next.includes("evaluation-group")
          ? next
          : [...next, "evaluation-group"];
      }
      if (
        location.pathname.startsWith("/evaluation/training-datasets") ||
        location.pathname.startsWith("/training/curate") ||
        location.pathname.startsWith("/training/augmentation")
      ) {
        next = next.includes("training-dataset-group")
          ? next
          : [...next, "training-dataset-group"];
      }
      if (
        location.pathname.startsWith("/evaluation/runs") ||
        location.pathname.startsWith("/evaluation/comparison")
      ) {
        next = next.includes("eval-runs-group")
          ? next
          : [...next, "eval-runs-group"];
      }
      if (
        location.pathname.startsWith("/training") ||
        location.pathname.startsWith("/training-center")
      ) {
        next = next.includes("training-group")
          ? next
          : [...next, "training-group"];
      }
      return next;
    });
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
