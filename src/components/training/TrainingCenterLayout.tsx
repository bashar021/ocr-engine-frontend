import { Tabs } from "antd";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";

const TAB_ITEMS = [
  { key: "/training-center", label: "Overview" },
  { key: "/training-center/detection", label: "Detection" },
  { key: "/training-center/recognition", label: "Recognition" },
  { key: "/training-center/experiments", label: "Experiments" },
  { key: "/training-center/datasets", label: "Datasets" },
  { key: "/training-center/evaluations", label: "Evaluations" },
  { key: "/training-center/models", label: "Models" },
  { key: "/training-center/cycles", label: "Cycles" },
];

export function TrainingCenterLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const active = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/training-center/cycles"))
      return "/training-center/cycles";
    const match = TAB_ITEMS.find((t) => t.key === path);
    return match?.key ?? "/training-center";
  }, [location.pathname]);

  return (
    <div className="space-y-4">
      <Tabs
        activeKey={active}
        onChange={(key) => navigate(key)}
        items={TAB_ITEMS.map((t) => ({
          key: t.key,
          label: <Link to={t.key}>{t.label}</Link>,
        }))}
      />
      <Outlet />
    </div>
  );
}
