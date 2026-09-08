import type { ReactNode } from "react";
import { Breadcrumb, Typography } from "antd";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  title: string;
  path?: string;
}

interface PageHeaderProps {
  /** Optional breadcrumbs. Prefer these for deep pages. */
  breadcrumbs?: BreadcrumbItem[];
  /** Page title — shown when provided. */
  title?: string;
  /** Short supporting description under the title. */
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
}: PageHeaderProps) {
  const hasCrumbs = Boolean(breadcrumbs && breadcrumbs.length > 0);

  return (
    <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
      <div className="min-w-0 space-y-1">
        {hasCrumbs ? (
          <Breadcrumb
            items={(breadcrumbs ?? []).map((item) => ({
              title: item.path ? (
                <Link to={item.path}>{item.title}</Link>
              ) : (
                item.title
              ),
            }))}
          />
        ) : null}
        {title ? (
          <Typography.Title level={4} className="!mb-0 !mt-0">
            {title}
          </Typography.Title>
        ) : null}
        {description ? (
          <Typography.Paragraph type="secondary" className="!mb-0">
            {description}
          </Typography.Paragraph>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
