import {
  ApiOutlined,
  AuditOutlined,
  AlertOutlined,
  AppstoreOutlined,
  BranchesOutlined,
  ClusterOutlined,
  GlobalOutlined,
  CommentOutlined,
  DatabaseOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  HistoryOutlined,
  InboxOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PlayCircleOutlined,
  PlusCircleOutlined,
  ProfileOutlined,
  ScanOutlined,
  SettingOutlined,
  TagsOutlined,
  ThunderboltOutlined,
  ToolOutlined,
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
  "/evaluation",
  "/training",
  "/training-center",
  "/clients",
  "/history",
  "/jobs",
  "/import-export",
  "/scraper",
  "/databank",
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
              label: (
                <Link to="/bill/models/profiles">Profiles & versions</Link>
              ),
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
        key: "/ocr",
        icon: <ScanOutlined />,
        label: <Link to="/ocr">Live OCR</Link>,
      },
      {
        key: "scraper-group",
        icon: <GlobalOutlined />,
        label: "Scrapper",
        children: [
          {
            key: "/scraper/spyder",
            icon: <ThunderboltOutlined />,
            label: <Link to="/scraper/spyder">Spyder</Link>,
          },
          {
            key: "/scraper/data",
            icon: <DatabaseOutlined />,
            label: <Link to="/scraper/data">Scrape Data</Link>,
          },
          {
            key: "/scraper/categories",
            icon: <TagsOutlined />,
            label: <Link to="/scraper/categories">Categories</Link>,
          },
        ],
      },
      {
        key: "databank-group",
        icon: <DatabaseOutlined />,
        label: "Databank",
        children: [
          {
            key: "/databank/raw",
            icon: <InboxOutlined />,
            label: <Link to="/databank/raw">Raw Data</Link>,
          },
          {
            key: "/databank/label-data",
            icon: <TagsOutlined />,
            label: <Link to="/databank/label-data">Label Data</Link>,
          },
          {
            key: "/databank/datasets",
            icon: <OrderedListOutlined />,
            label: <Link to="/databank/datasets">Datasets</Link>,
          },
        ],
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
        ],
      },
      {
        key: "training-dataset-group",
        icon: <ThunderboltOutlined />,
        label: "Training Center",
        children: [
          {
            key: "/training/new-detector",
            icon: <PlusCircleOutlined />,
            label: (
              <Link to="/training/new-detector">New Detection Model</Link>
            ),
          },
          {
            key: "/training/fine-tune",
            icon: <ToolOutlined />,
            label: (
              <Link to="/training/fine-tune">Fine-tune Model</Link>
            ),
          },
          {
            key: "/training/augmentation",
            icon: <ExperimentOutlined />,
            label: (
              <Link to="/training/augmentation">Data Augmentation</Link>
            ),
          },
          {
            key: "/training/runs",
            icon: <PlayCircleOutlined />,
            label: <Link to="/training/runs">Training Runs</Link>,
          },
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
            label: <Link to="/training/curate">Curate & Label Failures</Link>,
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
          {
            key: "/evaluation/hard-cases",
            icon: <AuditOutlined />,
            label: (
              <Link to="/evaluation/hard-cases">Evaluation Review</Link>
            ),
          },
        ],
      },
      {
        key: "client-group",
        icon: <ApiOutlined />,
        label: "Client",
        children: [
          {
            key: "/clients",
            icon: <ApiOutlined />,
            label: <Link to="/clients">Apis</Link>,
          },
        ],
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
    const search = location.search;
    if (path.startsWith("/ocr")) return "/ocr";
    if (path.startsWith("/settings")) return "/settings";

    if (isBillTask) {
      if (path.startsWith("/bill/models/fields")) return "/bill/models/fields";
      if (path.startsWith("/bill/models/pipeline"))
        return "/bill/models/pipeline";
      if (path.startsWith("/bill/models")) return "/bill/models/profiles";
      if (path.startsWith("/bill/evaluation-datasets"))
        return "/bill/evaluation-datasets";
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
    if (path.startsWith("/evaluation/dataset-list")) {
      const tab = new URLSearchParams(search).get("tab");
      if (tab === "raw") return "/databank/raw";
      return "/databank/label-data";
    }
    if (path.startsWith("/databank/raw")) return "/databank/raw";
    if (path.startsWith("/databank/label-data")) return "/databank/label-data";
    if (
      path.startsWith("/databank/datasets") ||
      path.startsWith("/evaluation/datasets")
    ) {
      return "/databank/datasets";
    }
    if (path.startsWith("/databank")) return "/databank/raw";
    if (path.startsWith("/evaluation")) return "/evaluation/runs";
    if (path.startsWith("/training-center")) return "/training/runs";
    if (path.startsWith("/training/new-detector"))
      return "/training/new-detector";
    if (path.startsWith("/training/fine-tune"))
      return "/training/fine-tune";
    if (path.startsWith("/training/runs")) return "/training/runs";
    if (path.startsWith("/training/augmentation"))
      return "/training/augmentation";
    if (path.startsWith("/training/curate")) return "/training/curate";
    if (path.startsWith("/training")) return "/training/new-detector";
    if (path.startsWith("/scraper/data")) return "/scraper/data";
    if (path.startsWith("/scraper/categories")) return "/scraper/categories";
    if (path.startsWith("/scraper/spyder") || path.startsWith("/scraper"))
      return "/scraper/spyder";
    return path;
  }, [location.pathname, location.search, isBillTask]);

  const sidebarGroupKeys = isBillTask
    ? ["bill-group", "bill-models-group", "bill-dataset-group"]
    : [
        "models-group",
        "databank-group",
        "training-dataset-group",
        "eval-runs-group",
        "scraper-group",
        "client-group",
      ];
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    if (isBillTask) {
      if (location.pathname.startsWith("/bill/models")) {
        setOpenKeys(["bill-models-group"]);
      } else if (
        location.pathname.startsWith("/bill/datasets") ||
        location.pathname.startsWith("/bill/evaluation-datasets") ||
        location.pathname.startsWith("/bill/annotations") ||
        location.pathname.startsWith("/bill/dataset-review") ||
        location.pathname.startsWith("/bill/jobs") ||
        location.pathname.startsWith("/bill/evaluation") ||
        location.pathname.startsWith("/bill/versions") ||
        location.pathname.startsWith("/bill/issues")
      ) {
        setOpenKeys(["bill-dataset-group"]);
      } else if (location.pathname.startsWith("/bill")) {
        setOpenKeys(["bill-group"]);
      } else {
        setOpenKeys([]);
      }
      return;
    }

    if (
      location.pathname.startsWith("/models") ||
      location.pathname.startsWith("/releases") ||
      location.pathname.startsWith("/deployments")
    ) {
      setOpenKeys(["models-group"]);
    } else if (location.pathname.startsWith("/clients")) {
      setOpenKeys(["client-group"]);
    } else if (
      location.pathname.startsWith("/evaluation/training-datasets") ||
      location.pathname.startsWith("/training") ||
      location.pathname.startsWith("/training-center")
    ) {
      setOpenKeys(["training-dataset-group"]);
    } else if (
      location.pathname.startsWith("/evaluation/runs") ||
      location.pathname.startsWith("/evaluation/comparison") ||
      location.pathname.startsWith("/evaluation/hard-cases")
    ) {
      setOpenKeys(["eval-runs-group"]);
    } else if (location.pathname.startsWith("/scraper")) {
      setOpenKeys(["scraper-group"]);
    } else if (
      location.pathname.startsWith("/databank") ||
      location.pathname.startsWith("/evaluation/datasets")
    ) {
      setOpenKeys(["databank-group"]);
    } else {
      setOpenKeys([]);
    }
  }, [location.pathname, isBillTask]);

  const handleOpenChange = (keys: string[]) => {
    const newlyOpenedGroup = keys.find(
      (key) => sidebarGroupKeys.includes(key) && !openKeys.includes(key),
    );
    setOpenKeys(newlyOpenedGroup ? [newlyOpenedGroup] : []);
  };

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
        onOpenChange={handleOpenChange}
        onClick={({ key, domEvent }) => {
          const target = (domEvent as React.MouseEvent)?.target as HTMLElement | undefined;
          if (target?.closest("a")) {
            return;
          }
          if (key && typeof key === "string" && key.startsWith("/")) {
            navigate(key);
          }
        }}
        items={navItems}
        className="!border-none !bg-transparent pt-2"
      />
    </Sider>
  );
}
