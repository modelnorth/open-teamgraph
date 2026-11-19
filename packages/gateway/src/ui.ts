export function getExplorerHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Open TeamGraph — Explorer | ModelNorth</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js"></script>
  <style>
    :root {
      --bg: #090d16;
      --surface: #111726;
      --surface-border: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --accent: #818cf8;
      --success: #34d399;
      --warning: #fbbf24;
      --danger: #f87171;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--surface-border);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 10;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      color: #000;
      font-size: 14px;
    }
    .brand-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .brand-badge {
      font-size: 10px;
      text-transform: uppercase;
      background: rgba(56, 189, 248, 0.15);
      color: var(--primary);
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .stats-bar {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .stat-pill {
      font-size: 12px;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.03);
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--surface-border);
    }
    .stat-pill strong { color: var(--text); }
    .btn {
      background: var(--primary);
      color: #000;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
      border: 1px solid var(--surface-border);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.12); }
    .layout {
      flex: 1;
      display: flex;
      position: relative;
      overflow: hidden;
    }
    #cy {
      flex: 1;
      height: 100%;
      background: radial-gradient(circle at center, #111726 0%, #090d16 100%);
    }
    .sidebar {
      width: 380px;
      background: var(--surface);
      border-left: 1px solid var(--surface-border);
      display: flex;
      flex-direction: column;
      z-index: 5;
    }
    .tabs {
      display: flex;
      border-bottom: 1px solid var(--surface-border);
    }
    .tab {
      flex: 1;
      padding: 12px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      border-bottom: 2px solid transparent;
    }
    .tab.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
      background: rgba(56, 189, 248, 0.04);
    }
    .panel {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
      display: none;
    }
    .panel.active { display: block; }
    .panel-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    .card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .card-label { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
    .card-value { font-size: 13px; font-weight: 600; word-break: break-all; }
    .prop-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 4px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .prop-key { color: var(--text-muted); }
    .prop-val { font-family: monospace; color: var(--primary); }
    .input-group {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .input-text {
      flex: 1;
      background: #090d16;
      border: 1px solid var(--surface-border);
      color: var(--text);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
    }
    .input-text:focus { border-color: var(--primary); }
    .legend {
      position: absolute;
      bottom: 16px;
      left: 16px;
      background: rgba(17, 23, 38, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 11px;
      display: flex;
      gap: 12px;
      z-index: 5;
    }
    .legend-item { display: flex; align-items: center; gap: 6px; color: var(--text-muted); }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
    .score-bar {
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      margin-top: 4px;
      overflow: hidden;
    }
    .score-fill { height: 100%; background: var(--success); border-radius: 3px; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-logo">TG</div>
      <div class="brand-title">Open TeamGraph</div>
      <div class="brand-badge">ModelNorth</div>
    </div>
    <div class="stats-bar">
      <div class="stat-pill">Nodes: <strong id="stat-nodes">0</strong></div>
      <div class="stat-pill">Edges: <strong id="stat-edges">0</strong></div>
      <button class="btn btn-secondary" onclick="seedDemo()">🌱 Seed Realistic Demo</button>
      <button class="btn" onclick="loadGraph()">🔄 Refresh</button>
    </div>
  </header>

  <div class="layout">
    <div id="cy"></div>

    <div class="legend">
      <div class="legend-item"><div class="legend-dot" style="background: #38bdf8;"></div>Person</div>
      <div class="legend-item"><div class="legend-dot" style="background: #a855f7;"></div>Service</div>
      <div class="legend-item"><div class="legend-dot" style="background: #eab308;"></div>Team</div>
      <div class="legend-item"><div class="legend-dot" style="background: #10b981;"></div>Task</div>
      <div class="legend-item"><div class="legend-dot" style="background: #f43f5e;"></div>PullRequest</div>
      <div class="legend-item"><div class="legend-dot" style="background: #64748b;"></div>Commit / File</div>
      <div class="legend-item"><div class="legend-dot" style="background: #ec4899;"></div>Slack Message</div>
    </div>

    <div class="sidebar">
      <div class="tabs">
        <div class="tab active" onclick="switchTab('inspector')">Node Inspector</div>
        <div class="tab" onclick="switchTab('audit')">Autonomous PR Audit</div>
      </div>

      <!-- Inspector Panel -->
      <div id="panel-inspector" class="panel active">
        <div class="panel-title">Selected Entity</div>
        <div id="inspector-content">
          <div style="color: var(--text-muted); font-size: 12px; text-align: center; margin-top: 40px;">
            Click any node in the graph canvas to inspect its bi-temporal history, properties, and relationships.
          </div>
        </div>
      </div>

      <!-- Audit Panel -->
      <div id="panel-audit" class="panel">
        <div class="panel-title">PR Blast Radius & Expert Finder</div>
        <div class="input-group">
          <input type="text" id="audit-file" class="input-text" placeholder="e.g. src/auth/jwt.ts" value="src/auth/jwt.ts">
          <button class="btn" onclick="runAudit()">Audit</button>
        </div>
        <div id="audit-results">
          <div style="color: var(--text-muted); font-size: 12px; text-align: center; margin-top: 30px;">
            Enter a file path to calculate the real-time recency-decay expertise and multi-hop blast radius.
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let cy = null;

    function getNodeColor(type) {
      switch (type) {
        case "Person": return "#38bdf8";
        case "Service": return "#a855f7";
        case "Team": return "#eab308";
        case "Task": return "#10b981";
        case "PullRequest": return "#f43f5e";
        case "Commit": return "#64748b";
        case "File": return "#94a3b8";
        case "Message": return "#ec4899";
        default: return "#cbd5e1";
      }
    }

    async function loadGraph() {
      try {
        const res = await fetch("/api/graph");
        const data = await res.json();

        document.getElementById("stat-nodes").textContent = data.nodes.length;
        document.getElementById("stat-edges").textContent = data.edges.length;

        const elements = [];
        data.nodes.forEach(n => {
          elements.push({
            data: {
              id: n.id,
              label: n.name.slice(0, 24),
              type: n.type,
              full: n
            }
          });
        });

        data.edges.forEach(e => {
          elements.push({
            data: {
              id: e.id,
              source: e.source,
              target: e.target,
              label: e.type,
              full: e
            }
          });
        });

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
                  'font-size': '10px',
                  'font-weight': 600,
                  'text-valign': 'bottom',
                  'text-margin-y': '6px',
                  'width': 28,
                  'height': 28,
                  'border-width': 2,
                  'border-color': '#0f172a'
                }
              },
              {
                selector: 'edge',
                style: {
                  'width': 1.5,
                  'line-color': '#334155',
                  'target-arrow-color': '#38bdf8',
                  'target-arrow-shape': 'triangle',
                  'curve-style': 'bezier',
                  'label': 'data(label)',
                  'font-size': '8px',
                  'color': '#64748b',
                  'text-rotation': 'autorotate'
                }
              },
              {
                selector: 'node:selected',
                style: {
                  'border-width': 3,
                  'border-color': '#38bdf8',
                  'shadow-blur': 12,
                  'shadow-color': '#38bdf8',
                  'shadow-opacity': 0.6
                }
              }
            ],
            layout: {
              name: 'cose',
              animate: true,
              nodeRepulsion: 450000,
              idealEdgeLength: 80,
            }
          });

          cy.on('tap', 'node', function(evt) {
            renderInspector(evt.target.data('full'));
          });
        } else {
          cy.elements().remove();
          cy.add(elements);
          cy.layout({ name: 'cose', animate: true }).run();
        }
      } catch (err) {
        console.error("Failed to load graph:", err);
      }
    }

    function renderInspector(node) {
      switchTab('inspector');
      const container = document.getElementById("inspector-content");
      let propsHtml = "";
      for (const [k, v] of Object.entries(node.properties || {})) {
        propsHtml += \`<div class="prop-row"><span class="prop-key">\${k}</span><span class="prop-val">\${typeof v === 'object' ? JSON.stringify(v) : v}</span></div>\`;
      }

      container.innerHTML = \`
        <div class="card">
          <div class="card-label">Entity Type</div>
          <div class="card-value" style="color: \${getNodeColor(node.type)}">\${node.type}</div>
        </div>
        <div class="card">
          <div class="card-label">Name</div>
          <div class="card-value">\${node.name}</div>
        </div>
        <div class="card">
          <div class="card-label">URN Identifier</div>
          <div class="card-value" style="font-size: 11px; font-family: monospace;">\${node.id}</div>
        </div>
        <div class="card">
          <div class="card-label">Bi-Temporal Horizon</div>
          <div class="prop-row"><span class="prop-key">Valid From</span><span class="prop-val">\${node.valid_from}</span></div>
          <div class="prop-row"><span class="prop-key">Created At</span><span class="prop-val">\${node.created_at}</span></div>
        </div>
        <div class="card">
          <div class="card-label">Custom Properties</div>
          \${propsHtml || '<div style="color: var(--text-muted); font-size: 11px;">None</div>'}
        </div>
      \`;
    }

    async function runAudit() {
      const file = document.getElementById("audit-file").value.trim();
      const resultsDiv = document.getElementById("audit-results");
      resultsDiv.innerHTML = '<div style="color: var(--primary); font-size: 12px; text-align: center;">Analyzing graph topology...</div>';

      try {
        const res = await fetch(\`/api/audit?file=\${encodeURIComponent(file)}\`);
        const data = await res.json();

        let reviewersHtml = "";
        data.reviewers.forEach(r => {
          const scorePercent = Math.min(100, Math.round(r.score * 100));
          reviewersHtml += \`
            <div style="margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
                <span>\${r.person.name}</span>
                <span style="color: var(--primary)">Score: \${r.score}</span>
              </div>
              <div class="score-bar"><div class="score-fill" style="width: \${scorePercent}%"></div></div>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                \${r.commitCount} commits, \${r.reviewCount} reviews
              </div>
            </div>
          \`;
        });

        resultsDiv.innerHTML = \`
          <div class="card">
            <div class="card-label">🎯 Top Experts (Recency-Decayed)</div>
            \${reviewersHtml || '<div style="color: var(--text-muted); font-size: 11px;">No historical experts recorded for this file yet.</div>'}
          </div>
          <div class="card">
            <div class="card-label">⚠️ Impacted Services</div>
            <div class="card-value">\${data.affectedServices.join(", ") || "None directly detected"}</div>
          </div>
          <div class="card">
            <div class="card-label">👥 Owning Teams</div>
            <div class="card-value">\${data.affectedTeams.join(", ") || "No team assigned"}</div>
          </div>
        \`;
      } catch (err) {
        resultsDiv.innerHTML = \`<div style="color: var(--danger); font-size: 12px;">Failed to run audit: \${err.message}</div>\`;
      }
    }

    async function seedDemo() {
      try {
        const res = await fetch("/api/demo/seed", { method: "POST" });
        const data = await res.json();
        alert("Seeded: " + data.message);
        loadGraph();
      } catch (err) {
        alert("Seed failed: " + err.message);
      }
    }

    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      if (tab === 'inspector') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('panel-inspector').classList.add('active');
      } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('panel-audit').classList.add('active');
      }
    }

    window.onload = loadGraph;
  </script>
</body>
</html>`;
}
