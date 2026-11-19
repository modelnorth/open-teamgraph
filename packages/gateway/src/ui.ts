export function getExplorerHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Open TeamGraph — Sovereign Intelligence Canvas | ModelNorth</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js"></script>
  <style>
    :root {
      --bg-base: #06080e;
      --bg-surface: rgba(13, 17, 28, 0.78);
      --bg-card: rgba(255, 255, 255, 0.025);
      --bg-card-hover: rgba(255, 255, 255, 0.05);
      --border-subtle: rgba(255, 255, 255, 0.07);
      --border-focus: rgba(56, 189, 248, 0.4);
      --text-main: #f8fafc;
      --text-secondary: #94a3b8;
      --text-tertiary: #64748b;
      
      --cyan: #00f5d4;
      --blue: #38bdf8;
      --indigo: #6366f1;
      --purple: #a855f7;
      --amber: #f59e0b;
      --emerald: #10b981;
      --rose: #f43f5e;
      --pink: #ec4899;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-base);
      color: var(--text-main);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      user-select: none;
    }

    /* Ambient Cybernetic Grid */
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: 
        radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.04) 0%, transparent 60%),
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 100% 100%, 48px 48px, 48px 48px;
      pointer-events: none;
      z-index: 0;
    }

    /* Master Header */
    header {
      height: 64px;
      background: var(--bg-surface);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border-subtle);
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 20;
    }

    .brand-cluster {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-mark {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #00f5d4 0%, #6366f1 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 20px rgba(0, 245, 212, 0.35);
      position: relative;
    }

    .brand-mark svg {
      width: 18px;
      height: 18px;
      stroke: #06080e;
      stroke-width: 2.2;
      fill: none;
    }

    .brand-text h1 {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.4px;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pill-org {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 600;
      background: rgba(99, 102, 241, 0.12);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
      padding: 2px 7px;
      border-radius: 99px;
      letter-spacing: 0.5px;
    }

    /* Global Search Omnibar */
    .search-box {
      position: relative;
      width: 320px;
    }

    .search-input {
      width: 100%;
      height: 36px;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 0 12px 0 34px;
      font-size: 12px;
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', sans-serif;
      outline: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .search-input:focus {
      border-color: var(--cyan);
      box-shadow: 0 0 16px rgba(0, 245, 212, 0.15);
      background: rgba(0, 0, 0, 0.5);
    }

    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      stroke: var(--text-tertiary);
      pointer-events: none;
    }

    .search-shortcut {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-tertiary);
      padding: 2px 5px;
      border-radius: 4px;
      pointer-events: none;
    }

    /* Telemetry & Action HUD */
    .hud-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .telemetry-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-secondary);
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-subtle);
      padding: 5px 12px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .telemetry-tag strong {
      color: var(--text-main);
    }

    .live-dot {
      width: 6px;
      height: 6px;
      background: var(--cyan);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--cyan);
      animation: pulse 2s infinite ease-in-out;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }

    .btn-action {
      height: 36px;
      padding: 0 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      border: none;
      outline: none;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--cyan) 0%, #38bdf8 100%);
      color: #06080e;
      box-shadow: 0 2px 10px rgba(0, 245, 212, 0.25);
    }

    .btn-primary:hover {
      box-shadow: 0 4px 18px rgba(0, 245, 212, 0.45);
      transform: translateY(-1px);
    }

    .btn-subtle {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-main);
      border: 1px solid var(--border-subtle);
    }

    .btn-subtle:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.15);
    }

    /* Main Workspace Layout */
    .workspace {
      flex: 1;
      display: flex;
      position: relative;
      overflow: hidden;
    }

    #cy {
      flex: 1;
      height: 100%;
      z-index: 1;
    }

    /* Entity Filter Floating Dock */
    .filter-dock {
      position: absolute;
      top: 18px;
      left: 20px;
      background: var(--bg-surface);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      z-index: 10;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }

    .dock-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-tertiary);
      padding: 0 6px;
      font-family: 'JetBrains Mono', monospace;
    }

    .pill-filter {
      font-size: 11px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid transparent;
      color: var(--text-secondary);
      transition: all 0.15s ease;
    }

    .pill-filter.active {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-main);
      border-color: var(--border-subtle);
    }

    .pill-filter:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .pill-filter .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }

    /* Layout Switcher & View Controls */
    .view-controls {
      position: absolute;
      bottom: 24px;
      left: 20px;
      background: var(--bg-surface);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 4px;
      display: flex;
      gap: 4px;
      z-index: 10;
    }

    .view-btn {
      background: transparent;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: 'JetBrains Mono', monospace;
    }

    .view-btn.active, .view-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-main);
    }

    /* Inspector & Audit Sidebar */
    .inspector-panel {
      width: 420px;
      background: var(--bg-surface);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-left: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      z-index: 15;
      box-shadow: -10px 0 40px rgba(0, 0, 0, 0.4);
    }

    .tab-bar {
      display: flex;
      border-bottom: 1px solid var(--border-subtle);
      padding: 0 16px;
    }

    .tab-item {
      padding: 16px 14px;
      font-size: 12px;
      font-weight: 700;
      color: var(--text-tertiary);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tab-item.active {
      color: var(--cyan);
      border-bottom-color: var(--cyan);
    }

    .tab-content {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    /* Bento Cards */
    .bento-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 14px;
      transition: all 0.2s ease;
    }

    .bento-card:hover {
      background: var(--bg-card-hover);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .bento-header {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-tertiary);
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .bento-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-main);
      word-break: break-all;
      line-height: 1.4;
    }

    .urn-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: var(--text-secondary);
      background: rgba(0, 0, 0, 0.4);
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      word-break: break-all;
      margin-top: 6px;
      display: block;
    }

    .property-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 10px;
    }

    .prop-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }

    .prop-item:last-child { border-bottom: none; }
    .prop-k { color: var(--text-tertiary); }
    .prop-v { font-family: 'JetBrains Mono', monospace; color: var(--cyan); font-weight: 500; }

    /* Reviewer Score Bar */
    .reviewer-tile {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
    }

    .reviewer-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 700;
    }

    .score-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--cyan);
      background: rgba(0, 245, 212, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(0, 245, 212, 0.25);
    }

    .progress-track {
      height: 6px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 3px;
      margin: 8px 0 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #00f5d4, #6366f1);
      border-radius: 3px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-tertiary);
      font-size: 13px;
      line-height: 1.6;
    }

    .empty-icon {
      width: 40px;
      height: 40px;
      stroke: var(--text-tertiary);
      margin-bottom: 16px;
      opacity: 0.5;
    }

    /* Focus Mode Halo Overlay */
    .focus-tip {
      position: absolute;
      top: 18px;
      right: 440px;
      background: rgba(13, 17, 28, 0.85);
      border: 1px solid var(--border-subtle);
      backdrop-filter: blur(12px);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      color: var(--text-secondary);
      pointer-events: none;
      z-index: 10;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>

  <!-- Master Header -->
  <header>
    <div class="brand-cluster">
      <div class="brand-mark">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><line x1="7" y1="7" x2="10" y2="10"/><line x1="17" y1="7" x2="14" y2="10"/><line x1="7" y1="17" x2="10" y2="14"/><line x1="17" y1="17" x2="14" y2="14"/></svg>
      </div>
      <div class="brand-text">
        <h1>Open TeamGraph <span class="pill-org">ModelNorth</span></h1>
      </div>
    </div>

    <!-- Search Omnibar -->
    <div class="search-box">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="omni-search" class="search-input" placeholder="Search people, services, PRs, files..." oninput="handleSearch(this.value)">
      <span class="search-shortcut">/</span>
    </div>

    <!-- Actions & Stats -->
    <div class="hud-actions">
      <div class="telemetry-tag">
        <div class="live-dot"></div>
        <span>GRAPH: <strong id="stat-nodes">0</strong> NODES &middot; <strong id="stat-edges">0</strong> EDGES</span>
      </div>
      <button class="btn-action btn-subtle" onclick="seedDemo()">🌱 Seed Realistic Events</button>
      <button class="btn-action btn-primary" onclick="loadGraph()">
        <svg style="width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2.5;" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Sync Graph
      </button>
    </div>
  </header>

  <!-- Workspace & Canvas -->
  <div class="workspace">
    <div class="focus-tip" id="focus-tip" style="display: none;">🎯 Focus Mode Active &middot; Click canvas background to reset</div>

    <!-- Top Entity Toggle Filter Dock -->
    <div class="filter-dock">
      <span class="dock-label">Filters</span>
      <div class="pill-filter active" onclick="toggleFilter('Person', this)"><div class="dot" style="background: #00f5d4;"></div>People</div>
      <div class="pill-filter active" onclick="toggleFilter('Service', this)"><div class="dot" style="background: #a855f7;"></div>Services</div>
      <div class="pill-filter active" onclick="toggleFilter('Team', this)"><div class="dot" style="background: #f59e0b;"></div>Teams</div>
      <div class="pill-filter active" onclick="toggleFilter('Task', this)"><div class="dot" style="background: #10b981;"></div>Tasks</div>
      <div class="pill-filter active" onclick="toggleFilter('PullRequest', this)"><div class="dot" style="background: #f43f5e;"></div>PRs</div>
      <div class="pill-filter active" onclick="toggleFilter('Message', this)"><div class="dot" style="background: #ec4899;"></div>Slack</div>
      <div class="pill-filter" id="filter-files-pill" onclick="toggleFilter('File', this)"><div class="dot" style="background: #64748b;"></div>Files (Compact)</div>
    </div>

    <!-- View Layout Controls -->
    <div class="view-controls">
      <button class="view-btn active" onclick="switchLayout('cose', this)">Organic</button>
      <button class="view-btn" onclick="switchLayout('concentric', this)">Concentric</button>
      <button class="view-btn" onclick="switchLayout('breadthfirst', this)">Hierarchical</button>
      <button class="view-btn" onclick="fitView()">Fit Screen</button>
    </div>

    <div id="cy"></div>

    <!-- Inspector & Audit Sidebar -->
    <aside class="inspector-panel">
      <div class="tab-bar">
        <div class="tab-item active" onclick="switchTab('inspector', this)">Node Inspector</div>
        <div class="tab-item" onclick="switchTab('audit', this)">Autonomous PR Audit</div>
      </div>

      <!-- Tab 1: Node Inspector -->
      <div id="tab-inspector" class="tab-content active">
        <div id="inspector-body">
          <div class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <p><strong>Click any node</strong> on the canvas to inspect real-time bi-temporal metadata, properties, and upstream/downstream relationships.</p>
          </div>
        </div>
      </div>

      <!-- Tab 2: Autonomous PR Audit -->
      <div id="tab-audit" class="tab-content">
        <div class="bento-card" style="background: rgba(0,0,0,0.4);">
          <div class="bento-header"><span>Target Codebase Path</span><span>RECENCY-DECAY AUDIT</span></div>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="audit-input" class="search-input" value="src/auth/jwt.ts" style="font-family: 'JetBrains Mono', monospace;">
            <button class="btn-action btn-primary" onclick="executeAudit()">Analyze</button>
          </div>
        </div>

        <div id="audit-body">
          <div class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <p>Calculate exact recency-decay expertise ($w = e^{-\\lambda \\Delta t}$) and multi-hop blast radius for any file or microservice.</p>
          </div>
        </div>
      </div>
    </aside>
  </div>

  <script>
    let cy = null;
    let rawNodes = [];
    let rawEdges = [];
    let activeFilters = new Set(["Person", "Service", "Team", "Task", "PullRequest", "Message"]); // Files hidden by default to eliminate hairball!
    let currentLayout = 'cose';

    function getNodeColor(type) {
      switch (type) {
        case "Person": return "#00f5d4";
        case "Service": return "#a855f7";
        case "Team": return "#f59e0b";
        case "Task": return "#10b981";
        case "PullRequest": return "#f43f5e";
        case "Message": return "#ec4899";
        case "Commit": return "#475569";
        case "File": return "#64748b";
        default: return "#94a3b8";
      }
    }

    async function loadGraph() {
      try {
        const res = await fetch("/api/graph");
        const data = await res.json();
        rawNodes = data.nodes;
        rawEdges = data.edges;

        document.getElementById("stat-nodes").textContent = rawNodes.length;
        document.getElementById("stat-edges").textContent = rawEdges.length;

        rebuildGraphElements();
      } catch (err) {
        console.error("Failed to load graph:", err);
      }
    }

    function rebuildGraphElements() {
      const elements = [];
      const visibleNodeIds = new Set();

      rawNodes.forEach(n => {
        if (!activeFilters.has(n.type)) return;
        visibleNodeIds.add(n.id);

        const isLowPriority = n.type === "File" || n.type === "Commit";
        elements.push({
          data: {
            id: n.id,
            label: isLowPriority ? '' : n.name.slice(0, 26),
            fullLabel: n.name,
            type: n.type,
            raw: n
          }
        });
      });

      rawEdges.forEach(e => {
        if (visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)) {
          elements.push({
            data: {
              id: e.id,
              source: e.source,
              target: e.target,
              label: e.type,
              raw: e
            }
          });
        }
      });

      initOrUpdateCytoscape(elements);
    }

    function initOrUpdateCytoscape(elements) {
      if (!cy) {
        cy = cytoscape({
          container: document.getElementById('cy'),
          elements: elements,
          style: [
            {
              selector: 'node',
              style: {
                'background-color': ele => getNodeColor(ele.data('type')),
                'label': 'data(label)',
                'color': '#f8fafc',
                'font-family': 'Plus Jakarta Sans',
                'font-size': '11px',
                'font-weight': 600,
                'text-valign': 'bottom',
                'text-margin-y': '6px',
                'width': ele => (ele.data('type') === 'File' || ele.data('type') === 'Commit') ? 10 : 28,
                'height': ele => (ele.data('type') === 'File' || ele.data('type') === 'Commit') ? 10 : 28,
                'border-width': 2,
                'border-color': '#06080e',
                'transition-property': 'background-color, width, height, opacity',
                'transition-duration': '0.2s'
              }
            },
            {
              selector: 'edge',
              style: {
                'width': 1.2,
                'line-color': '#1e293b',
                'target-arrow-color': '#334155',
                'target-arrow-shape': 'triangle',
                'arrow-scale': 0.7,
                'curve-style': 'bezier',
                'opacity': 0.7,
                'label': '',
                'font-size': '8px',
                'font-family': 'JetBrains Mono',
                'color': '#64748b'
              }
            },
            {
              selector: 'node:selected, node.spotlight',
              style: {
                'border-width': 3,
                'border-color': '#00f5d4',
                'shadow-blur': 20,
                'shadow-color': '#00f5d4',
                'shadow-opacity': 0.8,
                'label': 'data(fullLabel)',
                'font-size': '12px',
                'font-weight': 700,
                'z-index': 999
              }
            },
            {
              selector: 'edge.highlighted',
              style: {
                'line-color': '#00f5d4',
                'target-arrow-color': '#00f5d4',
                'width': 2.2,
                'opacity': 1,
                'label': 'data(label)',
                'z-index': 998
              }
            },
            {
              selector: '.faded',
              style: {
                'opacity': 0.12
              }
            }
          ],
          layout: getLayoutConfig(currentLayout)
        });

        // Click on node: Spotlight Ego-Network + Inspector
        cy.on('tap', 'node', function(evt) {
          const node = evt.target;
          spotlightNode(node);
          renderInspector(node.data('raw'));
        });

        // Click canvas: Reset Spotlight
        cy.on('tap', function(evt) {
          if (evt.target === cy) {
            resetSpotlight();
          }
        });
      } else {
        cy.elements().remove();
        cy.add(elements);
        cy.layout(getLayoutConfig(currentLayout)).run();
      }
    }

    function getLayoutConfig(type) {
      if (type === 'concentric') {
        return {
          name: 'concentric',
          animate: true,
          concentric: function(node) {
            const t = node.data('type');
            if (t === 'Person' || t === 'Service') return 4;
            if (t === 'Team') return 3;
            if (t === 'Task' || t === 'PullRequest') return 2;
            return 1;
          },
          levelWidth: () => 1
        };
      }
      if (type === 'breadthfirst') {
        return {
          name: 'breadthfirst',
          directed: true,
          animate: true,
          spacingFactor: 1.2
        };
      }
      return {
        name: 'cose',
        animate: true,
        nodeRepulsion: 750000,
        idealEdgeLength: 90,
        gravity: 0.25,
        numIter: 1000
      };
    }

    function spotlightNode(targetNode) {
      document.getElementById('focus-tip').style.display = 'block';
      const neighborhood = targetNode.neighborhood().add(targetNode);
      cy.elements().addClass('faded').removeClass('spotlight highlighted');
      neighborhood.removeClass('faded');
      targetNode.addClass('spotlight');
      targetNode.connectedEdges().addClass('highlighted');
    }

    function resetSpotlight() {
      document.getElementById('focus-tip').style.display = 'none';
      cy.elements().removeClass('faded spotlight highlighted');
    }

    function toggleFilter(type, el) {
      if (activeFilters.has(type)) {
        activeFilters.delete(type);
        el.classList.remove('active');
      } else {
        activeFilters.add(type);
        el.classList.add('active');
      }
      rebuildGraphElements();
    }

    function switchLayout(name, el) {
      currentLayout = name;
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      cy.layout(getLayoutConfig(name)).run();
    }

    function fitView() {
      if (cy) cy.animate({ fit: { padding: 40 }, duration: 400 });
    }

    function handleSearch(query) {
      if (!cy) return;
      const q = query.trim().toLowerCase();
      if (!q) {
        resetSpotlight();
        return;
      }
      const matches = cy.nodes().filter(n => {
        const name = (n.data('fullLabel') || '').toLowerCase();
        const id = n.data('id').toLowerCase();
        return name.includes(q) || id.includes(q);
      });

      if (matches.length > 0) {
        const first = matches[0];
        spotlightNode(first);
        cy.animate({ center: { eles: first }, zoom: 1.5, duration: 300 });
        renderInspector(first.data('raw'));
      }
    }

    function renderInspector(node) {
      switchTab('inspector', document.querySelectorAll('.tab-item')[0]);
      const container = document.getElementById("inspector-body");
      let propsHtml = "";
      for (const [k, v] of Object.entries(node.properties || {})) {
        propsHtml += \`
          <div class="prop-item">
            <span class="prop-k">\${k}</span>
            <span class="prop-v">\${typeof v === 'object' ? JSON.stringify(v) : v}</span>
          </div>
        \`;
      }

      container.innerHTML = \`
        <div class="bento-card">
          <div class="bento-header">
            <span>ENTITY CLASSIFICATION</span>
            <span style="color: \${getNodeColor(node.type)}; font-weight: 700;">● \${node.type.toUpperCase()}</span>
          </div>
          <div class="bento-title">\${node.name}</div>
          <span class="urn-pill">\${node.id}</span>
        </div>

        <div class="bento-card">
          <div class="bento-header"><span>BI-TEMPORAL HORIZON</span><span>ISO 8601</span></div>
          <div class="property-grid">
            <div class="prop-item"><span class="prop-k">Valid From</span><span class="prop-v">\${node.valid_from}</span></div>
            <div class="prop-item"><span class="prop-k">Ingested At</span><span class="prop-v">\${node.created_at}</span></div>
          </div>
        </div>

        <div class="bento-card">
          <div class="bento-header"><span>EXTENDED METADATA</span><span>PROPERTIES</span></div>
          <div class="property-grid">
            \${propsHtml || '<div style="color: var(--text-tertiary); font-size: 11px;">Zero custom attributes attached.</div>'}
          </div>
        </div>
      \`;
    }

    async function executeAudit() {
      const file = document.getElementById("audit-input").value.trim();
      const body = document.getElementById("audit-body");
      body.innerHTML = '<div style="color: var(--cyan); text-align: center; padding: 40px; font-size: 12px; font-family: monospace;">Evaluating graph topology & recency decay...</div>';

      try {
        const res = await fetch(\`/api/audit?file=\${encodeURIComponent(file)}\`);
        const data = await res.json();

        let reviewersList = "";
        data.reviewers.forEach((r, idx) => {
          const scorePercent = Math.min(100, Math.round((r.score / 2.0) * 100));
          reviewersList += \`
            <div class="reviewer-tile">
              <div class="reviewer-top">
                <span>#\${idx + 1} \${r.person.name}</span>
                <span class="score-badge">SCORE: \${r.score}</span>
              </div>
              <div class="progress-track"><div class="progress-fill" style="width: \${scorePercent}%"></div></div>
              <div style="font-size: 10px; color: var(--text-tertiary); display: flex; justify-content: space-between;">
                <span>\${r.commitCount} commits authored</span>
                <span>\${r.reviewCount} code reviews</span>
              </div>
            </div>
          \`;
        });

        body.innerHTML = \`
          <div class="bento-card">
            <div class="bento-header"><span>RECOMMENDED REVIEWERS</span><span>RECENCY DECAY WEIGHT</span></div>
            \${reviewersList || '<div style="color: var(--text-tertiary); font-size: 11px;">Zero verified contributors for this target path.</div>'}
          </div>

          <div class="bento-card">
            <div class="bento-header"><span>DOWNSTREAM BLAST RADIUS</span><span>MULTI-HOP</span></div>
            <div class="property-grid">
              <div class="prop-item"><span class="prop-k">Impacted Services</span><span class="prop-v">\${data.affectedServices.join(", ") || "None"}</span></div>
              <div class="prop-item"><span class="prop-k">Responsible Teams</span><span class="prop-v">\${data.affectedTeams.join(", ") || "None"}</span></div>
            </div>
          </div>
        \`;
      } catch (err) {
        body.innerHTML = \`<div style="color: var(--rose); font-size: 12px; padding: 20px;">Audit execution error: \${err.message}</div>\`;
      }
    }

    async function seedDemo() {
      try {
        const res = await fetch("/api/demo/seed", { method: "POST" });
        await res.json();
        loadGraph();
      } catch (err) {
        alert("Failed to seed: " + err.message);
      }
    }

    function switchTab(name, el) {
      document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('tab-' + name).classList.add('active');
    }

    // Keyboard Shortcut "/" to Focus Search
    window.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== document.getElementById('omni-search')) {
        e.preventDefault();
        document.getElementById('omni-search').focus();
      }
    });

    window.onload = loadGraph;
  </script>
</body>
</html>`;
}
