import { motion } from "framer-motion";

const Topbar = ({
  title,
  description,
  tabs,
  activeTab,
  onTabChange,
}) => (
  <>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">{title}</h1>
      <p className="text-text-secondary mt-1">{description}</p>
    </motion.div>

    <div className="flex gap-1 bg-surface-2 p-1 rounded-xl mb-8 w-fit">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          id={`admin-tab-${id}`}
          onClick={() => onTabChange(id)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${activeTab === id
              ? "bg-cyan text-background shadow-sm"
              : "text-text-secondary hover:text-text-primary"
            }
          `}
        >
          <Icon size={15} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  </>
);

export default Topbar;
