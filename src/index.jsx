/**
 * CANVAS - Index Factory
 * Standard Datacore View Factory with Safe Agent recovery.
 */
async function View({ folderPath, dc, ...props }) {
  const Agent = {
    timer: null,
    start: (fPath, onReload) => {
      const cmdFile = fPath + "/data/mcp_commands.json";
      Agent.timer = setInterval(async () => {
        try {
          const adapter = dc.app.vault.adapter;
          if (!(await adapter.exists(cmdFile))) return;
          const content = await adapter.read(cmdFile);
          const cmd = JSON.parse(content);
          if (cmd && cmd.executed === false && cmd.action === "reload") {
            cmd.executed = true;
            cmd.executedAt = new Date().toISOString();
            await adapter.write(cmdFile, JSON.stringify(cmd, null, 2));
            onReload();
          }
        } catch (e) {}
      }, 1000);
      return () => clearInterval(Agent.timer);
    }
  };

  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
      console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    }
    render() {
      if (this.state.hasError) {
        return (
          <div style={{ color: "red", padding: "40px", background: "var(--background-primary)", height: "100vh", overflow: "auto" }}>
            <h2 style={{ color: "var(--text-error)" }}>Render Error</h2>
            <pre style={{ fontSize: "12px", color: "var(--text-error-alt)" }}>{this.state.error?.stack || this.state.error?.message}</pre>
          </div>
        );
      }
      return this.props.children;
    }
  }

  const SafeRoot = () => {
    const [modules, setModules] = dc.useState(null);
    const [error, setError] = dc.useState(null);
    const [key, setKey] = dc.useState(0);

    dc.useEffect(() => {
      return Agent.start(folderPath, () => {
        if (dc.app.workspace.activeLeaf?.rebuildView) {
          dc.app.workspace.activeLeaf.rebuildView();
        } else {
          setKey((k) => k + 1);
        }
      });
    }, []);

    dc.useEffect(() => {
      const load = async () => {
        try {
          const base = folderPath;
          const [app] = await Promise.all([
            dc.require(base + "/src/App.jsx")
          ]);
          setModules({
            InfiniteCanvas: app.InfiniteCanvas
          });
        } catch (e) {
          setError(e);
        }
      };
      load();
    }, [key]);

    if (error) {
      return (
        <div style={{ color: "red", padding: "40px", background: "var(--background-primary)", height: "100vh" }}>
          <h2 style={{ color: "var(--text-error)" }}>Critical Load Error</h2>
          <pre style={{ fontSize: "12px", color: "var(--text-error-alt)" }}>{error.stack}</pre>
        </div>
      );
    }
    if (!modules) {
      return (
        <div style={{ padding: "40px", background: "var(--background-primary)", color: "var(--text-muted)", height: "100vh", fontFamily: "monospace" }}>
          Initializing Canvas Workspace...
        </div>
      );
    }

    const { InfiniteCanvas: MainApp } = modules;
    return (
      <div id="datacore-component-root" style={{ width: "100%", height: "100%" }}>
        <ErrorBoundary>
          <MainApp folderPath={folderPath} dc={dc} saveState="ShowcaseCanvas" {...props} />
        </ErrorBoundary>
      </div>
    );
  };

  return <SafeRoot />;
}

return { View };
