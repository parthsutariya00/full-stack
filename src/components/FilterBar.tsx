"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, STATUS_ORDER } from "@/lib/labels";
import { TASK_SORT_KEYS } from "@/lib/types";
import type { TaskFilters, TaskSortKey } from "@/lib/types";

type FilterBarProps = {
  projectId: string;
  filters: TaskFilters;
  resultCount: number;
};

const SORT_LABEL: Record<TaskSortKey, string> = {
  created: "Newest first",
  due: "Due date",
  priority: "Priority",
  title: "Title A→Z",
};

function buildQuery(filters: TaskFilters): string {
  const params = new URLSearchParams();

  if (filters.status !== "ALL") {
    params.set("status", filters.status);
  }
  if (filters.priority !== "ALL") {
    params.set("priority", filters.priority);
  }
  if (filters.search.length > 0) {
    params.set("search", filters.search);
  }
  if (filters.sort !== "created") {
    params.set("sort", filters.sort);
  }

  return params.toString();
}

export function FilterBar({ projectId, filters, resultCount }: FilterBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState<string>(filters.search);

  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  function push(next: TaskFilters): void {
    const query = buildQuery(next);
    startTransition(() => {
      router.push(query.length > 0 ? `/projects/${projectId}?${query}` : `/projects/${projectId}`);
    });
  }

  // Debounce the free-text search so every keystroke is not a round trip.
  useEffect(() => {
    if (search === filters.search) {
      return;
    }
    const timer = window.setTimeout(() => {
      push({ ...filters, search });
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const isFiltered =
    filters.status !== "ALL" ||
    filters.priority !== "ALL" ||
    filters.search.length > 0 ||
    filters.sort !== "created";

  return (
    <div className="card space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="filter-search">
            Search
          </label>
          <input
            id="filter-search"
            className="field"
            value={search}
            placeholder="Title or details…"
            maxLength={120}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="filter-status">
            Status
          </label>
          <select
            id="filter-status"
            className="field"
            value={filters.status}
            onChange={(event) => {
              const value = event.target.value;
              push({
                ...filters,
                status: STATUS_ORDER.find((status) => status === value) ?? "ALL",
              });
            }}
          >
            <option value="ALL">All statuses</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="filter-priority">
            Priority
          </label>
          <select
            id="filter-priority"
            className="field"
            value={filters.priority}
            onChange={(event) => {
              const value = event.target.value;
              push({
                ...filters,
                priority: PRIORITY_ORDER.find((priority) => priority === value) ?? "ALL",
              });
            }}
          >
            <option value="ALL">All priorities</option>
            {PRIORITY_ORDER.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="filter-sort">
            Sort
          </label>
          <select
            id="filter-sort"
            className="field"
            value={filters.sort}
            onChange={(event) => {
              const value = event.target.value;
              push({
                ...filters,
                sort: TASK_SORT_KEYS.find((key) => key === value) ?? "created",
              });
            }}
          >
            {TASK_SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {SORT_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {isPending ? "Updating…" : `${resultCount} task${resultCount === 1 ? "" : "s"} shown`}
        </span>
        {isFiltered ? (
          <button
            type="button"
            className="text-indigo-400 hover:text-indigo-300"
            onClick={() =>
              push({ status: "ALL", priority: "ALL", search: "", sort: "created" })
            }
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
