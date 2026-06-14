import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

export default function SearchBar() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 focus-within:border-[var(--color-accent)]"
    >
      <Search className="size-3.5 text-zinc-500" />
      <input
        data-search-input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search all news…  /"
        className="w-44 bg-transparent text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none lg:w-56"
        spellCheck={false}
      />
    </form>
  );
}
