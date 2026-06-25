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


  </>
);

export default Topbar;
