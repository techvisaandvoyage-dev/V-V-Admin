import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/admin/Topbar";

const AdminLayout = ({
  title,
  description,
  tabs,
  activeTab,
  onTabChange,
  children,
}) => (
  <div className="flex min-h-screen bg-background">
    <Sidebar />

    <main className="flex-1 overflow-auto min-w-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Topbar
          title={title}
          description={description}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
        {children}
      </div>
    </main>
  </div>
);

export default AdminLayout;
