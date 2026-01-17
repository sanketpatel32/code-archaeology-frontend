"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { useAnalysisState } from "@/lib/useAnalysisState";

type FileData = { file_path: string };

type TreeNode = {
    name: string;
    path: string;
    isFolder: boolean;
    children: TreeNode[];
    extension?: string;
};

function buildTree(files: FileData[]): TreeNode {
    const root: TreeNode = { name: "root", path: "", isFolder: true, children: [] };

    for (const file of files) {
        const parts = file.file_path.split("/").filter(Boolean);
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            const currentPath = parts.slice(0, i + 1).join("/");

            let child = current.children.find((c) => c.name === part);
            if (!child) {
                const ext = isLast ? part.split(".").pop()?.toLowerCase() : undefined;
                child = { name: part, path: currentPath, isFolder: !isLast, children: [], extension: ext };
                current.children.push(child);
            }
            if (isLast) child.isFolder = false;
            current = child;
        }
    }

    const sortTree = (node: TreeNode): void => {
        node.children.sort((a, b) => {
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;
            return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortTree);
    };
    sortTree(root);
    return root;
}

const FILE_COLORS: Record<string, string> = {
    ts: "#3178c6", tsx: "#61dafb", js: "#f7df1e", jsx: "#61dafb",
    json: "#f5a623", md: "#083fa1", css: "#264de4", scss: "#cc6699",
    html: "#e34c26", py: "#3776ab", go: "#00add8", rs: "#dea584",
    java: "#ed8b00", yml: "#cb171e", yaml: "#cb171e", sql: "#f29111",
    sh: "#4eaa25", svg: "#ffb13b", png: "#a855f7", jpg: "#a855f7",
    gitignore: "#f14e32", lock: "#888", env: "#ecd53f", info: "#6b7280",
};

function getFileColor(ext?: string): string {
    return FILE_COLORS[ext ?? ""] ?? "#94a3b8";
}

function TreeItem({
    node,
    depth,
    expanded,
    onToggle,
    isLast,
    prefix,
}: {
    node: TreeNode;
    depth: number;
    expanded: Set<string>;
    onToggle: (path: string) => void;
    isLast: boolean;
    prefix: string;
}) {
    const isExpanded = expanded.has(node.path);
    const color = getFileColor(node.extension);

    // Build the prefix for this line
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = prefix + (isLast ? "    " : "│   ");

    return (
        <>
            <div className="flex items-center py-0.5 hover:bg-white/5 rounded transition-colors group">
                <span className="text-[color:var(--border)] select-none whitespace-pre font-mono text-sm">
                    {prefix}{connector}
                </span>

                {node.isFolder ? (
                    <button
                        type="button"
                        onClick={() => onToggle(node.path)}
                        className="flex items-center gap-1.5 hover:text-[color:var(--accent)] transition-colors"
                    >
                        <span className="text-base">{isExpanded ? "📂" : "📁"}</span>
                        <span className="text-[color:var(--foreground)] font-medium">{node.name}</span>
                        <span className="text-[10px] text-[color:var(--muted)] bg-[color:var(--panel-soft)] px-1.5 py-0.5 rounded-full ml-1">
                            {node.children.length}
                        </span>
                    </button>
                ) : (
                    <div className="flex items-center gap-2">
                        <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
                        />
                        <span className="text-[color:var(--muted)] group-hover:text-[color:var(--foreground)] transition-colors">
                            {node.name.replace(`.${node.extension}`, '')}
                        </span>
                        {node.extension && (
                            <span className="text-xs" style={{ color }}>
                                .{node.extension}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {node.isFolder && isExpanded && node.children.map((child, index) => (
                <TreeItem
                    key={child.path}
                    node={child}
                    depth={depth + 1}
                    expanded={expanded}
                    onToggle={onToggle}
                    isLast={index === node.children.length - 1}
                    prefix={childPrefix}
                />
            ))}
        </>
    );
}

export default function StructurePage() {
    const { state } = useAnalysisState();
    const [files, setFiles] = useState<FileData[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!state.repoId) return;
        setLoading(true);
        apiGet<FileData[]>(`/api/repositories/${state.repoId}/hotspots?limit=1000`)
            .then((data) => {
                setFiles(data);
                const firstLevel = new Set<string>();
                for (const file of data) {
                    const parts = file.file_path.split("/");
                    if (parts.length > 1) firstLevel.add(parts[0]);
                }
                setExpanded(firstLevel);
            })
            .catch(() => setFiles([]))
            .finally(() => setLoading(false));
    }, [state.repoId]);

    const tree = useMemo(() => buildTree(files), [files]);

    const filteredTree = useMemo(() => {
        if (!search.trim()) return tree;
        const query = search.toLowerCase();

        const filterNode = (node: TreeNode): TreeNode | null => {
            if (!node.isFolder) {
                return node.name.toLowerCase().includes(query) ? node : null;
            }
            const filteredChildren = node.children.map(filterNode).filter(Boolean) as TreeNode[];
            if (filteredChildren.length > 0) return { ...node, children: filteredChildren };
            return node.name.toLowerCase().includes(query) ? { ...node, children: [] } : null;
        };

        return filterNode(tree) ?? { ...tree, children: [] };
    }, [tree, search]);

    const handleToggle = useCallback((path: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(path) ? next.delete(path) : next.add(path);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        const allPaths = new Set<string>();
        const collect = (node: TreeNode) => {
            if (node.isFolder && node.path) allPaths.add(node.path);
            node.children.forEach(collect);
        };
        collect(tree);
        setExpanded(allPaths);
    }, [tree]);

    const stats = useMemo(() => {
        let folderCount = 0;
        const count = (node: TreeNode) => {
            if (node.isFolder && node.path) folderCount++;
            node.children.forEach(count);
        };
        count(tree);
        return { folderCount, fileCount: files.length };
    }, [tree, files.length]);

    if (!state.repoId) {
        return (
            <section className="soft-panel rounded-3xl p-8">
                <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">Folder structure</h2>
                <p className="mt-3 text-sm text-[color:var(--muted)]">
                    Run an analysis to explore the folder structure.
                </p>
                <Link
                    href="/"
                    className="mt-6 inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
                >
                    Start analysis
                </Link>
            </section>
        );
    }

    return (
        <>
            <header className="reveal flex flex-col gap-2">
                <h1 className="text-3xl font-semibold text-[color:var(--foreground)]">Folder structure</h1>
                <p className="text-sm text-[color:var(--muted)]">
                    {stats.folderCount} folders · {stats.fileCount} files
                </p>
            </header>

            <section className="soft-panel reveal rounded-2xl p-5">
                <div className="mb-5 flex flex-wrap items-center gap-3">
                    <input
                        type="text"
                        className="input-field flex-1 rounded-full px-4 py-2 text-sm outline-none"
                        placeholder="Search files and folders..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button type="button" className="toggle-button" onClick={expandAll}>
                        Expand all
                    </button>
                    <button type="button" className="toggle-button" onClick={() => setExpanded(new Set())}>
                        Collapse
                    </button>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-sm text-[color:var(--muted)]">Loading...</div>
                ) : filteredTree.children.length === 0 ? (
                    <div className="py-12 text-center text-sm text-[color:var(--muted)]">
                        {search ? "No matches found" : "No files found"}
                    </div>
                ) : (
                    <div className="max-h-[70vh] overflow-auto font-mono text-sm">
                        {filteredTree.children.map((child, index) => (
                            <TreeItem
                                key={child.path}
                                node={child}
                                depth={0}
                                expanded={expanded}
                                onToggle={handleToggle}
                                isLast={index === filteredTree.children.length - 1}
                                prefix=""
                            />
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}
