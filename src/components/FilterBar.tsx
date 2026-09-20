import type { StatusFilter } from "../types";

export default function FilterBar({
  value,
  onChange
}: {
  value: StatusFilter[];
  onChange: (value: StatusFilter[]) => void;
}) {
  const items: Array<[StatusFilter, string]> = [
    ["all", "All"],
    ["incorrect", "Incorrect"],
    ["correct", "Correct"],
    ["bookmark", "Bookmark"]
  ];

  const toggle = (id: StatusFilter) => {
    if (id === "all") {
      onChange(["all"]);
      return;
    }

    const next = value.filter((item) => item !== "all");
    if (next.includes(id)) {
      const without = next.filter((item) => item !== id);
      onChange(without.length ? without : ["all"]);
    } else {
      onChange([...next, id]);
    }
  };

  return (
    <div className="flex overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-1">
      {items.map(([id, label]) => {
        const active = value.includes(id) || (id === "all" && value.length === 0);
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={`min-w-fit flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              active ? "bg-slate-800 text-slate-50" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
