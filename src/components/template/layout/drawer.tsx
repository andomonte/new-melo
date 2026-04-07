import { motion } from 'framer-motion';
import { useEffect } from 'react';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const Drawer = ({ open, onOpenChange, children }: DrawerProps) => {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={() => onOpenChange(false)}
        initial={false}
        animate={{
          opacity: open ? 0.5 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Drawer */}
      <motion.div
        className="fixed top-0 left-0 h-full w-56 bg-white dark:bg-zinc-900 z-50 flex flex-col"
        initial={false}
        animate={{ x: open ? 0 : '-100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
      >
        {children}
      </motion.div>
    </>
  );
};

export default Drawer;
