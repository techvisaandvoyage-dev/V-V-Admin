const fs = require('fs');
const file = 'src/pages/Dashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add useSearchParams to import
if (!content.includes('useSearchParams')) {
  content = content.replace(
    'import { useParams, useNavigate } from "react-router-dom";',
    'import { useParams, useNavigate, useSearchParams } from "react-router-dom";'
  );
}

// 2. Add searchParams and isControlsTab
const activeTabMarker = 'const activeTab      = tabParam || "analytics";';
if (content.includes(activeTabMarker)) {
  content = content.replace(
    activeTabMarker,
    activeTabMarker + '\n  const [searchParams] = useSearchParams();\n  const isControlsTab = ["controls", "landing-page", "cards", "footer", "document-legacy", "authentication", "system-display"].includes(activeTab);'
  );
}

// 3. Sync logic for searchParams -> activeControlSection
const syncLogic = `  // Sync activeControlSection with URL query parameter
  useEffect(() => {
    if (!isControlsTab) return;
    const group = controlGroups.find((g) => g.key === activeTab);
    if (!group) return;
    const sectionParam = searchParams.get("section");
    if (sectionParam) {
      const section = controlSections.find((s) => s.key === sectionParam && s.groupKey === activeTab);
      if (section) {
        selectControlSection(section.key);
        return;
      }
    }
  }, [activeTab, searchParams]);`;

if (!content.includes('const sectionParam = searchParams.get("section");')) {
  content = content.replace(
    '  const selectControlGroup = (groupKey) => {',
    syncLogic + '\n  const selectControlGroup = (groupKey) => {'
  );
}

// 4. Update controlGroups keys
content = content.replace('key: "documents",', 'key: "document-legacy",');
content = content.replace('key: "authentication-otp",', 'key: "authentication",');
content = content.replace('key: "system",', 'key: "system-display",');

// 5. Replace {activeTab === "controls" && (
content = content.replace('{activeTab === "controls" && (', '{isControlsTab && (');

// 6. Remove <aside>
const asideRegex = /<aside className="min-w-0 lg:sticky lg:top-24 z-\[100\]">[\s\S]*?<\/aside>/;
content = content.replace(asideRegex, '');

// 7. Update the grid layout wrapper so it expands properly to full width
// Old: <div className="min-w-0 space-y-4 overflow-hidden lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-6">
// Old inner: <div className="min-w-0 space-y-6">
const gridWrapper = 'className="min-w-0 space-y-4 overflow-hidden lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-6"';
if (content.includes(gridWrapper)) {
  content = content.replace(gridWrapper, 'className="min-w-0"');
  content = content.replace(
    '<div className="min-w-0 space-y-6">',
    '<div className="min-w-0 w-full space-y-6">'
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Dashboard.jsx completely rebuilt and fixed!');
