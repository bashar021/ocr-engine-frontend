import type { ReactNode } from "react";
import { Breadcrumb } from "antd";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  title: string;
  path?: string;
}

interface PageHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  actions?: ReactNode;
}

export function PageHeader({ breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
      <Breadcrumb
        items={breadcrumbs.map((item) => ({
          title: item.path ? (
            <Link to={item.path}>{item.title}</Link>
          ) : (
            item.title
          ),
        }))}
      />
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}
