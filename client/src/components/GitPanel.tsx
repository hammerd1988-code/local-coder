import * as React from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";

interface GitBranch {
  id: number;
  name: string;
  is_current: number;
  last_commit: string | null;
}

interface GitStatus {
  files: Array<{ path: string; working_dir: string; index: string }>;
  current: string;
  tracking: string | null;
  ahead: number;
  behind: number;
}

export default function GitPanel() {
  const [branches, setBranches] = React.useState<GitBranch[]>([]);
  const [status, setStatus] = React.useState<GitStatus | null>(null);
  const [newBranchName, setNewBranchName] = React.useState("");
  const [commitMessage, setCommitMessage] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadGitData();
  }, []);

  async function loadGitData() {
    try {
      const [branchesRes, statusRes] = await Promise.all([
        fetch("/api/git/branches"),
        fetch("/api/git/status")
      ]);
      
      const branchesData = await branchesRes.json();
      const statusData = await statusRes.json();
      
      setBranches(branchesData);
      setStatus(statusData);
    } catch (error) {
      console.error("Error loading git data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function createBranch() {
    if (!newBranchName.trim()) return;
    
    try {
      await fetch("/api/git/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBranchName })
      });
      
      setNewBranchName("");
      loadGitData();
    } catch (error) {
      console.error("Error creating branch:", error);
    }
  }

  async function switchBranch(branch: string) {
    try {
      await fetch("/api/git/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch })
      });
      
      loadGitData();
    } catch (error) {
      console.error("Error switching branch:", error);
    }
  }

  async function commit() {
    if (!commitMessage.trim()) return;
    
    try {
      await fetch("/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: commitMessage })
      });
      
      setCommitMessage("");
      loadGitData();
    } catch (error) {
      console.error("Error committing:", error);
    }
  }

  async function initRepo() {
    try {
      await fetch("/api/git/init", { method: "POST" });
      loadGitData();
    } catch (error) {
      console.error("Error initializing repo:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black/40">
        <div className="text-cyan-400 animate-pulse">Loading git data...</div>
      </div>
    );
  }

  const currentBranch = branches.find(b => b.is_current === 1);

  return (
    <div className="h-full flex flex-col bg-black/40 backdrop-blur-sm border-l border-cyan-500/30">
      <div className="p-4 border-b border-cyan-500/30">
        <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          GIT CONTROL
        </h2>
      </div>
      
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Current Branch */}
        <Card className="p-3 bg-gray-950/80 border-cyan-500/30">
          <div className="text-xs text-purple-400 mb-1">CURRENT BRANCH</div>
          <div className="text-cyan-300 font-mono font-bold">
            {currentBranch?.name || "No branch"}
          </div>
        </Card>

        {/* Status */}
        {status && (
          <Card className="p-3 bg-gray-950/80 border-cyan-500/30">
            <div className="text-xs text-purple-400 mb-2">CHANGES</div>
            <div className="space-y-1">
              {status.files.length === 0 ? (
                <div className="text-gray-500 text-sm">No changes</div>
              ) : (
                status.files.slice(0, 5).map((file, i) => (
                  <div key={i} className="text-xs font-mono text-cyan-300 truncate">
                    {file.working_dir} {file.path}
                  </div>
                ))
              )}
              {status.files.length > 5 && (
                <div className="text-xs text-purple-400">
                  +{status.files.length - 5} more...
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Commit */}
        <div className="space-y-2">
          <Input
            placeholder="Commit message..."
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            className="bg-gray-950/80 border-cyan-500/30 text-cyan-300 placeholder:text-gray-600"
            onKeyDown={(e) => e.key === "Enter" && commit()}
          />
          <Button
            onClick={commit}
            disabled={!commitMessage.trim() || !status?.files.length}
            className="w-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30"
          >
            COMMIT
          </Button>
        </div>

        {/* Branches */}
        <div className="space-y-2">
          <div className="text-xs text-purple-400 font-bold">BRANCHES</div>
          <div className="space-y-1 max-h-40 overflow-auto">
            {branches.map((branch) => (
              <Button
                key={branch.id}
                onClick={() => switchBranch(branch.name)}
                variant="ghost"
                className={`w-full justify-start text-xs font-mono ${
                  branch.is_current 
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50" 
                    : "text-gray-400 hover:text-cyan-400"
                }`}
              >
                {branch.is_current ? "★ " : "  "}{branch.name}
              </Button>
            ))}
          </div>
        </div>

        {/* New Branch */}
        <div className="space-y-2">
          <Input
            placeholder="New branch name..."
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            className="bg-gray-950/80 border-cyan-500/30 text-cyan-300 placeholder:text-gray-600"
            onKeyDown={(e) => e.key === "Enter" && createBranch()}
          />
          <Button
            onClick={createBranch}
            disabled={!newBranchName.trim()}
            className="w-full bg-purple-500/20 border border-purple-500/50 text-purple-400 hover:bg-purple-500/30"
          >
            CREATE BRANCH
          </Button>
        </div>

        {branches.length === 0 && (
          <Button
            onClick={initRepo}
            className="w-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30"
          >
            INIT REPOSITORY
          </Button>
        )}
      </div>
    </div>
  );
}
