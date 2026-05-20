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

    // Inject status-bar/view-footer suppression stylesheet
    dc.useEffect(() => {
      let styleEl = document.getElementById("immersive-status-bar-suppression");
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "immersive-status-bar-suppression";
        styleEl.textContent = `
          .status-bar, 
          .view-footer, 
          .workspace-leaf-content-footer { 
            display: none !important; 
          }
        `;
        document.head.appendChild(styleEl);
      }
      return () => {
        const el = document.getElementById("immersive-status-bar-suppression");
        if (el) el.remove();
      };
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
      const errMsg = error?.stack || error?.message || (typeof error === "string" ? error : JSON.stringify(error, null, 2));
      return (
        <div style={{ color: "red", padding: "40px", background: "var(--background-primary)", height: "100vh" }}>
          <h2 style={{ color: "var(--text-error)" }}>Critical Load Error</h2>
          <pre style={{ fontSize: "12px", color: "var(--text-error-alt)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{errMsg}</pre>
        </div>
      );
    }
    if (!modules) {
      return (
        <div style={{ padding: "40px", background: "var(--background-primary)", color: "var(--text-muted)", height: "100vh", fontFamily: "monospace" }}>
          Initializing Canvas...
        </div>
      );
    }

    const { InfiniteCanvas: MainApp } = modules;
    return (
      <div id="datacore-component-root" style={{ width: "100%", height: "100%" }}>
        <MainApp folderPath={folderPath} dc={dc} {...props} />
      </div>
    );
  };

  return <SafeRoot />;
}

return { View };
